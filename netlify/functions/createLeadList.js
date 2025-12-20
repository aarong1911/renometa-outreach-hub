// netlify/functions/createLeadList.js
const Airtable = require("airtable");
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
    const { name, source } = JSON.parse(event.body || "{}");

    if (!name || !String(name).trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "name is required" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
    const now = new Date().toISOString();

    const record = await base("LeadLists").create(
      {
        name: String(name).trim(),
        userId: user.uid,
        source: (source || "csv-import").toString(),
        createdAt: now,
      },
      { typecast: true }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, listId: record.id }),
    };
  } catch (error) {
    console.error("createLeadList error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to create LeadList", details: error.message }),
    };
  }
};
