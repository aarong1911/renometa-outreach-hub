// netlify/functions/getCampaignSteps.js
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

    const filterByFormula = `ARRAYJOIN({campaignId}) = '${escapeFormulaString(campaignId)}'`;

    const records = await base("CampaignSteps")
      .select({
        filterByFormula,
        sort: [{ field: "stepNumber", direction: "asc" }],
      })
      .all();

    const steps = records.map((r) => ({
      id: r.id,
      campaignId: r.fields.campaignId,
      stepNumber: r.fields.stepNumber || 0,
      stepType: r.fields.stepType || "followup",
      delayDays: r.fields.delayDays || 0,
      subject: r.fields.subject || "",
      body: r.fields.body || "",
      templateId: r.fields.templateId || null,
      isActive: r.fields.isActive !== false,
      createdAt: r.fields.createdAt || "",
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ steps }),
    };
  } catch (error) {
    console.error("getCampaignSteps error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch campaign steps", details: error.message }),
    };
  }
};