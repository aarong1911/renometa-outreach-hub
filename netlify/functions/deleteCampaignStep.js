// netlify/functions/deleteCampaignStep.js
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
    const { stepId } = JSON.parse(event.body || "{}");

    if (!stepId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "stepId is required" }),
      };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Get the step to verify it belongs to user's campaign
    const step = await base("CampaignSteps").find(stepId);
    const campaignId = Array.isArray(step.fields.campaignId) ? step.fields.campaignId[0] : step.fields.campaignId;
    
    // Verify campaign ownership
    const campaign = await base("Campaigns").find(campaignId);
    if (campaign.fields.userId !== user.uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    // Delete the step
    await base("CampaignSteps").destroy(stepId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: stepId }),
    };
  } catch (error) {
    console.error("deleteCampaignStep error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to delete step", details: error.message }),
    };
  }
};