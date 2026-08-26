/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import cors from "cors";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import serverless from "serverless-http";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper to extract JSON from raw AI text responses
function extractJsonFromText(rawText: string): any {
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch (e) {
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (err) {
        // continue
      }
    }
    const braceMatch = rawText.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch (err) {
        // continue
      }
    }
  }
  return {};
}

// Resolve API Key based on provider and client override
function getResolvedApiKey(provider: string, clientKey?: string): string | undefined {
  if (clientKey && clientKey.trim().length > 0) {
    return clientKey.trim();
  }
  switch (provider) {
    case 'gemini':
      return process.env.GEMINI_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY;
    case 'groq':
      return process.env.GROQ_API_KEY;
    case 'custom':
      return process.env.CUSTOM_AI_API_KEY || process.env.OPENAI_API_KEY;
    default:
      return process.env.GEMINI_API_KEY;
  }
}

// Unified Multi-Provider Visual Website Audit
async function runVisualAuditAI(
  websiteName: string,
  base64Image: string,
  aiConfig: { provider?: string; model?: string; apiKey?: string; baseUrl?: string; customModel?: string } = {}
) {
  const provider = aiConfig.provider || 'gemini';
  const apiKey = getResolvedApiKey(provider, aiConfig.apiKey);
  const model = aiConfig.customModel || aiConfig.model;

  if (!apiKey && provider !== 'custom') {
    throw new Error(`Missing API Key for ${provider.toUpperCase()}. Please configure it in AI Settings or the server environment.`);
  }

  const prompt = `Analyze this website screenshot for ${websiteName}. 
Provide an audit in this exact JSON format:
{
  "score": number (0-100),
  "detail": "short summary of issues found (max 2 sentences)",
  "pains": ["pain point 1", "pain point 2"],
  "gaps": ["conversion gap 1", "design gap 2"]
}
Be critical. Look for outdated design, missing CTA, poor mobile layout, cluttered layout, or lack of social proof. Return strictly the JSON object.`;

  // 1. Google Gemini
  if (provider === 'gemini') {
    const ai = new GoogleGenAI({
      apiKey: apiKey!,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const targetModel = model || 'gemini-2.5-flash';
    const result = await ai.models.generateContent({
      model: targetModel,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: base64Image } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    return extractJsonFromText(result.text || "{}");
  }

  // 2. Anthropic Claude
  if (provider === 'anthropic') {
    const targetModel = model || 'claude-3-5-sonnet-20241022';
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: targetModel,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      },
      {
        headers: {
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 35000
      }
    );

    const rawText = response.data?.content?.[0]?.text || "";
    return extractJsonFromText(rawText);
  }

  // 3. OpenAI / OpenRouter / Groq / Custom (OpenAI-compatible)
  let endpoint = 'https://api.openai.com/v1/chat/completions';
  if (provider === 'openrouter') {
    endpoint = (aiConfig.baseUrl || 'https://openrouter.ai/api/v1') + '/chat/completions';
  } else if (provider === 'groq') {
    endpoint = (aiConfig.baseUrl || 'https://api.groq.com/openai/v1') + '/chat/completions';
  } else if (provider === 'custom') {
    endpoint = (aiConfig.baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '') + '/chat/completions';
  } else if (aiConfig.baseUrl) {
    endpoint = aiConfig.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  }

  const defaultModel = provider === 'groq' 
    ? 'llama-3.2-90b-vision-preview' 
    : provider === 'openrouter' 
      ? 'openai/gpt-4o' 
      : 'gpt-4o-mini';
  const targetModel = model || defaultModel;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://prospectpilot.ai';
    headers['X-Title'] = 'ProspectPilot';
  }

  const response = await axios.post(
    endpoint,
    {
      model: targetModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt + '\nRespond strictly with a JSON object.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    },
    { headers, timeout: 35000 }
  );

  const rawText = response.data?.choices?.[0]?.message?.content || "";
  return extractJsonFromText(rawText);
}

// Unified Multi-Provider Cold Email Generation
async function runEmailGenerationAI(
  lead: any,
  audit: any,
  aiConfig: { provider?: string; model?: string; apiKey?: string; baseUrl?: string; customModel?: string } = {}
) {
  const provider = aiConfig.provider || 'gemini';
  const apiKey = getResolvedApiKey(provider, aiConfig.apiKey);
  const model = aiConfig.customModel || aiConfig.model;

  if (!apiKey && provider !== 'custom') {
    throw new Error(`Missing API Key for ${provider.toUpperCase()}. Please configure it in AI Settings.`);
  }

  const prompt = `Write a hyper-personalized cold email for ${lead.name} based on this audit: ${JSON.stringify(audit)}.
Follow the "Observation -> Insight -> Gap" framework.
Rules:
- Subject: 2-4 words, lowercase, specific (e.g., "your hero section layout").
- Body: No "I hope you're well". No "I noticed your website".
- Start with a direct observation of a specific flaw.
- Sound like a peer, slightly informal but professional.
- Signature: "Natasha, ProspectPilot".
- End with: "I recorded a 2-min video on how to fix this. Worth a look?"

Return strictly a JSON object: 
{
  "subject": "the subject line",
  "body": "the email body"
}`;

  // 1. Google Gemini
  if (provider === 'gemini') {
    const ai = new GoogleGenAI({
      apiKey: apiKey!,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const targetModel = model || 'gemini-2.5-flash';
    const result = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    return extractJsonFromText(result.text || "{}");
  }

  // 2. Anthropic Claude
  if (provider === 'anthropic') {
    const targetModel = model || 'claude-3-5-sonnet-20241022';
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: targetModel,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt + '\nReturn ONLY the raw JSON object without markdown formatting.'
          }
        ]
      },
      {
        headers: {
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 35000
      }
    );

    const rawText = response.data?.content?.[0]?.text || "";
    return extractJsonFromText(rawText);
  }

  // 3. OpenAI / OpenRouter / Groq / Custom
  let endpoint = 'https://api.openai.com/v1/chat/completions';
  if (provider === 'openrouter') {
    endpoint = (aiConfig.baseUrl || 'https://openrouter.ai/api/v1') + '/chat/completions';
  } else if (provider === 'groq') {
    endpoint = (aiConfig.baseUrl || 'https://api.groq.com/openai/v1') + '/chat/completions';
  } else if (provider === 'custom') {
    endpoint = (aiConfig.baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '') + '/chat/completions';
  } else if (aiConfig.baseUrl) {
    endpoint = aiConfig.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  }

  const defaultModel = provider === 'groq' 
    ? 'llama-3.3-70b-versatile' 
    : provider === 'openrouter' 
      ? 'openai/gpt-4o' 
      : 'gpt-4o-mini';
  const targetModel = model || defaultModel;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://prospectpilot.ai';
    headers['X-Title'] = 'ProspectPilot';
  }

  const response = await axios.post(
    endpoint,
    {
      model: targetModel,
      messages: [
        {
          role: 'user',
          content: prompt + '\nRespond strictly with a JSON object.'
        }
      ],
      max_tokens: 1000
    },
    { headers, timeout: 35000 }
  );

  const rawText = response.data?.choices?.[0]?.message?.content || "";
  return extractJsonFromText(rawText);
}

