// netlify/functions/getCampaigns.js
// Fetch campaigns from Airtable (AUTH via Firebase ID token)

const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

function escapeAirtableString(value) {
  return String(value || "").replace(/'/g, "\\'");
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { uid } = await requireUser(event);

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
    const safeUid = escapeAirtableString(uid);

    const records = await base("Campaigns")
      .select({
        filterByFormula: `{userId} = '${safeUid}'`,
        sort: [{ field: "createdAt", direction: "desc" }],
      })
      .all();

    const campaigns = records.map((r) => {
      const f = r.fields || {};
      return {
        id: r.id,
        name: f.name || "",
        userId: f.userId || uid,
        status: f.status || "draft",
        sent: Number(f.sent || 0),
        opened: Number(f.opened || 0),
        replied: Number(f.replied || 0),
        createdAt: f.createdAt || "",
        startedAt: f.startedAt || "",
        completedAt: f.completedAt || "",
      };
    });

    return { statusCode: 200, headers, body: JSON.stringify({ campaigns }) };
  } catch (error) {
    const statusCode = error.message?.includes("Missing Authorization") ? 401 : 500;

    console.error("getCampaigns error:", error);
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: statusCode === 401 ? "Unauthorized" : "Failed to fetch campaigns",
        details: error.message,
      }),
    };
  }
};
