// netlify/functions/createTemplate.js
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
    const { name, subject, body, category } = JSON.parse(event.body || "{}");

    if (!name || !subject || !body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "name, subject, and body are required" }),
      };
    }

    const validCategories = ["cold-outreach", "followup", "warmup"];
    const templateCategory = category && validCategories.includes(category) ? category : "cold-outreach";

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const record = await base("Templates").create(
      {
        userId: user.uid,
        name: String(name).trim(),
        subject: String(subject).trim(),
        body: String(body).trim(),
        category: templateCategory,
      },
      { typecast: true }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        template: {
          id: record.id,
          name: record.fields.name,
          subject: record.fields.subject,
          body: record.fields.body,
          category: record.fields.category,
          createdAt: record.fields.createdAt,
        },
      }),
    };
  } catch (error) {
    console.error("createTemplate error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to create template", details: error.message }),
    };
  }
};