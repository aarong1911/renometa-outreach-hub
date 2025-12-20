// netlify/functions/updateCampaignStep.js
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
    const { stepId, stepNumber, stepType, delayDays, subject, body, isActive } = JSON.parse(event.body || "{}");

    if (!stepId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "stepId is required" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Get the step to verify ownership via campaign
    const step = await base("CampaignSteps").find(stepId);
    const campaignIds = Array.isArray(step.fields.campaignId) ? step.fields.campaignId : [step.fields.campaignId];
    
    if (campaignIds.length > 0) {
      const campaign = await base("Campaigns").find(campaignIds[0]);
      if (campaign.fields.userId !== user.uid) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
      }
    }

    const updates = {};
    if (stepNumber !== undefined) updates.stepNumber = Number(stepNumber);
    if (stepType !== undefined) updates.stepType = String(stepType);
    if (delayDays !== undefined) updates.delayDays = Number(delayDays);
    if (subject !== undefined) updates.subject = String(subject).trim();
    if (body !== undefined) updates.body = String(body).trim();
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    const updated = await base("CampaignSteps").update(stepId, updates, { typecast: true });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        step: {
          id: updated.id,
          campaignId: updated.fields.campaignId,
          stepNumber: updated.fields.stepNumber,
          stepType: updated.fields.stepType,
          delayDays: updated.fields.delayDays,
          subject: updated.fields.subject,
          body: updated.fields.body,
          isActive: updated.fields.isActive,
          createdAt: updated.fields.createdAt,
        },
      }),
    };
  } catch (error) {
    console.error("updateCampaignStep error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to update campaign step", details: error.message }),
    };
  }
};