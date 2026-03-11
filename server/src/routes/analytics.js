import { Hono } from 'hono';
import { sendDelegationEmail } from '../lib/email.js';

const app = new Hono();

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

export default app;
