// netlify/functions/addAccountToCampaign.js
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

    // Verify campaign ownership
    const campaign = await base("Campaigns").find(campaignId);
    if (campaign.fields.userId !== user.uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    // Verify account ownership
    const account = await base("Email Accounts").find(accountId);
    if (account.fields.userId !== user.uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    // Check if already linked
    const filterByFormula = `AND(
      {userId} = '${escapeFormulaString(user.uid)}',
      ARRAYJOIN({campaignId}) = '${escapeFormulaString(campaignId)}',
      ARRAYJOIN({accountId}) = '${escapeFormulaString(accountId)}'
    )`;

    const existing = await base("CampaignAccounts")
      .select({ filterByFormula, maxRecords: 1 })
      .all();

    if (existing.length > 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, alreadyLinked: true, id: existing[0].id }),
      };
    }

    const record = await base("CampaignAccounts").create(
      {
        campaignId: [campaignId],
        accountId: [accountId],
        userId: user.uid,
      },
      { typecast: true }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        id: record.id,
        createdAt: record.fields.createdAt,
      }),
    };
  } catch (error) {
    console.error("addAccountToCampaign error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to add account to campaign", details: error.message }),
    };
  }
};