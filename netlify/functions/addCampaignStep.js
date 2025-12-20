// netlify/functions/addCampaignStep.js
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
    const { campaignId, stepNumber, stepType, delayDays, subject, body, templateId } = JSON.parse(event.body || "{}");

    if (!campaignId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "campaignId is required" }) };
    }
    if (!stepNumber) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "stepNumber is required" }) };
    }
    if (!subject || !body) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "subject and body are required" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Verify campaign ownership
    const campaign = await base("Campaigns").find(campaignId);
    if (campaign.fields.userId !== user.uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    const record = await base("CampaignSteps").create(
      {
        campaignId: [campaignId],
        stepNumber: Number(stepNumber),
        stepType: stepType || "followup",
        delayDays: Number(delayDays || 0),
        subject: String(subject).trim(),
        body: String(body).trim(),
        isActive: true,
        ...(templateId ? { templateId: [templateId] } : {}),
      },
      { typecast: true }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        step: {
          id: record.id,
          campaignId: record.fields.campaignId,
          stepNumber: record.fields.stepNumber,
          stepType: record.fields.stepType,
          delayDays: record.fields.delayDays,
          subject: record.fields.subject,
          body: record.fields.body,
          isActive: record.fields.isActive,
          createdAt: record.fields.createdAt,
        },
      }),
    };
  } catch (error) {
    console.error("addCampaignStep error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to add campaign step", details: error.message }),
    };
  }
};