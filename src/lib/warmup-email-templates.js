// src/lib/warmup-email-templates.js
// Email templates optimized for Google/Zoho warmup
// These templates avoid spam triggers and maintain natural conversation

export const warmupTemplates = {
  // INITIAL OUTREACH TEMPLATES
  // Professional but casual, avoid sales language
  initial: [
    {
      id: 1,
      subject: "Quick question about {topic}",
      body: `Hi,

I came across {topic} and thought you might have experience in this area. I'm based in {city} and working on something similar.

Would you be open to a quick chat?

Best regards,
{senderName}
{company}`,
      category: "professional_inquiry"
    },
    {
      id: 2,
      subject: "Connecting from {industry}",
      body: `Hello,

I work in the {industry} space and have been following developments around {topic}. I thought it would be valuable to connect with others in the field.

Are you available for a brief call next week?

Thanks,
{senderName}
{company}`,
      category: "industry_networking"
    },
    {
      id: 3,
      subject: "Thoughts on {topic}?",
      body: `Hey,

I recently learned about {topic} and found it interesting. I'd love to hear your perspective on this.

Do you have 15 minutes to chat sometime?

Best,
{senderName}
{company}`,
      category: "casual_inquiry"
    },
    {
      id: 4,
      subject: "Following up on {topic}",
      body: `Hi there,

Hope you're having a good week! I wanted to follow up on my previous message about {topic}.

Let me know if you'd be interested in discussing further.

Regards,
{senderName}
{company}`,
      category: "follow_up"
    },
    {
      id: 5,
      subject: "Introduction from {city}",
      body: `Hello,

I'm reaching out from {city}. I work in {industry} and thought it would be great to connect.

Would you be open to a quick introduction call?

Thanks,
{senderName}
{company}`,
      category: "geographic_connection"
    },
    {
      id: 6,
      subject: "Quick intro",
      body: `Hi,

My name is {senderName} and I work at {company}. I've been looking into {topic} and thought you might have relevant experience.

Would you be open to connecting?

Best,
{senderName}`,
      category: "direct_introduction"
    },
    {
      id: 7,
      subject: "Question about {industry}",
      body: `Hello,

I hope this email finds you well. I have a quick question about {topic} in the {industry} sector.

Would you have a few minutes to share your thoughts?

Thanks in advance,
{senderName}
{company}`,
      category: "industry_question"
    },
    {
      id: 8,
      subject: "Collaboration opportunity",
      body: `Hi,

I came across your work in {industry} and was impressed. We're exploring {topic} and I think there might be some synergy.

Would you be interested in discussing this further?

Best regards,
{senderName}
{company}`,
      category: "collaboration"
    }
  ],

  // POSITIVE REPLY TEMPLATES
  // Show engagement and interest
  replies_positive: [
    {
      id: 1,
      body: `Thanks for reaching out! I'd be happy to discuss {topic}.

How about next Tuesday or Wednesday? I'm generally available in the afternoon.

Looking forward to connecting,
{senderName}`,
      tone: "enthusiastic"
    },
    {
      id: 2,
      body: `I appreciate you getting in touch. Yes, I'm interested in {topic}.

What times work best for you? I'm flexible this week.

Best,
{senderName}`,
      tone: "professional"
    },
    {
      id: 3,
      body: `Great to hear from you! I have some experience with {topic} that might be helpful.

Let's schedule a quick call. Are you free Thursday or Friday?

Thanks,
{senderName}`,
      tone: "helpful"
    },
    {
      id: 4,
      body: `Thanks for connecting! I'd be glad to share my perspective on {topic}.

Would a Zoom call work for you? I'm available most mornings.

Regards,
{senderName}`,
      tone: "accommodating"
    },
    {
      id: 5,
      body: `I'm definitely interested in discussing this. {topic} is something I've been following closely.

How about we set up a brief call next week?

Best regards,
{senderName}`,
      tone: "engaged"
    },
    {
      id: 6,
      body: `Happy to help! I've worked on {topic} before and can share some insights.

Let me know what time works for you.

Thanks,
{senderName}`,
      tone: "supportive"
    },
    {
      id: 7,
      body: `Thanks for reaching out. I think we could have a productive conversation about {topic}.

I'm available Tuesday through Thursday next week. What works for you?

Best,
{senderName}`,
      tone: "open"
    }
  ],

  // NEUTRAL/CLARIFYING REPLIES
  // Natural follow-up questions
  replies_neutral: [
    {
      id: 1,
      body: `Thanks for getting in touch. Can you share a bit more about what you're working on with {topic}?

Looking forward to learning more,
{senderName}`,
      tone: "inquisitive"
    },
    {
      id: 2,
      body: `I appreciate you reaching out. Could you elaborate on what specifically you'd like to discuss regarding {topic}?

Thanks,
{senderName}`,
      tone: "clarifying"
    },
    {
      id: 3,
      body: `Thanks for your message. I'd like to understand better what you're looking for.

Can you provide some more context about {topic}?

Best,
{senderName}`,
      tone: "careful"
    },
    {
      id: 4,
      body: `I received your message about {topic}. Before we schedule a call, could you tell me more about your specific interest in this area?

Regards,
{senderName}`,
      tone: "cautious"
    }
  ],

  // POLITE DECLINE TEMPLATES
  // Maintain positive relationship
  replies_decline: [
    {
      id: 1,
      body: `Thanks for thinking of me! Unfortunately, I'm quite busy with current projects right now.

Perhaps we can connect in a few weeks?

Best,
{senderName}`,
      tone: "busy"
    },
    {
      id: 2,
      body: `I appreciate you reaching out. While I'm not the best person for this, I can recommend someone who might be able to help with {topic}.

Best of luck,
{senderName}`,
      tone: "helpful_redirect"
    },
    {
      id: 3,
      body: `Thanks for your message. I don't have much availability right now, but feel free to reach out again in the future.

Best regards,
{senderName}`,
      tone: "polite_no"
    }
  ],

  // FOLLOW-UP TEMPLATES
  // For continuing conversation
  followup: [
    {
      id: 1,
      subject: "Re: {originalSubject}",
      body: `Hi,

Just wanted to follow up on this. Are you still interested in discussing {topic}?

Let me know!

Best,
{senderName}`,
      timing: "7_days_after"
    },
    {
      id: 2,
      subject: "Re: {originalSubject}",
      body: `Hello,

I know you're probably busy, but wanted to check back in about {topic}.

Looking forward to hearing from you.

Thanks,
{senderName}`,
      timing: "5_days_after"
    },
    {
      id: 3,
      subject: "Re: {originalSubject}",
      body: `Hi,

Circling back on my previous message about {topic}. Still interested in connecting if you have time.

Best regards,
{senderName}`,
      timing: "10_days_after"
    }
  ]
};

