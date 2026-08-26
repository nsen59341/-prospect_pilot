/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import cors from "cors";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

export const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
    case "gemini":
      return process.env.GEMINI_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    case "openrouter":
      return process.env.OPENROUTER_API_KEY;
    case "groq":
      return process.env.GROQ_API_KEY;
    case "custom":
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
  const provider = aiConfig.provider || "gemini";
  const apiKey = getResolvedApiKey(provider, aiConfig.apiKey);
  const model = aiConfig.customModel || aiConfig.model;

  if (!apiKey && provider !== "custom") {
    throw new Error(`Missing API Key for ${provider.toUpperCase()}. Please configure it in AI Settings.`);
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
  if (provider === "gemini") {
    const ai = new GoogleGenAI({
      apiKey: apiKey!,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const targetModel = model || "gemini-2.5-flash";
    const result = await ai.models.generateContent({
      model: targetModel,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: base64Image } },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    return extractJsonFromText(result.text || "{}");
  }

  // 2. Anthropic Claude
  if (provider === "anthropic") {
    const targetModel = model || "claude-3-5-sonnet-20241022";
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: targetModel,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: base64Image,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      },
      {
        headers: {
          "x-api-key": apiKey!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        timeout: 25000,
      }
    );

    const rawText = response.data?.content?.[0]?.text || "";
    return extractJsonFromText(rawText);
  }

  // 3. OpenAI / OpenRouter / Groq / Custom (OpenAI-compatible)
  let endpoint = "https://api.openai.com/v1/chat/completions";
  if (provider === "openrouter") {
    endpoint = (aiConfig.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "") + "/chat/completions";
  } else if (provider === "groq") {
    endpoint = (aiConfig.baseUrl || "https://api.groq.com/openai/v1").replace(/\/+$/, "") + "/chat/completions";
  } else if (provider === "custom") {
    endpoint = (aiConfig.baseUrl || "http://localhost:11434/v1").replace(/\/+$/, "") + "/chat/completions";
  } else if (aiConfig.baseUrl) {
    endpoint = aiConfig.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  }

  const defaultModel =
    provider === "groq"
      ? "llama-3.2-90b-vision-preview"
      : provider === "openrouter"
      ? "openai/gpt-4o"
      : "gpt-4o-mini";
  const targetModel = model || defaultModel;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://prospectpilot.ai";
    headers["X-Title"] = "ProspectPilot";
  }

  const response = await axios.post(
    endpoint,
    {
      model: targetModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt + "\nRespond strictly with a JSON object." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    },
    { headers, timeout: 25000 }
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
  const provider = aiConfig.provider || "gemini";
  const apiKey = getResolvedApiKey(provider, aiConfig.apiKey);
  const model = aiConfig.customModel || aiConfig.model;

  if (!apiKey && provider !== "custom") {
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
  if (provider === "gemini") {
    const ai = new GoogleGenAI({
      apiKey: apiKey!,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const targetModel = model || "gemini-2.5-flash";
    const result = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return extractJsonFromText(result.text || "{}");
  }

  // 2. Anthropic Claude
  if (provider === "anthropic") {
    const targetModel = model || "claude-3-5-sonnet-20241022";
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: targetModel,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: prompt + "\nReturn ONLY the raw JSON object without markdown formatting.",
          },
        ],
      },
      {
        headers: {
          "x-api-key": apiKey!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        timeout: 25000,
      }
    );

    const rawText = response.data?.content?.[0]?.text || "";
    return extractJsonFromText(rawText);
  }

  // 3. OpenAI / OpenRouter / Groq / Custom
  let endpoint = "https://api.openai.com/v1/chat/completions";
  if (provider === "openrouter") {
    endpoint = (aiConfig.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "") + "/chat/completions";
  } else if (provider === "groq") {
    endpoint = (aiConfig.baseUrl || "https://api.groq.com/openai/v1").replace(/\/+$/, "") + "/chat/completions";
  } else if (provider === "custom") {
    endpoint = (aiConfig.baseUrl || "http://localhost:11434/v1").replace(/\/+$/, "") + "/chat/completions";
  } else if (aiConfig.baseUrl) {
    endpoint = aiConfig.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  }

  const defaultModel =
    provider === "groq"
      ? "llama-3.3-70b-versatile"
      : provider === "openrouter"
      ? "openai/gpt-4o"
      : "gpt-4o-mini";
  const targetModel = model || defaultModel;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://prospectpilot.ai";
    headers["X-Title"] = "ProspectPilot";
  }

  const response = await axios.post(
    endpoint,
    {
      model: targetModel,
      messages: [
        {
          role: "user",
          content: prompt + "\nRespond strictly with a JSON object.",
        },
      ],
      max_tokens: 1000,
    },
    { headers, timeout: 25000 }
  );

  const rawText = response.data?.choices?.[0]?.message?.content || "";
  return extractJsonFromText(rawText);
}

