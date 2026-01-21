// netlify/functions/gemini-trivia.js

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: "ok",
    };
  }

  // Only POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Missing GEMINI_API_KEY in Netlify env vars" }),
    };
  }

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
Do not include markdown formatting. Only raw JSON.
`.trim();

  try {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      encodeURIComponent(apiKey);

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.8,
        },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      return {
        statusCode: resp.status,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Gemini API error", details: t.slice(0, 800) }),
      };
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = String(text).replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({
          error: "Model did not return valid JSON",
          raw: cleaned.slice(0, 800),
        }),
      };
    }

    const question = String(parsed.question || "").trim();
    const options = Array.isArray(parsed.options) ? parsed.options.map((o) => String(o).trim()) : [];
    const correctAnswer = String(parsed.correctAnswer || "").trim();

    if (!question || options.length !== 4 || !correctAnswer || !options.includes(correctAnswer)) {
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Invalid trivia JSON shape", parsed }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ question, options, correctAnswer }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Server exception", details: String(err?.message || err) }),
    };
  }
};

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
