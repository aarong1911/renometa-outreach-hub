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

    // Get replies data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.REPLIES_SHEET_ID,
      range: 'Sheet1!A2:Z',
    });

    const rows = response.data.values || [];
    
    const replies = rows.map(row => ({
      repliedAt: row[0],
      fromAccount: row[1],
      toAccount: row[2],
      originalMessageId: row[3],
      replyDelay: row[4],
      // Add more fields as needed
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ replies }),
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