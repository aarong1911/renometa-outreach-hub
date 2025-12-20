// netlify/functions/updateCampaignStatus.js
// Update campaign status (AUTH via Firebase ID token)

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
  const token = m[1];
  const fb = getFirebaseAdmin();
  const decoded = await fb.auth().verifyIdToken(token);
  return { uid: decoded.uid, email: decoded.email || "" };
}

const normalizeStatus = (s) => {
  const v = String(s || "").toLowerCase();
  if (v === "running") return "running";
  if (v === "paused") return "paused";
  if (v === "completed") return "completed";
  return "draft";
};

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

    const body = JSON.parse(event.body || "{}");
    const campaignId = (body.campaignId || "").toString().trim();
    const nextStatus = normalizeStatus(body.status);

    if (!campaignId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "campaignId is required" }) };
    }
    if (!["draft", "running", "paused", "completed"].includes(nextStatus)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid status" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Load campaign
    const record = await base("Campaigns").find(campaignId);
    const f = record.fields || {};

    // Ownership check
    if ((f.userId || "") !== uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    const now = new Date().toISOString();

    const updates = { status: nextStatus };

    // timestamp rules
    if (nextStatus === "running") {
      // set startedAt once
      if (!f.startedAt) updates.startedAt = now;
      // if restarting after completion (optional): you can clear completedAt if you want
      // updates.completedAt = "";
    }

    if (nextStatus === "completed") {
      updates.completedAt = now;
      if (!f.startedAt) updates.startedAt = now;
    }

    // paused/draft: keep timestamps as-is

    const updated = await base("Campaigns").update(campaignId, updates, { typecast: true });
    const uf = updated.fields || {};

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        campaign: {
          id: updated.id,
          name: uf.name || "",
          userId: uf.userId || uid,
          status: uf.status || nextStatus,
          sent: uf.sent || 0,
          opened: uf.opened || 0,
          replied: uf.replied || 0,
          createdAt: uf.createdAt || "",
          startedAt: uf.startedAt || "",
          completedAt: uf.completedAt || "",
        },
      }),
    };
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error("updateCampaignStatus error:", error);

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: statusCode === 401 ? "Unauthorized" : "Failed to update campaign status",
        details: error.message,
      }),
    };
  }
};
