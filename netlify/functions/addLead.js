// netlify/functions/addLead.js
// Add a new lead to Airtable

const Airtable = require("airtable");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Request body is required" }),
      };
    }

    // Parse JSON body
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (err) {
      console.error("JSON parse error in addLead:", err, "body:", event.body);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON payload" }),
      };
    }

    const { name, email, company, userId } = payload;

    // Validate required fields
    if (!name || !email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Name and email are required" }),
      };
    }

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "User ID is required" }),
      };
    }

    // Init Airtable base
    const base = new Airtable({
      apiKey: process.env.AIRTABLE_API_KEY,
    }).base(process.env.AIRTABLE_BASE_ID);

    // Create new lead in the "Leads" table
    const record = await base("Leads").create({
      name,
      email,
      company: company || "",
      status: "new",
      source: "manual",
      userId,
      // createdAt can be an Airtable "Created time" field;
      // no need to send it explicitly unless you want a custom value
    });

    // Build response object
    const fields = record.fields;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        lead: {
          id: record.id,
          name: fields.name,
          email: fields.email,
          company: fields.company || "",
          status: fields.status || "new",
          source: fields.source || "manual",
          userId: fields.userId,
          createdAt: fields.createdAt || null,
          notes: fields.notes || "",
        },
      }),
    };
  } catch (error) {
    console.error("Error adding lead:", error);

    const details =
      (error && error.response && error.response.body) ||
      error.message ||
      "Unknown error";

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to add lead",
        details,
      }),
    };
  }
};
