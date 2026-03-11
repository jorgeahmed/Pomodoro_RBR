import { Hono } from 'hono';
import { getConnection, getSubscribers } from '../lib/supabase.js';
import { sendDailyReport, buildReportHtml } from '../lib/email.js';

const report = new Hono();

// POST /api/report/send
// Body: { user_id, email, name, tasks: [{text, quadrant, time, priority}], schedule? }
report.post('/send', async (c) => {
    try {
        const body = await c.req.json();
        const { user_id, email, name, tasks, schedule } = body;

        if (!email || !tasks?.length) {
            return c.json({ error: 'email and tasks are required' }, 400);
        }

        const date = new Date().toLocaleDateString('es-MX', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });

        let reportSchedule = schedule;

        // If no schedule provided, try to generate it with Gemini
        if (!reportSchedule && process.env.GEMINI_API_KEY) {
            try {
                const taskList = tasks.map((t, i) =>
                    `${i + 1}. [${t.priority || t.quadrant}] ${t.text} — est: ${t.time || '30 min'}`
                ).join('\n');

                const gemRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: `Crea un horario de trabajo para hoy basado en estas tareas priorizadas:\n\n${taskList}\n\n
Reglas: empieza 9:00 AM, bloques 25-90 min, incluye breaks, ordena por prioridad.
Formato: "HH:MM–HH:MM | Tarea | Tipo"
Máximo 8 horas. Agrega 1 tip de productividad al final.
Solo responde con el horario, sin texto extra.`,
                                }],
                            }],
                        }),
                    }
                );
                const gemData = await gemRes.json();
                reportSchedule = gemData.candidates?.[0]?.content?.parts?.[0]?.text;
            } catch (e) {
                console.warn('Gemini schedule generation failed:', e.message);
            }
        }

        const html = buildReportHtml({ name, date, tasks, schedule: reportSchedule });

        // Send to the requesting user
        const results = [sendDailyReport({ to: email, name, reportHtml: html, date })];

        // Also send to all newsletter subscribers (optional)
        if (body.send_to_subscribers) {
            const subscribers = await getSubscribers();
            for (const sub of subscribers) {
                if (sub.email !== email) {
                    results.push(sendDailyReport({ to: sub.email, name: sub.name, reportHtml: html, date }));
                }
            }
        }

        await Promise.allSettled(results);

        return c.json({
            success: true,
            message: `Reporte enviado a ${email}`,
            date,
        });
    } catch (err) {
        console.error('[report/send] Error:', err);
        return c.json({ error: err.message || 'Error desconocido al enviar el reporte' }, 500);
    }
});

// GET /api/tasks/:tool — Fetch tasks using stored OAuth token
report.get('/tasks/:tool', async (c) => {
    const tool = c.req.param('tool');
    const userId = c.req.query('user_id');
    const directToken = c.req.query('token'); // sent by frontend as fallback

    if (!userId) return c.json({ error: 'user_id required' }, 400);

    // Try Supabase first; fall back to the token passed directly from frontend
    let token = directToken;
    let connExtra = null;
    try {
        const conn = await getConnection(userId, tool);
        if (conn) {
            token = conn.access_token;
            connExtra = conn.extra;
        }
    } catch (dbErr) {
        console.warn(`[tasks/${tool}] Supabase lookup failed (using direct token):`, dbErr.message);
    }

    if (!token) return c.json({ error: `${tool} not connected for this user` }, 404);

    try {
        let tasks = [];

        if (tool === 'todoist') {
            const res = await fetch('https://api.todoist.com/api/v1/tasks', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const items = await res.json();
            const taskList = items.results || [];
            tasks = taskList.slice(0, 30).map(t => ({
                text: t.content,
                source: 'Todoist',
                due: t.due?.string,
                urgent: t.priority > 2,
            }));
        } else if (tool === 'asana') {
            const res = await fetch('https://app.asana.com/api/1.0/tasks?assignee=me&completed_since=now&limit=30&opt_fields=name,due_on', {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
            const { data } = await res.json();
            tasks = (data || []).map(t => ({ text: t.name, source: 'Asana', due: t.due_on }));
        } else if (tool === 'monday') {
            const query = `{ me { teams { boards(limit:3) { items_page(limit:20) { items { name } } } } } }`;
            const res = await fetch('https://api.monday.com/v2', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'API-Version': '2024-01' },
                body: JSON.stringify({ query }),
            });
            const json = await res.json();
            const items = json?.data?.me?.teams?.[0]?.boards?.flatMap(b => b.items_page?.items || []) || [];
            tasks = items.slice(0, 25).map(i => ({ text: i.name, source: 'Monday' }));
        } else if (tool === 'clickup') {
            const teamsRes = await fetch('https://api.clickup.com/api/v2/team', {
                headers: { Authorization: token },
            });
            const { teams } = await teamsRes.json();
            if (teams?.length) {
                const tasksRes = await fetch(
                    `https://api.clickup.com/api/v2/team/${teams[0].id}/task?assignees[]=me&include_closed=false`,
                    { headers: { Authorization: token } }
                );
                const { tasks: cu } = await tasksRes.json();
                tasks = (cu || []).slice(0, 25).map(t => ({
                    text: t.name, source: 'ClickUp',
                    due: t.due_date ? new Date(+t.due_date).toLocaleDateString() : null,
                    urgent: t.priority?.priority === 'urgent',
                }));
            }
        } else if (tool === 'jira') {
            const extra = conn.extra ? JSON.parse(conn.extra) : {};
            const cloudRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
                headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            });
            const clouds = await cloudRes.json();
            if (clouds?.[0]) {
                const cloudId = clouds[0].id;
                const jql = encodeURIComponent('assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC');
                const res = await fetch(
                    `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search?jql=${jql}&maxResults=25&fields=summary,priority,duedate`,
                    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
                );
                const { issues } = await res.json();
                tasks = (issues || []).map(i => ({
                    text: `[${i.key}] ${i.fields.summary}`,
                    source: 'Jira',
                    due: i.fields.duedate,
                    urgent: i.fields.priority?.name === 'Highest',
                }));
            }
        }

        return c.json({ tool, tasks, total: tasks.length });
    } catch (err) {
        console.error(`[tasks/${tool}]`, err);
        return c.json({ error: err.message }, 500);
    }
});

export default report;
