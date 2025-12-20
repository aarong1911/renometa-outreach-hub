// netlify/functions/addCampaign.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

function escapeAirtableString(value) {
  return String(value || "").replace(/'/g, "\\'");
}

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
    const { uid } = await requireUser(event);
    const { name } = JSON.parse(event.body || "{}");

    if (!name || !String(name).trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Campaign name is required" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const record = await base("Campaigns").create(
      {
        name: String(name).trim(),
        userId: escapeAirtableString(uid),
        status: "draft",
        sent: 0,
        opened: 0,
        replied: 0,
      },
      { typecast: true }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        campaign: {
          id: record.id,
          name: record.fields.name || "",
          userId: record.fields.userId || uid,
          status: record.fields.status || "draft",
          sent: Number(record.fields.sent || 0),
          opened: Number(record.fields.opened || 0),
          replied: Number(record.fields.replied || 0),
          createdAt: record.fields.createdAt || "",
          startedAt: record.fields.startedAt || "",
          completedAt: record.fields.completedAt || "",
        },
      }),
    };
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error("addCampaign error:", error);
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: statusCode === 401 ? "Unauthorized" : "Failed to create campaign",
        details: error.message,
      }),
    };
  }
};