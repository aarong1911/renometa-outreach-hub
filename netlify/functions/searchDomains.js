// netlify/functions/searchDomains.js
const { requireUser } = require("./_lib/auth");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const user = await requireUser(event);
    const { query } = JSON.parse(event.body || "{}");

    if (!query) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Query required" }) };
    }

    // TODO: Integrate with domain registrar API (Namecheap, GoDaddy, etc.)
    // For now, return mock results
    
    const baseDomain = query.replace(/\s+/g, "").toLowerCase();
    const extensions = [".com", ".net", ".org", ".io", ".co"];
    
    const results = extensions.map((ext) => ({
      domain: `${baseDomain}${ext}`,
      available: Math.random() > 0.5, // Mock availability
      price: ext === ".com" ? 12.99 : ext === ".io" ? 39.99 : 14.99,
      registrar: "Namecheap",
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results }),
    };
  } catch (error) {
    console.error("searchDomains error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to search domains", details: error.message }),
    };
  }
};