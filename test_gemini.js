const apiKey = "AIzaSyCD2cQfpr1dXhhDYBAp-o0TjXfiwo6Nnho";
const prompt = "Dime 3 colores en ingles en formato JSON como un array de strings";

fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
}).then(res => res.json()).then(data => {
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log("RAW STRING START\n" + raw + "\nRAW STRING END");
}).catch(console.error);