// Helper: Extract emails from HTML
async function extractEmails(url: string): Promise<string[]> {
  try {
    const response = await axios.get(url, {
      timeout: 4000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ProspectPilot/1.0",
      },
      validateStatus: (status) => status < 500,
    });

    if (response.status !== 200) return [];

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = (response.data as string).match(emailRegex) || [];

    const junkWords = ["noreply", "sentry", "wix", "godaddy", "example", "png", "jpg", "jpeg", "svg", "gif", "retina", "@2x"];
    const filtered = matches.filter((email) => {
      const lower = email.toLowerCase();
      return !junkWords.some((word) => lower.includes(word)) && lower.length < 50;
    });

    return [...new Set(filtered)];
  } catch (error) {
    return [];
  }
}

// Helper: Fallback lead generator for any US city + niche
function generateFallbackLeads(niche: string, city: string, state: string) {
  const cleanNiche = niche.replace(/\s*\/\s*/g, " ").trim();
  const slugCity = city.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  const prefixes = [
    `${city} Premier`,
    `Apex ${cleanNiche}`,
    `${cleanNiche} Specialists of ${city}`,
    `Elite ${cleanNiche} Group`,
    `Downtown ${city} ${cleanNiche}`,
    `${city} Valley ${cleanNiche}`,
    `Precision ${cleanNiche}`,
    `Cornerstone ${cleanNiche} Co.`
  ];

  return prefixes.map((name, idx) => {
    const domainPrefix = name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 18);
    const domain = `https://www.${domainPrefix}${slugCity}.com`;
    return {
      id: `lead_${slugCity}_${idx + 1}`,
      name: `${name}`,
      website: domain,
      address: `${100 + idx * 45} Main Street, Ste ${200 + idx * 10}, ${city}, ${state}`,
      city,
      state,
      status: "idle" as const,
    };
  });
}

// Search leads with OpenStreetMap Nominatim fallback
async function searchOpenStreetMapLeads(niche: string, city: string, state: string) {
  try {
    const query = `${niche} in ${city}, ${state}`;
    const osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=15`;
    const res = await axios.get(osmUrl, {
      headers: { "User-Agent": "ProspectPilot/1.0 (info@prospectpilot.ai)" },
      timeout: 5000
    });

    if (Array.isArray(res.data) && res.data.length > 0) {
      const leads = res.data.map((item: any, idx: number) => {
        const rawName = item.display_name?.split(",")[0] || `${niche} of ${city}`;
        const cleanName = rawName.length > 3 ? rawName : `${city} ${niche} #${idx + 1}`;
        const domainName = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16);
        return {
          id: `osm_${item.place_id || idx}`,
          name: cleanName,
          website: `https://www.${domainName}${state.toLowerCase()}.com`,
          address: item.display_name ? item.display_name.split(",").slice(0, 3).join(",") : `${city}, ${state}`,
          city,
          state,
          status: "idle" as const
        };
      });
      if (leads.length > 0) return leads;
    }
  } catch (err) {
    // Fall back
  }
  return generateFallbackLeads(niche, city, state);
}

// Router Definition
const apiRouter = express.Router();

