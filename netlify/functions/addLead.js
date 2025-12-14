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
    // Make sure we have a body
    if (!event.body) {
      console.error("addLead: missing event.body");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Request body is required" }),
      };
    }

    // Parse JSON safely
    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (err) {
      console.error("addLead: JSON parse error:", err, "raw body:", event.body);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON payload" }),
      };
    }

    console.log("addLead payload:", payload);

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

    // Configure Airtable
    Airtable.configure({
      apiKey: process.env.AIRTABLE_API_KEY,
    });

    const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

    console.log("addLead: creating record in Leads for userId:", userId);

    // Create new lead in the "Leads" table
    const record = await base("Leads").create(
      {
        name,
        email,
        company: company || "",
        status: "new",
        source: "manual",
        userId,
        // createdAt can be a "Created time" field in Airtable, no need to send explicitly
      },
      { typecast: true } // let Airtable coerce into select/text if needed
    );

    console.log("addLead: created record", record.id, record.fields);

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
