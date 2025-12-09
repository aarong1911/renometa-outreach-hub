// netlify/functions/getActivity.js
const { google } = require('googleapis');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get recent activity from Log sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.LOG_SHEET_ID,
      range: 'Sheet1!A2:K100', // Get last 100 rows
    });

    const rows = response.data.values || [];
    
    // Transform into activity log
    const activity = rows.map(row => ({
      status: row[0],
      sentAt: row[1],
      fromAccount: row[2],
      toAccount: row[3],
      subject: row[4],
      body: row[5],
      owner: row[6],
      ownerId: row[7],
      messageId: row[8],
      campaignId: row[9],
    })).reverse(); // Most recent first

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ activity }),
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