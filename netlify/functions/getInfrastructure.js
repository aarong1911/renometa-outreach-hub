// netlify/functions/getInfrastructure.js
// Fetch email infrastructure data from Airtable

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
    const base = new Airtable({ 
      apiKey: process.env.AIRTABLE_API_KEY 
    }).base(process.env.AIRTABLE_BASE_ID);

    // Get all email accounts
    const records = await base('Email Accounts')
      .select({
        sort: [{ field: 'email', direction: 'asc' }]
      })
      .all();

    // Transform to infrastructure format
    const infrastructure = records.map(record => {
      const fields = record.fields;
      
      // Determine DNS status based on fields
      const hasSPF = fields.smtpHost ? true : false;
      const hasDKIM = fields.smtpHost ? true : false;
      
      // Calculate daily usage
      const dailyUsage = {
        current: fields.sentToday || 0,
        limit: fields.currentDailyLimit || 0,
        percentage: fields.currentDailyLimit > 0 
          ? Math.min((fields.sentToday / fields.currentDailyLimit) * 100, 100)
          : 0
      };

      return {
        id: record.id,
        email: fields.email,
        provider: fields.provider || 'unknown',
        type: fields.type || 'business',
        status: fields.status || 'active',
        
        // DNS Configuration
        dns: {
          spf: hasSPF ? 'SPF_OK' : 'PENDING',
          dkim: hasDKIM ? 'DKIM_OK' : 'PENDING',
          dmarc: hasSPF && hasDKIM ? 'DMARC_OK' : 'PENDING'
        },
        
        // Daily usage
        dailyUsage: dailyUsage,
        
        // SMTP info
        smtp: {
          host: fields.smtpHost || '',
          port: fields.smtpPort || 587,
          configured: !!fields.smtpHost
        },
        
        // Warmup info
        warmup: {
          enabled: fields.warmupEnabled || false,
          daysActive: fields.daysActive || 0,
          currentLimit: fields.currentDailyLimit || 0,
          maxLimit: fields.warmupMaxLimit || 60
        },
        
        // Timestamps
        createdAt: fields.createdAt,
        lastSentAt: fields.lastSentAt
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ infrastructure }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch infrastructure', 
        details: error.message 
      }),
    };
  }
};