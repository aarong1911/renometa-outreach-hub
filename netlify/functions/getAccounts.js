// netlify/functions/getAccounts.js
// Correctly mapped to your actual Google Sheets structure

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

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.ACCOUNTS_SHEET_ID,
      range: 'Sheet1!A2:P',
    });

    const rows = response.data.values || [];
    
    // Map columns based on your ACTUAL sheet structure
    const accounts = rows.map(row => ({
      email: row[0] || '',                      // A: email
      provider: row[1] || '',                   // B: provider
      type: row[2] || '',                       // C: type
      status: row[3] || 'active',               // D: status
      createdAt: row[4] || '',                  // E: createdAt
      dailyLimit: parseInt(row[5]) || 50,       // F: dailyLimit ✅
      currentCount: parseInt(row[6]) || 0,      // G: sentToday (current daily count)
      totalSent: parseInt(row[6]) || 0,         // G: sentToday (for display)
      lastSentAt: row[7] || '',                 // H: lastSentAt
      owner: row[8] || '',                      // I: owner
      ownerId: row[9] || '',                    // J: ownerId
      canSendToday: row[10] || 'true',          // K: canSendToday
      repliedToday: parseInt(row[11]) || 0,     // L: repliedToday
      startLimit: parseInt(row[12]) || 10,      // M: startLimit
      dailyIncrement: parseInt(row[13]) || 5,   // N: dailyIncrement
      maxLimit: parseInt(row[14]) || 50,        // O: maxLimit
      daysActive: parseInt(row[15]) || 0,       // P: daysActive
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