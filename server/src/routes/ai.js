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

        const prompt = `Analiza la siguiente lista de tareas desordenadas.
Devuelve ÚNICAMENTE UN ARRAY JSON DE OBJETOS. Sin texto adicional, sin formato markdown.
Cada objeto debe tener exactamente las siguientes propiedades:
- "text": nombre de la tarea (limpio)
- "priority": "Urgente" | "Enfoque" | "Delegar" | "Eliminar" (Usa la Matriz Eisenhower 80/20)
- "quadrant": "🔴 Haz ahora" | "🔵 Planifica" | "🟡 Delega" | "⚪ Descarta"
- "color": "red" | "blue" | "yellow" | "gray"
- "time": tiempo estimado (ej. "25 min", "1h")

Tareas:
${input}`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    responseMimeType: "application/json",
                    maxOutputTokens: 2048
                }
            })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        console.log('Gemini Raw Response:', raw);

        let parsed = [];
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            console.error('JSON Parse Error:', e.message);
            console.error('Failed String:', raw);

            // Fallback: Gemini sometimes hallucinates unescaped newlines or trailing commas
            try {
                // Remove trailing commas before brackets/braces
                let relaxed = raw.replace(/,\s*([\]}])/g, '$1');
                // Escape literal newlines inside strings
                relaxed = relaxed.replace(/\n/g, '\\n');
                parsed = JSON.parse(relaxed);
                console.log('Fallback relaxed parsing succeeded.');
            } catch (fallbackErr) {
                console.error('Fallback parse also failed:', fallbackErr.message);
                throw new Error('Gemini returned unparseable JSON structure.');
            }
        }

        const tasks = parsed.map((t, i) => ({ ...t, done: false, id: 'task-' + i }));

        return c.json({ success: true, tasks });

    } catch (e) {
        console.error('Error in AI organization:', e);
        return c.json({ error: e.message }, 500);
    }
});

export default aiRoutes;
