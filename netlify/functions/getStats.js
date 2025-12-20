// netlify/functions/getStats.js
// Calculate stats from Airtable (AUTH via Firebase ID token)

const Airtable = require("airtable");
const admin = require("firebase-admin");

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

  const fb = getFirebaseAdmin();
  const decoded = await fb.auth().verifyIdToken(m[1]);
  return { uid: decoded.uid };
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
    const safeUid = escapeAirtableString(uid);

    const base = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY,
    }).base(process.env.AIRTABLE_BASE_ID);

    // Fetch in parallel
    const [accounts, logs, replies] = await Promise.all([
      base("Email Accounts").select({ filterByFormula: `{userId} = '${safeUid}'` }).all(),
      base("Email Logs").select({ filterByFormula: `{userId} = '${safeUid}'` }).all(),
      base("Warmup Replies").select({ filterByFormula: `{userId} = '${safeUid}'` }).all(),
    ]);

    const totalAccounts = accounts.length;
    const totalSent = logs.length;
    const totalReplies = replies.length;

    const replyRate =
      totalSent > 0 ? Math.min((totalReplies / totalSent) * 100, 100) : 0;

    const sentToday = accounts.reduce(
      (sum, r) => sum + (r.fields?.sentToday || 0),
      0
    );

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
