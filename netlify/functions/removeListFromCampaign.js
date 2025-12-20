// netlify/functions/removeListFromCampaign.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

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

    const links = await base("CampaignLeads")
      .select({
        filterByFormula: `AND({userId}='${user.uid}', ARRAYJOIN({campaignId})='${campaignId}', ARRAYJOIN({listId})='${listId}')`,
        maxRecords: 10,
      })
      .all();

    if (!links.length) return { statusCode: 200, headers, body: JSON.stringify({ success: true, removed: 0 }) };

    await base("CampaignLeads").destroy(links.map((l) => l.id));

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, removed: links.length }) };
  } catch (error) {
    console.error("removeListFromCampaign error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to remove list", details: error.message }) };
  }
};
