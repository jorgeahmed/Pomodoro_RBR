import { Hono } from 'hono';
import { sendDelegationEmail } from '../lib/email.js';
import supabase from '../lib/supabase.js';

const app = new Hono();

// POST /api/analytics/save-daily-plan
app.post('/save-daily-plan', async (c) => {
    try {
        const { email, tasks } = await c.req.json();
        if (!email || !tasks || tasks.length === 0) {
            return c.json({ error: 'Faltan datos: email y lista de tareas.' }, 400);
        }

        const dateStr = new Date().toISOString().split('T')[0];

        // Convert to database rows
        const records = tasks.map(t => ({
            user_email: email,
            task_name: t.text,
            priority: t.priority,
            quadrant: t.quadrant,
            estimated_time: t.time,
            done: t.done || false,
            date: dateStr
        }));

        // Insert into Supabase table (which the user must create)
        const { error } = await supabase.from('task_analytics').insert(records);
        if (error) throw error;

        return c.json({ success: true, message: 'Plan guardado en el historial.' });
    } catch (e) {
        console.error('Error saving plan to analytics:', e);
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/analytics/history?email=x
app.get('/history', async (c) => {
    try {
        const email = c.req.query('email');
        if (!email) return c.json({ error: 'Falta email parameter' }, 400);

        const { data, error } = await supabase
            .from('task_analytics')
            .select('*')
            .eq('user_email', email)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Group the data by date locally since Supabase REST doesn't aggregate as easily
        const grouped = {};
        data.forEach(task => {
            const d = task.date;
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(task);
        });

        // Convert the grouping to an array for easier UI sorting
        const historyArray = Object.keys(grouped).map(k => ({
            date: k,
            tasks: grouped[k]
        }));

        return c.json({ success: true, history: historyArray });
    } catch (e) {
        console.error('Error fetching history:', e);
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/analytics/delegate
app.post('/delegate', async (c) => {
    try {
        const body = await c.req.json();
        const { email, task, user_id } = body;

        if (!email || !task) {
            return c.json({ error: 'Faltan datos: email y task son requeridos.' }, 400);
        }

        // Sends the email to the delegated user
        await sendDelegationEmail({
            to: email,
            taskText: task,
            fromUser: 'Tu compañero'
        });

        // Here we can later add Supabase tracking logic to log that user_id delegated a task
        // e.g. await supabase.from('task_analytics').insert(...)

        return c.json({ success: true, message: 'Tarea delegada con éxito' });
    } catch (e) {
        console.error('Error delegating task:', e);
        return c.json({ error: e.message }, 500);
    }
});
// POST /api/analytics/suggestion
app.post('/suggestion', async (c) => {
    try {
        const { email, text } = await c.req.json();
        if (!email || !text) {
            return c.json({ error: 'Faltan datos requeridos.' }, 400);
        }

        const { error } = await supabase.from('suggestions').insert([{
            user_email: email,
            suggestion: text
        }]);

        if (error) throw error;

        return c.json({ success: true, message: 'Sugerencia guardada con éxito' });
    } catch (e) {
        console.error('Error guardando sugerencia:', e);
        return c.json({ error: e.message }, 500);
    }
});

export default app;
