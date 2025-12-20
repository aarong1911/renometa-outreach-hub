// netlify/functions/getAccounts.js
// Fetch email accounts from Airtable (AUTH via Firebase ID token)

const Airtable = require("airtable");
const admin = require("firebase-admin");

// --- Firebase Admin init (once) ---
function getFirebaseAdmin() {
  if (admin.apps.length) return admin;

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT env var is missing");
  }

  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (sa.private_key && sa.private_key.includes("\\n")) {
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
  });

  return admin;
}

async function requireUser(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization || "";
  const m = authHeader.match(/^Bearer (.+)$/);

  if (!m) {
    const err = new Error("Missing Authorization bearer token");
    err.statusCode = 401;
    throw err;
  }

  const token = m[1];
  const fb = getFirebaseAdmin();
  const decoded = await fb.auth().verifyIdToken(token);

  return { uid: decoded.uid, email: decoded.email || "" };
}

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

    const base = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY,
    }).base(process.env.AIRTABLE_BASE_ID);

    const safeUid = escapeAirtableString(uid);

    const records = await base("Email Accounts")
      .select({
        filterByFormula: `{userId} = '${safeUid}'`,
        sort: [{ field: "createdAt", direction: "desc" }],
      })
      .all();

    const accounts = records.map((record) => {
      const fields = record.fields || {};

      const daysActive = fields.daysActive || 0;
      const startLimit = fields.warmupStartLimit || 3;
      const maxLimit = fields.warmupMaxLimit || 60;
      const currentLimit = fields.currentDailyLimit || startLimit;

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
        warmupEnabled: fields.warmupEnabled || false,
        warmupStartLimit: startLimit,
        warmupDailyIncrement: fields.warmupDailyIncrement || 1,
        warmupMaxLimit: maxLimit,
        daysActive,
        currentDailyLimit: currentLimit,
        sentToday: fields.sentToday || 0,
        repliedToday: fields.repliedToday || 0,
        totalSent: fields.totalSent || 0,
        warmupStage,
        warmupProgress: Math.min(progressPercent, 100),
        createdAt: fields.createdAt || "",
        lastSentAt: fields.lastSentAt || "",
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ accounts }),
    };
  } catch (error) {
    const statusCode = error.statusCode || 500;
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