// Variables for template personalization
export const templateVariables = {
  topics: [
    "project management best practices",
    "team collaboration tools",
    "business process optimization",
    "digital transformation initiatives",
    "operational efficiency",
    "supply chain management",
    "customer experience strategies",
    "technology implementation",
    "workflow automation",
    "data analytics approaches",
    "quality assurance methods",
    "risk management strategies",
    "vendor management",
    "logistics optimization",
    "inventory management"
  ],
  
  industries: [
    "construction",
    "logistics and transportation",
    "manufacturing",
    "professional services",
    "consulting",
    "technology",
    "real estate development",
    "industrial services",
    "supply chain",
    "facility management"
  ],
  
  cities: [
    "San Francisco",
    "New York",
    "Chicago",
    "Los Angeles",
    "Seattle",
    "Austin",
    "Boston",
    "Denver",
    "Atlanta",
    "Dallas",
    "Phoenix",
    "San Diego"
  ],
  
  companies: {
    "aimstel.com": "Aimstel",
    "airotop.com": "AirOTop",
    "allproladders.com": "All Pro Ladders",
    "kilologistics.com": "Kilo Logistics",
    "ligerconstruction.com": "Liger Construction",
    "truckersways.com": "Truckers Ways"
  }
};

// Template selection with anti-spam logic
export function selectTemplate(category, recentlyUsed = []) {
  const templates = warmupTemplates[category];
  if (!templates || templates.length === 0) {
    throw new Error(`No templates found for category: ${category}`);
  }
  
  // Filter out recently used templates
  const availableTemplates = templates.filter(
    t => !recentlyUsed.includes(t.id)
  );
  
  // If all templates used, reset and use full pool
  const pool = availableTemplates.length > 0 ? availableTemplates : templates;
  
  // Random selection
  return pool[Math.floor(Math.random() * pool.length)];
}

