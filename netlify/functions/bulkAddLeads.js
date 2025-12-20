// netlify/functions/bulkAddLeads.js
// Bulk add leads to Airtable and attach to a LeadList (AUTH via Firebase ID token)

const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

function escapeFormulaString(value) {
  return String(value || "").replace(/'/g, "\\'");
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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

    if (!listId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "listId is required" }) };
    }
    if (!Array.isArray(leads) || leads.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "No leads provided" }) };
    }

    const importSource = (source || "csv-import").toString();
    const mode = (duplicateAction || "skip").toString(); // skip | update | import

    const cleanedLeads = leads
      .map((l) => {
        const firstName = (l.firstName || "").toString().trim();
        const lastName = (l.lastName || "").toString().trim();

        // If frontend mapped "name", we can split it safely into first/last
        const fullName = (l.name || "").toString().trim();
        let fn = firstName;
        let ln = lastName;
        if ((!fn || !ln) && fullName) {
          const parts = fullName.split(/\s+/).filter(Boolean);
          if (!fn && parts.length) fn = parts[0];
          if (!ln && parts.length > 1) ln = parts.slice(1).join(" ");
        }

        return {
          firstName: fn,
          lastName: ln,
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
          notes: (l.notes || "").toString().trim(),
          status: (l.status || "new").toString(),
        };
      })
      .filter((l) => l.email); // email required

    if (cleanedLeads.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "No valid leads (email required)" }) };
    }

    Airtable.configure({ apiKey: process.env.AIRTABLE_API_KEY });
    const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

    // Fetch existing records by email (only for emails being imported)
    const emailToExisting = new Map(); // email -> { id, listIds: [] }
    const emailChunks = chunk(
      Array.from(new Set(cleanedLeads.map((l) => l.email))).filter(Boolean),
      40
    );

    for (const emails of emailChunks) {
      const orParts = emails.map((e) => `{email} = '${escapeFormulaString(e)}'`).join(", ");
      const filterByFormula = `AND({userId} = '${escapeFormulaString(user.uid)}', OR(${orParts}))`;

      // eslint-disable-next-line no-await-in-loop
      const existing = await base("Leads")
        .select({
          filterByFormula,
          fields: ["email", "listId"],
          maxRecords: 1000,
        })
        .all();

      existing.forEach((r) => {
        const f = r.fields || {};
        const email = (f.email || "").toString().toLowerCase();
        if (!email) return;

        const existingList = Array.isArray(f.listId) ? f.listId : [];
        emailToExisting.set(email, { id: r.id, listIds: existingList });
      });
    }

    const now = new Date().toISOString();

    const toCreate = [];
    const toUpdate = [];
    let skipped = 0;

    for (const lead of cleanedLeads) {
      const existing = emailToExisting.get(lead.email);

      if (existing) {
        if (mode === "skip") {
          skipped++;
          continue;
        }

        if (mode === "update") {
          const nextListIds = Array.from(new Set([...(existing.listIds || []), listId]));
          toUpdate.push({
            id: existing.id,
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
              notes: lead.notes || "",
              status: lead.status || "new",
              source: importSource,
              userId: user.uid,
              listId: nextListIds, // keep old + add new list
            },
          });
          continue;
        }

        // mode === "import" => allow duplicates, create new record
      }

      toCreate.push({
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
          notes: lead.notes || "",
          status: lead.status || "new",
          source: importSource,
          userId: user.uid,
          createdAt: now,
          // Linked record field -> array of record IDs
          listId: [listId],
        },
      });
    }

    const createdIds = [];
    const updatedIds = [];

    // Airtable API max batch size = 10
    for (const batch of chunk(toCreate, 10)) {
      // eslint-disable-next-line no-await-in-loop
      const created = await base("Leads").create(batch, { typecast: true });
      created.forEach((r) => createdIds.push(r.id));
    }

    for (const batch of chunk(toUpdate, 10)) {
      // eslint-disable-next-line no-await-in-loop
      const updated = await base("Leads").update(batch, { typecast: true });
      updated.forEach((r) => updatedIds.push(r.id));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        imported: createdIds.length,
        updated: updatedIds.length,
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
