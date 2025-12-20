// netlify/functions/gsheetPreview.js
const Airtable = require("airtable");
const { requireUser } = require("./_lib/auth");
const { getSheetsClientForUser, extractSpreadsheetId } = require("./_lib/googleOAuth");

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
    const { spreadsheet, sheetName } = JSON.parse(event.body || {});
    const spreadsheetId = extractSpreadsheetId(spreadsheet);

    if (!spreadsheetId) return { statusCode: 400, headers, body: JSON.stringify({ error: "spreadsheet is required" }) };
    if (!sheetName) return { statusCode: 400, headers, body: JSON.stringify({ error: "sheetName is required" }) };

    const sheets = await getSheetsClientForUser(user.uid);
    const range = `${sheetName}!A:ZZ`;
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });

    const values = resp.data.values || [];
    if (!values.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ headers: [], sampleRows: [], suggestedMapping: {}, totalRows: 0, validation: { validCount: 0, invalidEmailCount: 0, duplicateCount: 0, errors: [] }, defaultListName: `Google Sheet - ${sheetName}` }) };
    }

    const headersRow = values[0].map((h) => String(h || "").trim());
    const rows = values.slice(1).map((row) => {
      const obj = {};
      headersRow.forEach((h, idx) => (obj[h] = row[idx] ?? ""));
      return obj;
    });

    const sampleRows = rows.slice(0, 20);

    const suggestedMapping = autoMapHeaders(headersRow);

    // existing emails for duplicates
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

    const existingRecords = await base("Leads")
      .select({
        filterByFormula: `{userId}='${user.uid}'`,
        fields: ["email"],
      })
      .all();

    const existingEmails = new Set(existingRecords.map((r) => (r.fields.email || "").toString().toLowerCase()));

    const validation = validateRows(sampleRows, suggestedMapping, existingEmails);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        headers: headersRow,
        sampleRows,
        suggestedMapping,
        totalRows: rows.length,
        validation,
        defaultListName: `Google Sheet - ${sheetName}`,
      }),
    };
  } catch (error) {
    console.error("gsheetPreview error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to preview sheet", details: error.message }) };
  }
};

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

  const emailColumn = Object.keys(mapping).find((k) => mapping[k] === "email");
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

  return { validCount, invalidEmailCount, duplicateCount, errors: errors.slice(0, 10) };
}