// Fill template with variables
export function fillTemplate(template, variables) {
  let result = template;
  
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(regex, variables[key]);
  });
  
  return result;
}

// Generate random variables for a specific sender
export function generateVariables(senderEmail) {
  const domain = senderEmail.split('@')[1];
  const name = "Jason"; // All accounts use jason@
  
  const topic = templateVariables.topics[
    Math.floor(Math.random() * templateVariables.topics.length)
  ];
  
  const industry = templateVariables.industries[
    Math.floor(Math.random() * templateVariables.industries.length)
  ];
  
  const city = templateVariables.cities[
    Math.floor(Math.random() * templateVariables.cities.length)
  ];
  
  const company = templateVariables.companies[domain] || 
    domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
  
  return {
    senderName: name,
    firstName: name,
    topic,
    industry,
    city,
    company,
    domain
  };
}

// Generate complete email content
export function generateEmail(category, senderEmail, recipientEmail, recentTemplates = []) {
  // Select template
  const template = selectTemplate(category, recentTemplates);
  
  // Generate variables
  const variables = generateVariables(senderEmail);
  
  // Fill template
  const subject = template.subject ? fillTemplate(template.subject, variables) : '';
  const body = fillTemplate(template.body, variables);
  
  return {
    subject,
    body,
    templateId: template.id,
    category,
    from: senderEmail,
    to: recipientEmail,
    variables
  };
}

// SPAM AVOIDANCE GUIDELINES
export const spamAvoidanceRules = {
  // Never use these words/phrases
  forbidden: [
    "free",
    "discount",
    "limited time",
    "act now",
    "call now",
    "guarantee",
    "no cost",
    "special promotion",
    "order now",
    "click here",
    "unsubscribe",
    "remove",
    "viagra",
    "cialis",
    "weight loss",
    "make money",
    "work from home",
    "mlm",
    "$$",
    "!!!",
    "URGENT",
    "IMPORTANT"
  ],
  
  // Keep these minimal
  limitedUse: [
    "opportunity",
    "offer",
    "deal",
    "amazing",
    "incredible",
    "revolutionary",
    "breakthrough"
  ],
  
  // Best practices
  guidelines: [
    "Keep subject lines under 60 characters",
    "Use sentence case, not ALL CAPS",
    "Limit exclamation points to 1 maximum",
    "No more than 2 links per email",
    "No attachments during warmup",
    "Use plain text or simple HTML",
    "Include sender's full name",
    "Maintain consistent from address",
    "Personalize with recipient info",
    "Keep email body under 200 words"
  ]
};

// Validate email content against spam rules
export function validateEmailContent(subject, body) {
  const errors = [];
  const warnings = [];
  
  // Check forbidden words
  const combinedText = (subject + " " + body).toLowerCase();
  spamAvoidanceRules.forbidden.forEach(word => {
    if (combinedText.includes(word)) {
      errors.push(`Contains forbidden word: "${word}"`);
    }
  });
  
  // Check subject length
  if (subject.length > 60) {
    warnings.push("Subject line exceeds 60 characters");
  }
  
  // Check for ALL CAPS
  if (subject === subject.toUpperCase() && subject.length > 5) {
    errors.push("Subject line is all caps");
  }
  
  // Check exclamation points
  const exclamationCount = (subject + body).split('!').length - 1;
  if (exclamationCount > 1) {
    warnings.push(`Too many exclamation points: ${exclamationCount}`);
  }
  
  // Check body length
  if (body.split(' ').length > 200) {
    warnings.push("Email body exceeds 200 words");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export default {
  warmupTemplates,
  templateVariables,
  selectTemplate,
  fillTemplate,
  generateVariables,
  generateEmail,
  validateEmailContent,
  spamAvoidanceRules
};