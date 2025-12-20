// netlify/functions/getAccounts.js
// Fetches email accounts from Airtable (AUTH via Firebase ID token)

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

    const records = await base("Email Accounts")
      .select({
        filterByFormula: `{userId} = '${safeUid}'`,
        sort: [{ field: "createdAt", direction: "desc" }],
      })
      .all();

    const accounts = records.map((record) => {
      const fields = record.fields || {};

      const daysActive = Number(fields.daysActive || 0);
      const startLimit = Number(fields.warmupStartLimit || 3);
      const maxLimit = Number(fields.warmupMaxLimit || 60);
      const currentLimit = Number(fields.currentDailyLimit || startLimit);

      const progressPercent = maxLimit > 0 ? (currentLimit / maxLimit) * 100 : 0;
      let warmupStage = 1;
      if (progressPercent >= 80) warmupStage = 5;
      else if (progressPercent >= 60) warmupStage = 4;
      else if (progressPercent >= 40) warmupStage = 3;
      else if (progressPercent >= 20) warmupStage = 2;

      return {
        id: record.id,
        email: fields.email || "",
        provider: fields.provider || "",
        type: fields.type || "",
        status: fields.status || "",
        warmupEnabled: Boolean(fields.warmupEnabled || false),
        warmupStartLimit: startLimit,
        warmupDailyIncrement: Number(fields.warmupDailyIncrement || 1),
        warmupMaxLimit: maxLimit,
        daysActive,
        currentDailyLimit: currentLimit,
        sentToday: Number(fields.sentToday || 0),
        repliedToday: Number(fields.repliedToday || 0),
        totalSent: Number(fields.totalSent || 0),
        warmupStage,
        warmupProgress: Math.min(progressPercent, 100),
        createdAt: fields.createdAt || "",
        lastSentAt: fields.lastSentAt || "",
      };
    });

    return { statusCode: 200, headers, body: JSON.stringify({ accounts }) };
  } catch (error) {
    const statusCode = error.statusCode || (error.message?.includes("Missing Authorization") ? 401 : 500);
    console.error("getAccounts error:", error);

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: statusCode === 401 ? "Unauthorized" : "Failed to fetch accounts",
        details: error.message,
      }),
    };
  }
};
