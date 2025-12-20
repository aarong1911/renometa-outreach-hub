// netlify/functions/gsheetExport.js
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
    const { spreadsheet, sheetName } = JSON.parse(event.body || "{}");
    const spreadsheetId = extractSpreadsheetId(spreadsheet);

    if (!spreadsheetId) return { statusCode: 400, headers, body: JSON.stringify({ error: "spreadsheet is required" }) };
    if (!sheetName) return { statusCode: 400, headers, body: JSON.stringify({ error: "sheetName is required" }) };

    const sheets = await getSheetsClientForUser(user.uid);

    const range = `${sheetName}!A:ZZ`;
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range });

    const values = resp.data.values || [];
    if (!values.length) return { statusCode: 200, headers, body: JSON.stringify({ headers: [], rows: [], totalRows: 0 }) };

    const headersRow = values[0].map((h) => String(h || "").trim());
    const rows = values.slice(1).map((row) => {
      const obj = {};
      headersRow.forEach((h, idx) => (obj[h] = row[idx] ?? ""));
      return obj;
    });

    return { statusCode: 200, headers, body: JSON.stringify({ headers: headersRow, rows, totalRows: rows.length }) };
  } catch (error) {
    console.error("gsheetExport error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to export sheet", details: error.message }) };
  }
};
