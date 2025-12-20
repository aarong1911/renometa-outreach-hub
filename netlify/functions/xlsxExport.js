// netlify/functions/xlsxExport.js
// Export XLSX file (base64) into { headers, rows, totalRows } (AUTH via Firebase ID token)

const { requireUser } = require("./_lib/auth");
const XLSX = require("xlsx");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  try {
    await requireUser(event);

    const { fileContentBase64 } = JSON.parse(event.body || "{}");
    if (!fileContentBase64) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "fileContentBase64 is required" }) };
    }

    const buffer = Buffer.from(fileContentBase64, "base64");
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const firstSheetName = workbook.SheetNames?.[0];
    if (!firstSheetName) {
      return { statusCode: 200, headers, body: JSON.stringify({ headers: [], rows: [], totalRows: 0 }) };
    }

    const sheet = workbook.Sheets[firstSheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }); // array of objects

    const headersRow = json.length ? Object.keys(json[0]) : [];
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        headers: headersRow,
        rows: json,
        totalRows: json.length,
      }),
    };
  } catch (error) {
    console.error("xlsxExport error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to export xlsx", details: error.message }) };
  }
};
