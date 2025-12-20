// netlify/functions/getStats.js
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

    const accounts = await base("Email Accounts")
      .select({ filterByFormula: `{userId} = '${safeUid}'` })
      .all();

    const logs = await base("Email Logs")
      .select({ filterByFormula: `{userId} = '${safeUid}'` })
      .all();

    const replies = await base("Warmup Replies")
      .select({ filterByFormula: `{userId} = '${safeUid}'` })
      .all();

    const totalAccounts = accounts.length;
    const totalSent = logs.length;
    const totalReplies = replies.length;

    const replyRate = totalSent > 0 ? Math.min((totalReplies / totalSent) * 100, 100) : 0;

    const sentToday = accounts.reduce((sum, record) => sum + Number(record.fields?.sentToday || 0), 0);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        totalAccounts,
        totalSent,
        totalReplies,
        replyRate: replyRate.toFixed(1),
        sentToday,
      }),
    };
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error("getStats error:", error);
    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: statusCode === 401 ? "Unauthorized" : "Failed to fetch stats",
        details: error.message,
      }),
    };
  }
};
