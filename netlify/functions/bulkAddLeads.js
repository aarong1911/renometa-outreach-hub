// netlify/functions/bulkAddLeads.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

function escapeAirtableString(value) {
  return String(value || "").replace(/'/g, "\\'");
}

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
    const payload = JSON.parse(event.body || "{}");
    const { leads, listId, source, duplicateAction } = payload;

    if (!listId) return { statusCode: 400, headers, body: JSON.stringify({ error: "listId is required" }) };
    if (!Array.isArray(leads) || leads.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "No leads provided" }) };
    }

    const action = (duplicateAction || "skip").toString(); // skip | update | import
    const importSource = (source || "csv-import").toString();

    Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
    const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

    // Normalize leads
    const cleaned = leads
      .map((l) => ({
        firstName: (l.firstName || "").toString().trim(),
        lastName: (l.lastName || "").toString().trim(),
        name: (l.name || "").toString().trim(),
        email: (l.email || "").toString().trim().toLowerCase(),
        company: (l.company || "").toString().trim(),
        phone: (l.phone || "").toString().trim(),
        website: (l.website || "").toString().trim(),
        address: (l.address || "").toString().trim(),
        city: (l.city || "").toString().trim(),
        state: (l.state || "").toString().trim(),
        zip: (l.zip || "").toString().trim(),
        type: (l.type || "").toString().trim(),
        rating: Number.parseFloat(l.rating) || 0,
        reviews: Number.parseInt(l.reviews, 10) || 0,
      }))
      .filter((l) => l.email);

    if (!cleaned.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "No valid leads (email required)" }) };
    }

    // For duplicate handling, build email->recordId map of existing leads for this user
    const existingRecords = await base("Leads")
      .select({
        filterByFormula: `{userId} = '${escapeAirtableString(user.uid)}'`,
        fields: ["email"],
      })
      .all();

    const existingMap = new Map();
    for (const r of existingRecords) {
      const email = r.fields?.email ? String(r.fields.email).toLowerCase().trim() : "";
      if (email) existingMap.set(email, r.id);
    }

    let toCreate = [];
    let toUpdate = [];
    let skipped = 0;

    for (const lead of cleaned) {
      const existingId = existingMap.get(lead.email);

      if (existingId) {
        if (action === "import") {
          // import anyway -> create duplicate record
          toCreate.push(lead);
        } else if (action === "update") {
          toUpdate.push({ id: existingId, lead });
        } else {
          skipped++;
        }
      } else {
        toCreate.push(lead);
      }
    }

    const chunkSize = 10; // Airtable max
    let imported = 0;
    let updated = 0;
    const createdIds = [];
    const updatedIds = [];

    // CREATE
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);

      const recordsToCreate = chunk.map((lead) => ({
        fields: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          name: lead.name,
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
          source: importSource,
          userId: user.uid,
          listId: [listId], // linked record
        },
      }));

      // eslint-disable-next-line no-await-in-loop
      const created = await base("Leads").create(recordsToCreate, { typecast: true });
      created.forEach((r) => createdIds.push(r.id));
      imported += created.length;
    }

    // UPDATE
    for (let i = 0; i < toUpdate.length; i += chunkSize) {
      const chunk = toUpdate.slice(i, i + chunkSize);

      const updates = chunk.map((x) => ({
        id: x.id,
        fields: {
          firstName: x.lead.firstName,
          lastName: x.lead.lastName,
          name: x.lead.name,
          company: x.lead.company || "",
          phone: x.lead.phone || "",
          website: x.lead.website || "",
          address: x.lead.address || "",
          city: x.lead.city || "",
          state: x.lead.state || "",
          zip: x.lead.zip || "",
          type: x.lead.type || "",
          rating: x.lead.rating || 0,
          reviews: x.lead.reviews || 0,
          // keep status, but update source and attach list:
          source: importSource,
          listId: [listId],
        },
      }));

      // eslint-disable-next-line no-await-in-loop
      const upd = await base("Leads").update(updates, { typecast: true });
      upd.forEach((r) => updatedIds.push(r.id));
      updated += upd.length;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        imported,
        updated,
        skipped,
        leadIds: createdIds,
        updatedIds,
      }),
    };
  } catch (error) {
    console.error("bulkAddLeads error:", error);
    const details = error?.response?.body || error.message || "Unknown error";
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to bulk add leads", details }),
    };
  }
};
