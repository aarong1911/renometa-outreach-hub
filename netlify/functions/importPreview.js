// netlify/functions/importPreview.js
// Preview import: accepts CSV text OR (headers + sampleRows)
// Auth via Firebase ID token

const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

function autoMapHeaders(headers) {
  const mapping = {};

  const synonyms = {
    email: ["email", "e-mail", "mail", "email address", "e_mail"],
    firstName: ["first", "firstname", "first_name", "first name", "fname"],
    lastName: ["last", "lastname", "last_name", "last name", "lname"],
    name: ["name", "full name", "fullname", "full_name", "contact name"],
    company: ["company", "business", "org", "organization", "company name"],
    phone: ["phone", "tel", "mobile", "telephone", "phone number"],
    website: ["site", "website", "url", "web", "domain"],
    address: ["address", "street", "location"],
    city: ["city", "town"],
    state: ["state", "province", "region"],
    zip: ["zip", "postal", "postcode", "zipcode", "postal code"],
    type: ["industry", "type", "category", "sector"],
    rating: ["rating", "stars", "score"],
    reviews: ["reviews", "review_count", "review count", "total reviews"],
    notes: ["notes", "note", "comments", "comment"],
  };

  headers.forEach((header) => {
    const normalized = header.toLowerCase().trim().replace(/[_-]/g, " ");
    let mapped = false;

    for (const [field, patterns] of Object.entries(synonyms)) {
      if (patterns.some((p) => normalized === p || normalized.includes(p))) {
        mapping[header] = field;
        mapped = true;
        break;
      }
    }

    if (!mapped) mapping[header] = "custom";
  });

  return mapping;
}

function validateRows(rows, mapping, existingEmails) {
  let validCount = 0;
  let invalidEmailCount = 0;
  let duplicateCount = 0;
  const errors = [];

  const emailColumn = Object.keys(mapping).find((k) => mapping[k] === "email");

  rows.forEach((row, idx) => {
    const rawEmail = emailColumn ? row?.[emailColumn] : "";
    const email = String(rawEmail || "").trim().toLowerCase();

    if (!email) {
      invalidEmailCount++;
      errors.push({ row: idx + 2, error: "Missing email" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      invalidEmailCount++;
      errors.push({ row: idx + 2, error: "Invalid email format" });
      return;
    }

    if (existingEmails.has(email)) {
      duplicateCount++;
      errors.push({ row: idx + 2, error: "Duplicate email (already in system)" });
      return;
    }

    validCount++;
  });

  return {
    validCount,
    invalidEmailCount,
    duplicateCount,
    errors: errors.slice(0, 10),
    totalErrors: errors.length,
  };
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
    const uid = user.uid;

    const { fileType, fileContent, headers: inputHeaders, sampleRows: inputSampleRows, totalRows: inputTotalRows } =
      JSON.parse(event.body || "{}");

    let parsedHeaders = [];
    let sampleRows = [];
    let totalRows = 0;

    if (fileType === "csv") {
      if (!fileContent) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "fileContent is required for CSV" }) };
      }

      const lines = String(fileContent).split("\n").filter((line) => line.trim());
      if (!lines.length) return { statusCode: 400, headers, body: JSON.stringify({ error: "File is empty" }) };

      parsedHeaders = lines[0].split(",").map((h) => h.trim().replace(/['"]/g, ""));
      totalRows = Math.max(0, lines.length - 1);

      const maxPreview = Math.min(20, totalRows);
      for (let i = 1; i <= maxPreview; i++) {
        const row = lines[i].split(",").map((c) => c.trim().replace(/['"]/g, ""));
        const obj = {};
        parsedHeaders.forEach((h, idx) => (obj[h] = row[idx] || ""));
        sampleRows.push(obj);
      }
    } else {
      // XLSX preview (or any client-parsed source): headers + sampleRows are provided directly
      if (!Array.isArray(inputHeaders) || inputHeaders.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "headers[] is required" }) };
      }
      if (!Array.isArray(inputSampleRows)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "sampleRows[] is required" }) };
      }

      parsedHeaders = inputHeaders.map((h) => String(h || "").trim()).filter(Boolean);
      sampleRows = inputSampleRows.slice(0, 20);
      totalRows = Number(inputTotalRows || inputSampleRows.length || 0);
    }

    const suggestedMapping = autoMapHeaders(parsedHeaders);

    // Existing emails for this user (duplicate detection)
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const existingRecords = await base("Leads")
      .select({
        filterByFormula: `{userId} = '${String(uid).replace(/'/g, "\\'")}'`,
        fields: ["email"],
      })
      .all();

    const existingEmails = new Set(
      existingRecords.map((r) => String(r.fields.email || "").toLowerCase()).filter(Boolean)
    );

    const validation = validateRows(sampleRows, suggestedMapping, existingEmails);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        headers: parsedHeaders,
        sampleRows,
        suggestedMapping,
        totalRows,
        validation,
        existingEmailCount: existingEmails.size,
      }),
    };
  } catch (error) {
    console.error("importPreview error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to preview import", details: error.message }),
    };
  }
};
