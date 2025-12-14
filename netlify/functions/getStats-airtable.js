// netlify/functions/getStats.js
// Fixed version with proper reply rate calculation

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

    // Get all data for calculations
    const [accountsRes, logRes, repliesRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.ACCOUNTS_SHEET_ID,
        range: 'Sheet1!A2:Z',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.LOG_SHEET_ID,
        range: 'Sheet1!A2:K',
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.REPLIES_SHEET_ID,
        range: 'Sheet1!A2:Z',
      }),
    ]);

    const accounts = accountsRes.data.values || [];
    const logs = logRes.data.values || [];
    const replies = repliesRes.data.values || [];

    // Calculate stats
    const totalAccounts = accounts.length;
    const totalSent = logs.length;
    const totalReplies = replies.length;
    
    // FIXED: Cap reply rate at 100% maximum
    // (Since you can't have more than 100% reply rate realistically)
    let replyRate = 0;
    if (totalSent > 0) {
      const calculatedRate = (totalReplies / totalSent) * 100;
      replyRate = Math.min(calculatedRate, 100).toFixed(1);
    }
    
    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const todaySent = logs.filter(row => row[1]?.includes(today)).length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        stats: {
          totalAccounts,
          totalSent,
          totalReplies,
          replyRate: replyRate.toString(),
          todaySent,
          // Added debug info (remove this later if you want)
          debug: {
            rawReplyRate: totalSent > 0 ? ((totalReplies / totalSent) * 100).toFixed(1) : '0',
            note: totalReplies > totalSent ? 'More replies than sent emails - check Replies sheet for duplicates' : 'Normal'
          }
        }
      }),
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