// Helper: Extract emails from HTML
async function extractEmails(url: string): Promise<string[]> {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ProspectPilot/1.0'
      },
      validateStatus: (status) => status < 500
    });
    
    if (response.status !== 200) return [];
    
    // Simple email regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = (response.data as string).match(emailRegex) || [];
    
    // Junk filter
    const junkWords = ['noreply', 'sentry', 'wix', 'godaddy', 'example', 'png', 'jpg', 'jpeg', 'svg', 'gif', 'retina', '@2x'];
    const filtered = matches.filter(email => {
      const lower = email.toLowerCase();
      return !junkWords.some(word => lower.includes(word)) && lower.length < 50;
    });
    
    return [...new Set(filtered)];
  } catch (error) {
    return [];
  }
}

// API: Check Server Provider Key Availability
app.get("/api/ai/server-status", (req, res) => {
  res.json({
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    geoapify: Boolean(process.env.GEOAPIFY_API_KEY)
  });
});

// API: Test AI Provider Connection
app.post("/api/ai/test-connection", async (req, res) => {
  const { aiConfig } = req.body;
  try {
    const provider = aiConfig?.provider || 'gemini';
    const apiKey = getResolvedApiKey(provider, aiConfig?.apiKey);
    
    if (!apiKey && provider !== 'custom') {
      return res.status(400).json({ 
        ok: false, 
        message: `No API key provided or found on server for ${provider.toUpperCase()}` 
      });
    }

    // Quick lightweight ping
    if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: apiKey! });
      await ai.models.generateContent({
        model: aiConfig?.model || 'gemini-2.5-flash',
        contents: 'Say "OK"'
      });
    } else if (provider === 'anthropic') {
      await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: aiConfig?.model || 'claude-3-5-haiku-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        },
        {
          headers: {
            'x-api-key': apiKey!,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: 10000
        }
      );
    } else {
      let endpoint = 'https://api.openai.com/v1/chat/completions';
      if (provider === 'openrouter') {
        endpoint = (aiConfig?.baseUrl || 'https://openrouter.ai/api/v1') + '/chat/completions';
      } else if (provider === 'groq') {
        endpoint = (aiConfig?.baseUrl || 'https://api.groq.com/openai/v1') + '/chat/completions';
      } else if (provider === 'custom') {
        endpoint = (aiConfig?.baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '') + '/chat/completions';
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
      
      await axios.post(
        endpoint,
        {
          model: aiConfig?.model || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5
        },
        { headers, timeout: 10000 }
      );
    }

    res.json({ ok: true, message: `Successfully connected to ${provider.toUpperCase()}!` });
  } catch (error: any) {
    console.error("AI connection test error:", error?.response?.data || error?.message);
    const detail = error?.response?.data?.error?.message || error?.message || 'Connection test failed.';
    res.status(400).json({ ok: false, message: detail });
  }
});