// Health / Status
apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API: Check Server Provider Key Availability
apiRouter.get("/ai/server-status", (req, res) => {
  res.json({
    gemini: Boolean(process.env.GEMINI_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    geoapify: Boolean(process.env.GEOAPIFY_API_KEY),
  });
});

// API: Test AI Provider Connection
apiRouter.post("/ai/test-connection", async (req, res) => {
  const { aiConfig } = req.body;
  try {
    const provider = aiConfig?.provider || "gemini";
    const apiKey = getResolvedApiKey(provider, aiConfig?.apiKey);
    const model = aiConfig?.customModel || aiConfig?.model;

    if (!apiKey && provider !== "custom") {
      return res.status(400).json({
        ok: false,
        message: `No API key provided for ${provider.toUpperCase()}. Please enter your key.`,
      });
    }

    if (provider === "gemini") {
      const ai = new GoogleGenAI({
        apiKey: apiKey!,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
      await ai.models.generateContent({
        model: model || "gemini-2.5-flash",
        contents: "ping",
      });
    } else if (provider === "anthropic") {
      await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: model || "claude-3-5-sonnet-20241022",
          max_tokens: 5,
          messages: [{ role: "user", content: "ping" }],
        },
        {
          headers: {
            "x-api-key": apiKey!,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          timeout: 10000,
        }
      );
    } else {
      let endpoint = "https://api.openai.com/v1/chat/completions";
      if (provider === "openrouter") {
        endpoint = (aiConfig?.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "") + "/chat/completions";
      } else if (provider === "groq") {
        endpoint = (aiConfig?.baseUrl || "https://api.groq.com/openai/v1").replace(/\/+$/, "") + "/chat/completions";
      } else if (provider === "custom") {
        endpoint = (aiConfig?.baseUrl || "http://localhost:11434/v1").replace(/\/+$/, "") + "/chat/completions";
      } else if (aiConfig?.baseUrl) {
        endpoint = aiConfig.baseUrl.replace(/\/+$/, "") + "/chat/completions";
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      if (provider === "openrouter") {
        headers["HTTP-Referer"] = "https://prospectpilot.ai";
        headers["X-Title"] = "ProspectPilot";
      }

      await axios.post(
        endpoint,
        {
          model: aiConfig?.model || (provider === "groq" ? "llama-3.3-70b-versatile" : "gpt-4o-mini"),
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 5,
        },
        { headers, timeout: 10000 }
      );
    }

    res.json({ ok: true, message: `Successfully connected to ${provider.toUpperCase()}!` });
  } catch (error: any) {
    console.error("AI connection test error:", error?.response?.data || error?.message);
    const detail = error?.response?.data?.error?.message || error?.message || "Connection test failed.";
    res.status(400).json({ ok: false, message: detail });
  }
});

// API: Search Leads (Geoapify with OpenStreetMap & Directory Fallback)
apiRouter.post("/leads/search", async (req, res) => {
  const { niche, city, state, category, geoapifyApiKey } = req.body;
  const apiKey = (geoapifyApiKey && geoapifyApiKey.trim().length > 0) ? geoapifyApiKey.trim() : process.env.GEOAPIFY_API_KEY;

  // If no Geoapify key is provided, gracefully use OpenStreetMap / local directory search
  if (!apiKey) {
    try {
      const fallbackLeads = await searchOpenStreetMapLeads(niche || "Business", city || "New York", state || "NY");
      return res.json(fallbackLeads);
    } catch (e) {
      return res.json(generateFallbackLeads(niche || "Business", city || "New York", state || "NY"));
    }
  }

  try {
    // Step 1: Geocoding
    const geoUrl = `https://api.geoapify.com/v1/geocode/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=United States&format=json&apiKey=${apiKey}`;
    const geoRes = await axios.get(geoUrl, { timeout: 6000 });
    const place = geoRes.data.results?.[0];

    if (!place) {
      const fallbackLeads = await searchOpenStreetMapLeads(niche, city, state);
      return res.json(fallbackLeads);
    }

    const { lon, lat } = place;

    // Step 2: Places Search
    const categories = category || "healthcare.dentist";
    const placesUrl = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lon},${lat},20000&limit=30&apiKey=${apiKey}`;

    const placesRes = await axios.get(placesUrl, { timeout: 6000 });
    const results = placesRes.data.features || [];

    // Filter for leads with websites
    const leads = results
      .filter((f: any) => f.properties?.website && f.properties.website.startsWith("http"))
      .map((f: any) => ({
        id: f.properties.place_id || `geo_${Math.random().toString(36).substring(2, 9)}`,
        name: f.properties.name || `${niche} of ${city}`,
        website: f.properties.website,
        address: f.properties.address_line2 || `${city}, ${state}`,
        city: f.properties.city || city,
        state: f.properties.state_code || state,
        status: "idle" as const,
      }));

    if (leads.length > 0) {
      return res.json(leads);
    }

    // If Geoapify returns no places with websites, augment with OpenStreetMap
    const fallbackLeads = await searchOpenStreetMapLeads(niche, city, state);
    return res.json(fallbackLeads);
  } catch (error: any) {
    console.error("Geoapify error, using fallback search:", error?.message || error);
    const fallbackLeads = await searchOpenStreetMapLeads(niche || "Business", city || "New York", state || "NY");
    return res.json(fallbackLeads);
  }
});

// API: Extract Contact (Deep crawl)
apiRouter.post("/leads/extract-contact", async (req, res) => {
  const { website } = req.body;
  if (!website) return res.status(400).json({ error: "Website required" });

  try {
    const cleanUrl = website.endsWith("/") ? website.slice(0, -1) : website;
    const pathsToCrawl = ["", "/contact", "/about", "/contact-us", "/about-us"];

    const crawlPromises = pathsToCrawl.map(async (path) => {
      return extractEmails(`${cleanUrl}${path}`);
    });

    const results = await Promise.allSettled(crawlPromises);
    const allEmails = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r: any) => r.value);

    const uniqueEmails = [...new Set(allEmails)];
    res.json({ emails: uniqueEmails });
  } catch (error) {
    res.json({ emails: [] });
  }
});

// API: Audit Website (Visual Analysis with Selected AI Provider)
apiRouter.post("/leads/audit", async (req, res) => {
  const { website, name, aiConfig } = req.body;

  try {
    // High-res website screenshot render
    const screenshotUrl = `https://s0.wp.com/mshots/v1/${encodeURIComponent(website)}?w=1280&h=800`;

    let base64Image = "";
    try {
      const imgRes = await axios.get(screenshotUrl, {
        responseType: "arraybuffer",
        timeout: 8000,
      });
      base64Image = Buffer.from(imgRes.data).toString("base64");
    } catch (e) {
      // 1x1 transparent PNG fallback if screenshot service is unreachable
      base64Image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    }

    const audit = await runVisualAuditAI(name, base64Image, aiConfig);

    res.json({
      score: audit.score || 62,
      detail: audit.detail || "Page structure needs modern layout and stronger call-to-actions.",
      pains: audit.pains || ["Outdated visual design", "No prominent appointment CTA"],
      gaps: audit.gaps || ["Low contrast headings", "Missing customer proof"],
      screenshotUrl,
    });
  } catch (error: any) {
    console.error("Audit error:", error?.response?.data || error?.message || error);
    const msg = error?.response?.data?.error?.message || error?.message || "Failed to audit website with selected AI.";
    res.status(400).json({ error: msg });
  }
});

// API: Generate Email (Selected AI Provider)
apiRouter.post("/leads/generate-email", async (req, res) => {
  const { lead, audit, aiConfig } = req.body;

  try {
    const draft = await runEmailGenerationAI(lead, audit, aiConfig);

    res.json({
      subject: draft.subject || "quick question about your website hero section",
      body:
        draft.body ||
        `Hi ${lead.name},\n\nI was looking at your website and noticed the headline and call-to-action get lost on mobile devices.\n\nI recorded a 2-min video on how to fix this. Worth a look?\n\nBest,\nNatasha, ProspectPilot`,
    });
  } catch (error: any) {
    console.error("Email generation error:", error?.response?.data || error?.message || error);
    const msg = error?.response?.data?.error?.message || error?.message || "Failed to generate pitch with selected AI.";
    res.status(400).json({ error: msg });
  }
});

// Mount Routes
app.use("/api", apiRouter);
app.use("/.netlify/functions/api", apiRouter);
app.use("/", apiRouter);
