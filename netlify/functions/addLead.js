// netlify/functions/addLead.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    const user = await requireUser(event);
    const { firstName, lastName, email, company, listId } = JSON.parse(event.body || "{}");

    if (!firstName || !email) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "First name and email are required" }) };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const record = await base("Leads").create(
      {
        firstName: String(firstName).trim(),
        lastName: (lastName || "").toString().trim(),
        email: String(email).trim().toLowerCase(),
        company: (company || "").toString().trim(),
        status: "new",
        source: "manual",
        userId: user.uid,
        ...(listId ? { listId: [listId] } : {}),
      },
      { typecast: true }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        lead: {
          id: record.id,
          firstName: record.fields.firstName,
          lastName: record.fields.lastName,
          email: record.fields.email,
          company: record.fields.company,
          createdAt: record.fields.createdAt,
        },
      }),
    };
  } catch (error) {
    console.error("addLead error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to add lead", details: error.message }) };
  }
};