// netlify/functions/list-models.js
exports.handler = async (event) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing GEMINI_API_KEY in Netlify env vars" }),
    };
  }

  try {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models?key=" +
      encodeURIComponent(apiKey);

    const resp = await fetch(url);
    const text = await resp.text();

    return {
      statusCode: resp.status,
      headers: { "Content-Type": "application/json" },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server exception", details: String(err?.message || err) }),
    };
  }
};
