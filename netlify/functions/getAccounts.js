// netlify/functions/getAccounts.js
const { google } = require('googleapis');

exports.handler = async (event, context) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Parse service account from environment variable
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get accounts data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.ACCOUNTS_SHEET_ID,
      range: 'Sheet1!A2:Z', // Adjust based on your sheet structure
    });

    const rows = response.data.values || [];
    
    // Transform rows into objects
    const accounts = rows.map(row => ({
      email: row[0],
      provider: row[1],
      status: row[2],
      dailyLimit: parseInt(row[3]) || 0,
      currentCount: parseInt(row[4]) || 0,
      totalSent: parseInt(row[5]) || 0,
      // Add more fields based on your sheet columns
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ accounts }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};