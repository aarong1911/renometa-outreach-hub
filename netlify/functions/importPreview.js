// netlify/functions/importPreview.js
// Generate preview + suggested mapping + validation (duplicates checked against Airtable)

const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");

exports.handler = async (event) => {
  const headersOut = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: headersOut, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: headersOut, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const user = await requireUser(event);
    const body = JSON.parse(event.body || "{}");

    // Accept either:
    // - { headers: string[], rows: object[] }
    // - { fileType: "csv", fileContent: "..." }
    const inputHeaders = Array.isArray(body.headers) ? body.headers : null;
    const inputRows = Array.isArray(body.rows) ? body.rows : null;

    let headers = [];
    let rows = [];

    if (inputHeaders && inputRows) {
      headers = inputHeaders.map((h) => String(h || "").trim()).filter(Boolean);
      rows = inputRows.map((r) => r || {});
    } else if (body.fileType === "csv" && typeof body.fileContent === "string") {
      const parsed = parseCsvToObjects(body.fileContent);
      headers = parsed.headers;
      rows = parsed.rows;
    } else {
      return {
        statusCode: 400,
        headers: headersOut,
        body: JSON.stringify({ error: "Provide {headers, rows} or {fileType:'csv', fileContent}" }),
      };
    }

    if (!headers.length) {
      return { statusCode: 200, headers: headersOut, body: JSON.stringify({ headers: [], sampleRows: [], suggestedMapping: {}, totalRows: 0, validation: emptyValidation() }) };
    }

    const suggestedMapping = autoMapHeaders(headers);

    const sampleRows = rows.slice(0, 20).map((r) => normalizeRowObject(r, headers));
    const totalRows = rows.length;

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    // Fetch existing emails for this user (for duplicate detection)
    const records = await base("Leads")
      .select({
        filterByFormula: `{userId} = '${escapeAirtableString(user.uid)}'`,
        fields: ["email"],
      })
      .all();

    const existingEmails = new Set(
      records
        .map((r) => (r.fields?.email ? String(r.fields.email).toLowerCase().trim() : ""))
        .filter(Boolean)
    );

    // validate all rows (cap to avoid huge payload performance issues)
    const MAX_VALIDATE = 10000;
    const rowsToValidate = rows.slice(0, MAX_VALIDATE).map((r) => normalizeRowObject(r, headers));
    const validation = validateRows(rowsToValidate, suggestedMapping, existingEmails);

    const defaultListName =
      typeof body.defaultListName === "string" && body.defaultListName.trim()
        ? body.defaultListName.trim()
        : undefined;

    return {
      statusCode: 200,
      headers: headersOut,
      body: JSON.stringify({
        headers,
        sampleRows,
        suggestedMapping,
        totalRows,
        validation,
        defaultListName,
      }),
    };
  } catch (error) {
    console.error("importPreview error:", error);
    return {
      statusCode: 500,
      headers: headersOut,
      body: JSON.stringify({ error: "Failed to preview import", details: error.message }),
    };
  }
};

function emptyValidation() {
  return { validCount: 0, invalidEmailCount: 0, duplicateCount: 0, errors: [], totalErrors: 0 };
}

function escapeAirtableString(value) {
  return String(value || "").replace(/'/g, "\\'");
}

function normalizeRowObject(row, headers) {
  const obj = {};
  headers.forEach((h) => {
    obj[h] = row?.[h] ?? "";
  });
  return obj;
}

// Robust-ish CSV parser (quoted commas supported)
function parseCsvToObjects(csvText) {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    const nonEmpty = row.some((c) => String(c ?? "").trim() !== "");
    if (nonEmpty) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (c === ",") {
      pushField();
      i++;
      continue;
    }

    if (c === "\r") {
      if (text[i + 1] === "\n") i++;
      pushField();
      pushRow();
      i++;
      continue;
    }

    if (c === "\n") {
      pushField();
      pushRow();
      i++;
      continue;
    }

    field += c;
    i++;
  }

  pushField();
  pushRow();

  if (!rows.length) return { headers: [], rows: [] };

  const headers = (rows[0] || []).map((h) => String(h || "").trim()).filter(Boolean);
  const data = rows.slice(1);

  const objects = data.map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = String(r[idx] ?? "").trim();
    });
    return obj;
  });

  return { headers, rows: objects };
}

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

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNumber = idx + 2; // assuming headers are row 1

    const raw = emailColumn ? row[emailColumn] : "";
    const email = String(raw || "").toLowerCase().trim();

    if (!email) {
      invalidEmailCount++;
      errors.push({ row: rowNumber, error: "Missing email" });
      continue;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      invalidEmailCount++;
      errors.push({ row: rowNumber, error: "Invalid email format" });
      continue;
    }

    if (existingEmails.has(email)) {
      duplicateCount++;
      errors.push({ row: rowNumber, error: "Duplicate email (already in system)" });
      continue;
    }

    validCount++;
  }

  return {
    validCount,
    invalidEmailCount,
    duplicateCount,
    errors: errors.slice(0, 10),
    totalErrors: errors.length,
  };
}
