// netlify/functions/getStats-airtable.js
// Calculate stats from Airtable

const Airtable = require('airtable');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Get userId from query parameters
    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'User ID is required' }),
      };
    }

    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY 
    }).base(process.env.AIRTABLE_BASE_ID);

    // Get all accounts for this user
    const accounts = await base('Email Accounts')
      .select({
        filterByFormula: `{userId} = '${userId}'`
      })
      .all();
    
    // Get email logs for this user
    const logs = await base('Email Logs')
      .select({
        filterByFormula: `{userId} = '${userId}'`
      })
      .all();
    
    // Get warmup replies for this user
    const replies = await base('Warmup Replies')
      .select({
        filterByFormula: `{userId} = '${userId}'`
      })
      .all();

    // Calculate stats
    const totalAccounts = accounts.length;
    const totalSent = logs.length;
    const totalReplies = replies.length;
    
    // Calculate reply rate (cap at 100%)
    const replyRate = totalSent > 0 
      ? Math.min((totalReplies / totalSent) * 100, 100) 
      : 0;

    // Sum sentToday across all accounts
    const sentToday = accounts.reduce((sum, record) => 
      sum + (record.fields.sentToday || 0), 0
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        totalAccounts,
        totalSent,
        totalReplies,
        replyRate: replyRate.toFixed(1),
        sentToday,
      }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to fetch stats', details: error.message }),
    };
  }
};