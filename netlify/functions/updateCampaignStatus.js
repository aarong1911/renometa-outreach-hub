// netlify/functions/updateCampaignStatus.js
// Update campaign status in Airtable (AUTH via Firebase ID token)

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

    const body = JSON.parse(event.body || "{}");
    const { campaignId, status } = body;

    if (!campaignId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "campaignId is required" }) };
    }
    if (!status || !String(status).trim()) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "status is required" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Security: ensure campaign belongs to user before updating
    const safeUid = escapeAirtableString(uid);

    const existing = await base("Campaigns").find(campaignId);
    const owner = existing.fields?.userId;

    if (!owner || String(owner) !== safeUid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    const now = new Date().toISOString();
    const nextStatus = String(status).trim();

    // Optional timestamps
    const patch = { status: nextStatus };
    if (nextStatus === "running") patch.startedAt = now;
    if (nextStatus === "completed") patch.completedAt = now;

    const updated = await base("Campaigns").update(campaignId, patch, { typecast: true });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        campaign: {
          id: updated.id,
          name: updated.fields?.name || "",
          userId: updated.fields?.userId || uid,
          status: updated.fields?.status || nextStatus,
          sent: Number(updated.fields?.sent || 0),
          opened: Number(updated.fields?.opened || 0),
          replied: Number(updated.fields?.replied || 0),
          createdAt: updated.fields?.createdAt || "",
          startedAt: updated.fields?.startedAt || "",
          completedAt: updated.fields?.completedAt || "",
        },
      }),
    };
  } catch (error) {
    const statusCode = error.statusCode || (error.message?.includes("Missing Authorization") ? 401 : 500);
    console.error("updateCampaignStatus error:", error);

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        error: statusCode === 401 ? "Unauthorized" : "Failed to update campaign",
        details: error.message,
      }),
    };
  }
};
