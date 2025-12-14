// netlify/functions/getAccounts.js
// Fetches email accounts from Airtable

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

    const records = await base('Email Accounts')
      .select({
        filterByFormula: `{userId} = '${userId}'`,
        sort: [{ field: 'createdAt', direction: 'desc' }]
      })
      .all();

    const accounts = records.map(record => {
      const fields = record.fields;
      const daysActive = fields.daysActive || 0;
      const startLimit = fields.warmupStartLimit || 3;
      const maxLimit = fields.warmupMaxLimit || 60;
      const currentLimit = fields.currentDailyLimit || startLimit;
      
      const progressPercent = (currentLimit / maxLimit) * 100;
      let warmupStage = 1;
      if (progressPercent >= 80) warmupStage = 5;
      else if (progressPercent >= 60) warmupStage = 4;
      else if (progressPercent >= 40) warmupStage = 3;
      else if (progressPercent >= 20) warmupStage = 2;

      return {
        id: record.id,
        email: fields.email,
        provider: fields.provider,
        type: fields.type,
        status: fields.status,
        warmupEnabled: fields.warmupEnabled || false,
        warmupStartLimit: startLimit,
        warmupDailyIncrement: fields.warmupDailyIncrement || 1,
        warmupMaxLimit: maxLimit,
        daysActive: daysActive,
        currentDailyLimit: currentLimit,
        sentToday: fields.sentToday || 0,
        repliedToday: fields.repliedToday || 0,
        totalSent: fields.totalSent || 0,
        warmupStage: warmupStage,
        warmupProgress: Math.min(progressPercent, 100),
        createdAt: fields.createdAt,
        lastSentAt: fields.lastSentAt,
      };
    });

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
      body: JSON.stringify({ error: 'Failed to fetch accounts', details: error.message }),
    };
  }
};