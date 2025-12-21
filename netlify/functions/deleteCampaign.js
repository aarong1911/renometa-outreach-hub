// netlify/functions/deleteCampaign.js
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
    const { campaignId } = JSON.parse(event.body || "{}");

    if (!campaignId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "campaignId required" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Verify ownership
    const campaign = await base("Campaigns").find(campaignId);
    if (campaign.fields.userId !== user.uid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden" }) };
    }

    // Delete related records first
    
    // 1. Delete CampaignSteps
    const steps = await base("CampaignSteps").select({ 
      filterByFormula: `ARRAYJOIN({campaignId}) = '${campaignId}'` 
    }).all();
    for (const step of steps) {
      await base("CampaignSteps").destroy(step.id);
    }

    // 2. Delete CampaignAccounts links
    const accountLinks = await base("CampaignAccounts").select({ 
      filterByFormula: `ARRAYJOIN({campaignId}) = '${campaignId}'` 
    }).all();
    for (const link of accountLinks) {
      await base("CampaignAccounts").destroy(link.id);
    }

    // 3. Delete CampaignLists links
    const listLinks = await base("CampaignLists").select({ 
      filterByFormula: `ARRAYJOIN({campaignId}) = '${campaignId}'` 
    }).all();
    for (const link of listLinks) {
      await base("CampaignLists").destroy(link.id);
    }

    // 4. Delete CampaignEvents
    const events = await base("CampaignEvents").select({ 
      filterByFormula: `ARRAYJOIN({campaignId}) = '${campaignId}'` 
    }).all();
    for (const event of events) {
      await base("CampaignEvents").destroy(event.id);
    }

    // 5. Delete CampaignLeads
    const leads = await base("CampaignLeads").select({ 
      filterByFormula: `ARRAYJOIN({campaignId}) = '${campaignId}'` 
    }).all();
    for (const lead of leads) {
      await base("CampaignLeads").destroy(lead.id);
    }

    // Finally, delete the campaign itself
    await base("Campaigns").destroy(campaignId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: campaignId }),
    };
  } catch (error) {
    console.error("deleteCampaign error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to delete campaign", details: error.message }),
    };
  }
};