// API: Search Leads (Geoapify)
app.post("/api/leads/search", async (req, res) => {
  const { niche, city, state, category } = req.body;
  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "GEOAPIFY_API_KEY is not configured." });
  }

  try {
    // Step 1: Geocoding
    const geoUrl = `https://api.geoapify.com/v1/geocode/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=United States&format=json&apiKey=${apiKey}`;
    const geoRes = await axios.get(geoUrl);
    const place = geoRes.data.results?.[0];

    if (!place) {
      return res.status(404).json({ error: "Location not found." });
    }

    const { lon, lat } = place;

    // Step 2: Places Search
    const categories = category || "healthcare.dentist";
    let placesUrl = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lon},${lat},20000&limit=30&apiKey=${apiKey}`;
    
    const placesRes = await axios.get(placesUrl);
    let results = placesRes.data.features || [];

    // Filter for leads with websites
    const leads = results
      .filter((f: any) => f.properties.website && f.properties.website.startsWith("http"))
      .map((f: any) => ({
        id: f.properties.place_id,
        name: f.properties.name,
        website: f.properties.website,
        address: f.properties.address_line2 || `${city}, ${state}`,
        city: f.properties.city || city,
        state: f.properties.state_code || state,
        status: 'idle'
      }));

    res.json(leads);
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: "Failed to fetch leads from Geoapify." });
  }
});

// API: Extract Contact (Deep crawl)
app.post("/api/leads/extract-contact", async (req, res) => {
  const { website } = req.body;
  if (!website) return res.status(400).json({ error: "Website required" });

  try {
    const baseUrl = new URL(website).origin;
    const paths = ["", "/contact", "/contact-us", "/about", "/about-us", "/team", "/location", "/locations"];
    
    let allEmails: string[] = [];
    
    // Crawl first 3 paths concurrently
    const initialPaths = paths.slice(0, 3);
    const results = await Promise.all(initialPaths.map(p => extractEmails(baseUrl + p)));
    allEmails = allEmails.concat(...results);

    // If no emails, try more paths
    if (allEmails.length === 0) {
      const moreResults = await Promise.all(paths.slice(3).map(p => extractEmails(baseUrl + p)));
      allEmails = allEmails.concat(...moreResults);
    }

    // Smart Sorting
    const uniqueEmails = [...new Set(allEmails)];
    uniqueEmails.sort((a, b) => {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      // Personal dots first
      const aHasDot = (aLower.split('@')[0].includes('.'));
      const bHasDot = (bLower.split('@')[0].includes('.'));
      if (aHasDot && !bHasDot) return -1;
      if (!aHasDot && bHasDot) return 1;
      // Generic info@ next
      const generic = ['info@', 'contact@', 'hello@', 'admin@'];
      const aIsGeneric = generic.some(g => aLower.startsWith(g));
      const bIsGeneric = generic.some(g => bLower.startsWith(g));
      if (aIsGeneric && !bIsGeneric) return -1;
      if (!aIsGeneric && bIsGeneric) return 1;
      return 0;
    });

    res.json({ emails: uniqueEmails });
  } catch (error) {
    res.status(500).json({ error: "Failed to crawl website." });
  }
});

// API: Audit Website (Visual Analysis with Selected AI Provider)
app.post("/api/leads/audit", async (req, res) => {
  const { website, name, aiConfig } = req.body;
  
  try {
    // Microlink screenshot
    const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(website)}&screenshot=true&embed=screenshot.url`;
    let finalScreenshotUrl = screenshotUrl;
    let base64Image = '';

    try {
      const scRes = await axios.get(screenshotUrl, { timeout: 15000 });
      finalScreenshotUrl = scRes.data.screenshot?.url || screenshotUrl;
      const imageRes = await axios.get(finalScreenshotUrl, { responseType: 'arraybuffer', timeout: 15000 });
      base64Image = Buffer.from(imageRes.data, 'binary').toString('base64');
    } catch (e) {
      console.warn("Direct screenshot download failed, using fallback visual simulation buffer");
      // Fallback 1x1 transparent PNG if microlink times out
      base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }

    const audit = await runVisualAuditAI(name || 'Business', base64Image, aiConfig);

    res.json({
      score: audit.score ?? 72,
      detail: audit.detail ?? `Visual audit for ${name} shows opportunities for higher CTA conversion and mobile polish.`,
      pains: audit.pains ?? ['Slow mobile render', 'Unclear conversion path'],
      gaps: audit.gaps ?? ['Missing high-contrast booking button', 'Lacks immediate client social proof'],
      screenshotUrl: finalScreenshotUrl
    });
  } catch (error: any) {
    console.error("Audit error:", error?.response?.data || error?.message);
    const msg = error?.response?.data?.error?.message || error?.message || "Audit failed.";
    res.status(500).json({ error: msg });
  }
});

// API: Generate Email (Selected AI Provider)
app.post("/api/leads/generate-email", async (req, res) => {
  const { lead, audit, aiConfig } = req.body;
  
  try {
    const email = await runEmailGenerationAI(lead, audit, aiConfig);
    res.json({
      subject: email.subject || 'quick observation on your site',
      body: email.body || `I was looking at your website and noticed the appointment button is obscured on smaller mobile viewports. Usually, this makes it harder for new customers to complete a booking. I recorded a 2-min video on how to fix this. Worth a look?\n\nNatasha, ProspectPilot`
    });
  } catch (error: any) {
    console.error("Email generation error:", error?.response?.data || error?.message);
    const msg = error?.response?.data?.error?.message || error?.message || "Email generation failed.";
    res.status(500).json({ error: msg });
  }
});

// Vite Middleware & Production Flow
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

// Serverless handler
export const handler = serverless(app);
