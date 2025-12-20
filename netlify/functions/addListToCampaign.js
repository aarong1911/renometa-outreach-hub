// netlify/functions/addListToCampaign.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

function escapeFormulaString(value) {
  return String(value || "").replace(/'/g, "\\'");
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const user = await requireUser(event);
    const { campaignId, listId } = JSON.parse(event.body || "{}");

    if (!campaignId) return { statusCode: 400, headers, body: JSON.stringify({ error: "campaignId is required" }) };
    if (!listId) return { statusCode: 400, headers, body: JSON.stringify({ error: "listId is required" }) };

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Check for existing link - fetch all records for this user
    const allRecords = await base("CampaignLists")
      .select({
        filterByFormula: `{userId} = '${escapeFormulaString(user.uid)}'`,
        maxRecords: 100,
      })
      .all();

    // Check for existing link manually
    const existing = allRecords.find((r) => {
      const recCampaignId = Array.isArray(r.fields.campaignId) ? r.fields.campaignId[0] : r.fields.campaignId;
      const recListId = Array.isArray(r.fields.listId) ? r.fields.listId[0] : r.fields.listId;
      return recCampaignId === campaignId && recListId === listId;
    });

    if (existing) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, alreadyLinked: true, id: existing.id }) };
    }

    // Create new link
    const created = await base("CampaignLists").create(
      {
        userId: user.uid,
        campaignId: [campaignId],
        listId: [listId],
      },
      { typecast: true }
    );

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, id: created.id, createdAt: created.fields.createdAt }) };
  } catch (error) {
    console.error("addListToCampaign error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to link list", details: error.message }) };
  }
};