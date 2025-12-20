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

    // Avoid duplicates: find existing link
    // Note: For linked record fields, use ARRAYJOIN to convert array to string for comparison
    const filterByFormula = `AND(
      {userId} = '${escapeFormulaString(user.uid)}',
      ARRAYJOIN({campaignId}) = '${escapeFormulaString(campaignId)}',
      ARRAYJOIN({listId}) = '${escapeFormulaString(listId)}'
    )`;

    const existing = await base("CampaignLeads")
      .select({
        filterByFormula,
        maxRecords: 1,
      })
      .all();

    if (existing.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, alreadyLinked: true, id: existing[0].id }) };
    }

    const created = await base("CampaignLeads").create(
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