import { Hono } from 'hono';

const app = new Hono();

// POST /api/calendar/schedule-batch
app.post('/schedule-batch', async (c) => {
    try {
        const body = await c.req.json();
        const { token, events } = body;

        if (!token || !events || !Array.isArray(events)) {
            return c.json({ error: 'Faltan datos: token y events (array) son requeridos.' }, 400);
        }

        const results = [];

        // Google Calendar API documentation:
        // https://developers.google.com/calendar/api/v3/reference/events/insert
        for (const evt of events) {
            const calendarEvent = {
                summary: evt.summary || 'Tarea Syncro-Daily',
                description: evt.description || 'Creado por Pomodoro ReBorder',
                start: {
                    dateTime: evt.startTime,
                    timeZone: 'America/Mexico_City',
                },
                end: {
                    dateTime: evt.endTime,
                    timeZone: 'America/Mexico_City',
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'popup', minutes: 10 },
                    ],
                },
            };

            const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(calendarEvent)
            });

            if (!response.ok) {
                const errData = await response.json();
                console.error('Error inserting event:', errData);
                if (response.status === 401 || errData?.error?.code === 401) {
                    return c.json({ error: 'Credenciales de Google expiradas.' }, 401);
                }
                results.push({ success: false, summary: evt.summary, error: errData.error.message });
            } else {
                const data = await response.json();
                results.push({ success: true, summary: evt.summary, link: data.htmlLink });
            }
        }

        const allFailed = results.length > 0 && results.every(r => !r.success);
        if (allFailed) {
            return c.json({ error: 'No se pudo crear ningún evento en Google Calendar.' }, 500);
        }

        return c.json({ success: true, results });
    } catch (e) {
        console.error('Error scheduling calendar events:', e);
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/calendar/import
app.get('/import', async (c) => {
    try {
        const token = c.req.query('token');
        if (!token) return c.json({ error: 'Token de Google requerido.' }, 400);

        const timeMin = new Date();
        timeMin.setHours(0, 0, 0, 0);

        const timeMax = new Date();
        timeMax.setHours(23, 59, 59, 999);

        const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
        url.searchParams.append('timeMin', timeMin.toISOString());
        url.searchParams.append('timeMax', timeMax.toISOString());
        url.searchParams.append('singleEvents', 'true');
        url.searchParams.append('orderBy', 'startTime');

        const response = await fetch(url.toString(), {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errData = await response.json();
            if (response.status === 401 || errData?.error?.code === 401) {
                return c.json({ error: 'Credenciales de Google expiradas.' }, 401);
            }
            throw new Error(errData?.error?.message || 'Errorfetching events');
        }

        const data = await response.json();
        // Filtrar eventos de todo el día o sin summary
        const validEvents = (data.items || []).filter(i => i.summary && i.status !== 'cancelled');
        const eventsText = validEvents.map(i => i.summary).join('\n');

        return c.json({ success: true, events: eventsText, count: validEvents.length });
    } catch (e) {
        console.error('Error importing events:', e);
        return c.json({ error: e.message }, 500);
    }
});

export default app;
