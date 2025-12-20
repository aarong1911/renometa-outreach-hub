// netlify/functions/getReplies.js
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

    const records = await base("Warmup Replies")
      .select({
        filterByFormula: `{userId} = '${safeUid}'`,
        maxRecords: 50,
        sort: [{ field: "repliedAt", direction: "desc" }],
      })
      .all();

    const replies = records.map((record) => {
      const f = record.fields || {};
      return {
        id: record.id,
        fromAccountId: f.fromAccountId || "",
        toAccountId: f.toAccountId || "",
        originalEmailId: f.originalEmailId || "",
        repliedAt: f.repliedAt || "",
        delayMinutes: Number(f.delayMinutes || 0),
      };
    });

    return { statusCode: 200, headers, body: JSON.stringify({ replies }) };
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error("getReplies error:", error);
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: statusCode === 401 ? "Unauthorized" : "Failed to fetch replies",
        details: error.message,
      }),
    };
  }
};
