/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import cors from "cors";
import axios from "axios";
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { createServer as createViteServer } from "vite";
import serverless from "serverless-http";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Gemini Initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
    console.error(`Error fetching ${url}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

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
        address: f.properties.address_line2,
        city: f.properties.city,
        state: f.properties.state_code || state,
        status: 'idle'
      }));

    res.json(leads);
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: "Failed to fetch leads." });
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

// API: Audit Website (Vision)
app.post("/api/leads/audit", async (req, res) => {
  const { website, name } = req.body;
  
  try {
    // Microlink screenshot
    const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(website)}&screenshot=true&embed=screenshot.url`;
    const scRes = await axios.get(screenshotUrl);
    const finalScreenshotUrl = scRes.data.screenshot?.url || `https://api.microlink.io/?url=${encodeURIComponent(website)}&screenshot=true&embed=screenshot.url`;

    // Fetch image data for Gemini
    const imageRes = await axios.get(finalScreenshotUrl, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(imageRes.data, 'binary').toString('base64');

    const prompt = `Analyze this website screenshot for ${name}. 
    Provide an audit in this exact JSON format:
    {
      "score": number (0-100),
      "detail": "short summary of issues found",
      "pains": ["pain point 1", "pain point 2"],
      "gaps": ["conversion gap 1", "design gap 2"]
    }
    Be critical. Look for outdated design, missing CTA, poor mobile layout, or lack of social proof.`;

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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

    const audit = JSON.parse(result.text || "{}");
    res.json({ ...audit, screenshotUrl: finalScreenshotUrl });
  } catch (error) {
    console.error("Audit error:", error);
    res.status(500).json({ error: "Audit failed." });
  }
});

// API: Generate Email
app.post("/api/leads/generate-email", async (req, res) => {
  const { lead, audit } = req.body;
  
  try {
    const prompt = `Write a hyper-personalized cold email for ${lead.name} based on this audit: ${JSON.stringify(audit)}.
    Follow the "Observation -> Insight -> Gap" framework.
    Rules:
    - Subject: 2-4 words, lowercase, specific (e.g., "your hero section layout").
    - Body: No "I hope you're well". No "I noticed your website".
    - Start with a direct observation of a specific flaw.
    - Sound like a peer, slightly informal but professional.
    - Signature: "Natasha, ProspectPilot".
    - End with: "I recorded a 2-min video on how to fix this. Worth a look?"
    
    Return JSON: 
    {
      "subject": "the subject line",
      "body": "the email body"
    }`;

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const email = JSON.parse(result.text || "{}");
    res.json(email);
  } catch (error) {
    res.status(500).json({ error: "Email generation failed." });
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
