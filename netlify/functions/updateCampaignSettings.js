// netlify/functions/updateCampaignSettings.js
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
    const { campaignId, settings } = JSON.parse(event.body || "{}");

    if (!campaignId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "campaignId required" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Verify ownership
    const campaign = await base("Campaigns").find(campaignId);
    if (campaign.fields.userId !== user.uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    // Build update object with only provided settings
    const updateFields = {};
    
    if (settings.maxEmailsPerDay !== undefined) updateFields.maxEmailsPerDay = Number(settings.maxEmailsPerDay);
    if (settings.minutesBetweenEmails !== undefined) updateFields.minutesBetweenEmails = Number(settings.minutesBetweenEmails);
    if (settings.sendingDays !== undefined) updateFields.sendingDays = settings.sendingDays;
    if (settings.sendingStartHour !== undefined) updateFields.sendingStartHour = Number(settings.sendingStartHour);
    if (settings.sendingEndHour !== undefined) updateFields.sendingEndHour = Number(settings.sendingEndHour);
    if (settings.timezone !== undefined) updateFields.timezone = settings.timezone;
    if (settings.trackOpens !== undefined) updateFields.trackOpens = Boolean(settings.trackOpens);
    if (settings.trackClicks !== undefined) updateFields.trackClicks = Boolean(settings.trackClicks);
    if (settings.stopOnReply !== undefined) updateFields.stopOnReply = Boolean(settings.stopOnReply);
    if (settings.stopOnAutoReply !== undefined) updateFields.stopOnAutoReply = Boolean(settings.stopOnAutoReply);
    if (settings.warmupMode !== undefined) updateFields.warmupMode = Boolean(settings.warmupMode);
    if (settings.maxLeadsPerDay !== undefined) updateFields.maxLeadsPerDay = Number(settings.maxLeadsPerDay);

    const updated = await base("Campaigns").update(campaignId, updateFields);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        campaign: {
          id: updated.id,
          ...updated.fields,
        },
      }),
    };
  } catch (error) {
    console.error("updateCampaignSettings error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to update settings", details: error.message }),
    };
  }
};