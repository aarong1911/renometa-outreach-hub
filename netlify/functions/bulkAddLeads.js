// netlify/functions/bulkAddLeads.js
// Bulk add leads from CSV to Airtable

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

    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (err) {
      console.error("bulkAddLeads: JSON parse error:", err, "body:", event.body);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid JSON payload" }),
      };
    }

    const { userId, leads, listId } = payload;

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "User ID is required" }),
      };
    }

    if (!Array.isArray(leads) || leads.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No leads provided" }),
      };
    }

    // Basic validation + cleanup
    const cleanedLeads = leads
      .map((l) => ({
        firstName: (l.firstName || "").trim(),
        lastName: (l.lastName || "").trim(),
        email: (l.email || "").trim(),
        company: (l.company || "").trim(),
        phone: (l.phone || "").trim(),
        website: (l.website || "").trim(),
        address: (l.address || "").trim(),
        city: (l.city || "").trim(),
        state: (l.state || "").trim(),
        zip: (l.zip || "").trim(),
        type: (l.type || "").trim(),
        rating: parseFloat(l.rating) || 0,
        reviews: parseInt(l.reviews) || 0,
        listId: listId || (l.listId || "").trim(),
      }))
      .filter((l) => l.firstName && l.email); // require firstName + email

    if (cleanedLeads.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "No valid leads (first name + email required)" }),
      };
    }

    Airtable.configure({
      apiKey: process.env.AIRTABLE_API_KEY,
    });

    const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

    // Airtable limit: max 10 records per .create() call
    const chunkSize = 10;
    const createdRecords = [];

    for (let i = 0; i < cleanedLeads.length; i += chunkSize) {
      const chunk = cleanedLeads.slice(i, i + chunkSize);

      const recordsToCreate = chunk.map((lead) => ({
        fields: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          company: lead.company || "",
          phone: lead.phone || "",
          website: lead.website || "",
          address: lead.address || "",
          city: lead.city || "",
          state: lead.state || "",
          zip: lead.zip || "",
          type: lead.type || "",
          rating: lead.rating || 0,
          reviews: lead.reviews || 0,
          status: "new",
          source: "csv-import", // Options: manual, csv-import, excel-import, gsheet-import, api
          listId: lead.listId || "",
          userId,
        },
      }));

      // eslint-disable-next-line no-await-in-loop
      const created = await base("Leads").create(recordsToCreate, {
        typecast: true,
      });

      createdRecords.push(...created);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        imported: createdRecords.length,
      }),
    };
  } catch (error) {
    console.error("Error bulk adding leads:", error);

    const details =
      (error && error.response && error.response.body) ||
      error.message ||
      "Unknown error";

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to bulk add leads",
        details,
      }),
    };
  }
};