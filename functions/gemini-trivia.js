// netlify/functions/gemini-trivia.js

export async function handler(event) {
  // Allow only POST
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(500, { error: "Missing GEMINI_API_KEY env var on Netlify" });
  }

  // Prompt: return strict JSON
  const prompt = `
You are a trivia game engine for a mobile app.
Generate a unique, fun, random trivia question suitable for a general audience.
Topics: Pop culture, Science, History, Geography, Food, Technology.
Return ONLY a valid JSON object with this schema:
{
  "question": "The question text here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": "The exact text of the correct option"
}
Do not include markdown formatting like \`\`\`json. Just raw JSON.
`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          // This helps make the model respond with JSON reliably
          responseMimeType: "application/json",
          temperature: 0.8
        }
      })
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      return json(resp.status, { error: "Gemini API error", details: t.slice(0, 500) });
    }

    const data = await resp.json();

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = String(text).replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return json(500, {
        error: "Model did not return valid JSON",
        raw: cleaned.slice(0, 500)
      });
    }

    // Validate and normalize
    const question = String(parsed.question || "").trim();
    const options = Array.isArray(parsed.options) ? parsed.options.map(o => String(o).trim()) : [];
    const correctAnswer = String(parsed.correctAnswer || "").trim();

    if (!question || options.length !== 4 || !correctAnswer || !options.includes(correctAnswer)) {
      return json(500, {
        error: "Invalid trivia shape returned",
        parsed
      });
    }

    return json(200, { question, options, correctAnswer });
  } catch (err) {
    return json(500, { error: "Server exception", details: String(err?.message || err) });
  }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(obj),
  };
}
