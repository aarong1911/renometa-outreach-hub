// netlify/functions/getCampaignAccounts.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

function escapeFormulaString(value) {
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
    const user = await requireUser(event);
    const campaignId = event.queryStringParameters?.campaignId || "";

    if (!campaignId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "campaignId is required" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Verify campaign ownership
    const campaign = await base("Campaigns").find(campaignId);
    if (campaign.fields.userId !== user.uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    const filterByFormula = `AND(
      {userId} = '${escapeFormulaString(user.uid)}',
      ARRAYJOIN({campaignId}) = '${escapeFormulaString(campaignId)}'
    )`;

    const links = await base("CampaignAccounts")
      .select({ filterByFormula })
      .all();

    // Get account IDs
    const accountIds = links
      .map((r) => (Array.isArray(r.fields.accountId) ? r.fields.accountId[0] : r.fields.accountId))
      .filter(Boolean);

    // Fetch account details
    const accounts = [];
    for (const id of accountIds) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const rec = await base("Email Accounts").find(id);
        accounts.push({
          id: rec.id,
          email: rec.fields.email || "",
          provider: rec.fields.provider || "",
          status: rec.fields.status || "",
          currentDailyLimit: rec.fields.currentDailyLimit || 0,
          sentToday: rec.fields.sentToday || 0,
        });
      } catch (err) {
        console.error(`Error fetching account ${id}:`, err);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ accounts, count: accounts.length }),
    };
  } catch (error) {
    console.error("getCampaignAccounts error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch campaign accounts", details: error.message }),
    };
  }
};