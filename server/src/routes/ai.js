import { Hono } from 'hono';

const aiRoutes = new Hono();

// POST /api/ai/organize
aiRoutes.post('/organize', async (c) => {
    try {
        const body = await c.req.json();
        const { input } = body;

        if (!input) {
            return c.json({ error: 'Falta el texto de tareas' }, 400);
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return c.json({ error: 'El servidor no tiene configurada la llave de Gemini' }, 500);
        }

        const prompt = `Eres un experto en productividad. Analiza estas tareas y clasifícalas en la Matriz de Eisenhower.
Devuelve ÚNICAMENTE un array JSON válido con este formato exacto (sin markdown, sin texto extra):
[{"text":"nombre de la tarea","priority":"Urgente|Enfoque|Delegar|Eliminar","quadrant":"🔴 Haz ahora|🔵 Planifica|🟡 Delega|⚪ Descarta","color":"red|blue|yellow|gray","time":"estimado como 25 min, 1h, etc"}]

Tareas a analizar:
${input}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        // Strip possible markdown code fences
        const clean = raw.replace(/```json?/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);

        const tasks = parsed.map((t, i) => ({ ...t, done: false, id: 'task-' + i }));

        return c.json({ success: true, tasks });

    } catch (e) {
        console.error('Error in AI organization:', e);
        return c.json({ error: e.message }, 500);
    }
});

export default aiRoutes;
