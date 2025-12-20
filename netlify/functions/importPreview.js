// netlify/functions/importPreview.js
// Parse CSV/XLSX and return headers + preview rows for mapping (AUTH via Firebase token)

const Airtable = require("airtable");
const XLSX = require("xlsx");
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

    const body = JSON.parse(event.body || "{}");
    const { fileType, fileContent, fileContentBase64, fullExport } = body;

    if (!fileType) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "fileType is required (csv|xlsx)" }) };
    }

    let rawHeaders = [];
    let allRows = []; // array of objects keyed by headers (same shape as sampleRows)

    if (fileType === "csv") {
      if (!fileContent) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "fileContent is required for csv" }) };
      }

      // Simple CSV parsing (matches your existing approach)
      const lines = String(fileContent)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (!lines.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "File is empty" }) };
      }

      rawHeaders = lines[0]
        .split(",")
        .map((h) => h.trim().replace(/['"]/g, ""))
        .filter(Boolean);

      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(",").map((c) => c.trim().replace(/['"]/g, ""));
        const rowObj = {};
        rawHeaders.forEach((h, idx) => (rowObj[h] = cells[idx] ?? ""));
        allRows.push(rowObj);
      }
    } else if (fileType === "xlsx") {
      if (!fileContentBase64) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "fileContentBase64 is required for xlsx" }) };
      }

      const buf = Buffer.from(String(fileContentBase64), "base64");
      const workbook = XLSX.read(buf, { type: "buffer" });

      const firstSheetName = workbook.SheetNames?.[0];
      if (!firstSheetName) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "No sheets found in XLSX" }) };
      }

      const sheet = workbook.Sheets[firstSheetName];

      // Get rows as arrays
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      if (!rows.length) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Sheet is empty" }) };
      }

      rawHeaders = (rows[0] || []).map((h) => String(h || "").trim()).filter(Boolean);

      for (let i = 1; i < rows.length; i++) {
        const arr = rows[i] || [];
        const rowObj = {};
        rawHeaders.forEach((h, idx) => (rowObj[h] = arr[idx] ?? ""));
        allRows.push(rowObj);
      }
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Unsupported fileType. Use csv or xlsx." }) };
    }

    // Auto-suggest field mappings
    const suggestedMapping = autoMapHeaders(rawHeaders);

    // Existing emails for duplicate detection
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const existingRecords = await base("Leads")
      .select({
        filterByFormula: `{userId}='${user.uid}'`,
        fields: ["email"],
      })
      .all();

    const existingEmails = new Set(existingRecords.map((r) => (r.fields.email || "").toString().toLowerCase()));

    // Preview (first 20)
    const sampleRows = allRows.slice(0, 20);

    // Validate
    const validation = validateRows(sampleRows, suggestedMapping, existingEmails);

    const resp = {
      headers: rawHeaders,
      sampleRows,
      suggestedMapping,
      totalRows: allRows.length,
      validation,
      existingEmailCount: existingEmails.size,
    };

    // If fullExport requested (used by LeadsImport XLSX path), return all rows
    if (fullExport) {
      resp.allRows = allRows;
    }

    return { statusCode: 200, headers, body: JSON.stringify(resp) };
  } catch (error) {
    console.error("importPreview error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to preview import", details: error.message }),
    };
  }
};

// Auto-map headers to standard fields
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

  const emailColumn = Object.keys(mapping).find((key) => mapping[key] === "email");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  rows.forEach((row, index) => {
    const email = emailColumn ? (row[emailColumn] || "").toString().toLowerCase().trim() : "";

    if (!email) {
      invalidEmailCount++;
      errors.push({ row: index + 2, error: "Missing email" });
      return;
    }
    if (!emailRegex.test(email)) {
      invalidEmailCount++;
      errors.push({ row: index + 2, error: "Invalid email format" });
      return;
    }
    if (existingEmails.has(email)) {
      duplicateCount++;
      errors.push({ row: index + 2, error: "Duplicate email (already in system)" });
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
