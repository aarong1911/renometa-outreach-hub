// netlify/functions/removeAccountFromCampaign.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

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
    const user = await requireUser(event);
    const { campaignId, accountId } = JSON.parse(event.body || "{}");

    if (!campaignId || !accountId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "campaignId and accountId are required" }),
      };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Find the link record
    const allLinks = await base("CampaignAccounts")
      .select({ pageSize: 100 })
      .all();

    const linkToDelete = allLinks.find((r) => {
      if (r.fields.userId !== user.uid) return false;
      const recCampaignId = Array.isArray(r.fields.campaignId) ? r.fields.campaignId[0] : r.fields.campaignId;
      const recAccountId = Array.isArray(r.fields.accountId) ? r.fields.accountId[0] : r.fields.accountId;
      return recCampaignId === campaignId && recAccountId === accountId;
    });

    if (!linkToDelete) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Link not found" }),
      };
    }

    await base("CampaignAccounts").destroy(linkToDelete.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: linkToDelete.id }),
    };
  } catch (error) {
    console.error("removeAccountFromCampaign error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to remove account", details: error.message }),
    };
  }
};