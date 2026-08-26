/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const US_CITIES = [
  { city: "New York", state: "NY" },
  { city: "Los Angeles", state: "CA" },
  { city: "Chicago", state: "IL" },
  { city: "Houston", state: "TX" },
  { city: "Phoenix", state: "AZ" },
  { city: "Philadelphia", state: "PA" },
  { city: "San Antonio", state: "TX" },
  { city: "San Diego", state: "CA" },
  { city: "Dallas", state: "TX" },
  { city: "San Jose", state: "CA" },
  { city: "Austin", state: "TX" },
  { city: "Jacksonville", state: "FL" },
  { city: "Fort Worth", state: "TX" },
  { city: "Columbus", state: "OH" },
  { city: "San Francisco", state: "CA" },
  { city: "Charlotte", state: "NC" },
  { city: "Indianapolis", state: "IN" },
  { city: "Seattle", state: "WA" },
  { city: "Denver", state: "CO" },
  { city: "Washington", state: "DC" },
  { city: "Boston", state: "MA" },
  { city: "El Paso", state: "TX" },
  { city: "Nashville", state: "TN" },
  { city: "Detroit", state: "MI" },
  { city: "Oklahoma City", state: "OK" },
  { city: "Portland", state: "OR" },
  { city: "Las Vegas", state: "NV" },
  { city: "Memphis", state: "TN" },
  { city: "Louisville", state: "KY" },
  { city: "Baltimore", state: "MD" },
  { city: "Milwaukee", state: "WI" },
  { city: "Albuquerque", state: "NM" },
  { city: "Tucson", state: "AZ" },
  { city: "Fresno", state: "CA" },
  { city: "Sacramento", state: "CA" },
  { city: "Mesa", state: "AZ" },
  { city: "Kansas City", state: "MO" },
  { city: "Atlanta", state: "GA" },
  { city: "Long Beach", state: "CA" },
  { city: "Colorado Springs", state: "CO" },
  { city: "Raleigh", state: "NC" },
  { city: "Miami", state: "FL" },
  { city: "Virginia Beach", state: "VA" },
  { city: "Omaha", state: "NE" },
  { city: "Oakland", state: "CA" },
  { city: "Minneapolis", state: "MN" },
  { city: "Tulsa", state: "OK" },
  { city: "Arlington", state: "TX" },
  { city: "New Orleans", state: "LA" },
  { city: "Wichita", state: "KS" },
  { city: "Cleveland", state: "OH" },
  { city: "Tampa", state: "FL" },
  { city: "Bakersfield", state: "CA" },
  { city: "Aurora", state: "CO" },
  { city: "Anaheim", state: "CA" },
  { city: "Honolulu", state: "HI" },
  { city: "Santa Ana", state: "CA" },
  { city: "Riverside", state: "CA" },
  { city: "Corpus Christi", state: "TX" },
  { city: "Lexington", state: "KY" },
  { city: "Henderson", state: "NV" },
  { city: "Stockton", state: "CA" },
  { city: "Saint Paul", state: "MN" },
  { city: "Cincinnati", state: "OH" },
  { city: "St. Louis", state: "MO" },
  { city: "Pittsburgh", state: "PA" },
  { city: "Greensboro", state: "NC" },
  { city: "Lincoln", state: "NE" },
  { city: "Anchorage", state: "AK" },
  { city: "Plano", state: "TX" },
  { city: "Orlando", state: "FL" },
  { city: "Irvine", state: "CA" },
  { city: "Newark", state: "NJ" },
  { city: "Durham", state: "NC" },
  { city: "Chula Vista", state: "CA" },
  { city: "Toledo", state: "OH" },
  { city: "Fort Wayne", state: "IN" },
  { city: "St. Petersburg", state: "FL" },
  { city: "Laredo", state: "TX" },
  { city: "Jersey City", state: "NJ" },
  { city: "Chandler", state: "AZ" },
  { city: "Madison", state: "WI" },
  { city: "Lubbock", state: "TX" },
  { city: "Scottsdale", state: "AZ" },
  { city: "Reno", state: "NV" },
  { city: "Buffalo", state: "NY" },
  { city: "Gilbert", state: "AZ" },
  { city: "Glendale", state: "AZ" },
  { city: "North Las Vegas", state: "NV" },
  { city: "Winston-Salem", state: "NC" },
  { city: "Chesapeake", state: "VA" },
  { city: "Norfolk", state: "VA" },
  { city: "Fremont", state: "CA" },
  { city: "Garland", state: "TX" },
  { city: "Irving", state: "TX" },
  { city: "Hialeah", state: "FL" },
  { city: "Richmond", state: "VA" },
  { city: "Boise", state: "ID" },
  { city: "Spokane", state: "WA" },
  { city: "Baton Rouge", state: "LA" }
];

export const NICHES = [
  { label: "Dentist", category: "healthcare.dentist" },
  { label: "Restaurant", category: "catering.restaurant" },
  { label: "Lawyer", category: "service.financial.lawyer" },
  { label: "Gym / Fitness", category: "leisure.sport.fitness" },
  { label: "Plumbing", category: "service.construction.plumber" },
  { label: "HVAC", category: "service.construction.hvac" },
  { label: "Roofing", category: "service.construction.roofing" },
  { label: "Auto Repair", category: "service.vehicle.repair" },
  { label: "Real Estate", category: "service.real_estate" },
  { label: "Marketing", category: "office.advertising" }
];

export interface ProviderOption {
  id: 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'groq' | 'custom';
  name: string;
  badge: string;
  color: string;
  models: { id: string; name: string; tag?: string }[];
  defaultModel: string;
  keyPlaceholder: string;
  envKeyName: string;
  defaultBaseUrl?: string;
  description: string;
}

export const AI_PROVIDERS: ProviderOption[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    badge: 'Gemini 2.5',
    color: 'indigo',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'Fast & Smart' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tag: 'Deep Reasoning' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tag: 'Legacy Fast' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', tag: 'Legacy Pro' }
    ],
    defaultModel: 'gemini-2.5-flash',
    keyPlaceholder: 'AIzaSy...',
    envKeyName: 'GEMINI_API_KEY',
    description: 'Native Google GenAI with high-speed visual screenshot analysis.'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    badge: 'GPT-4o',
    color: 'emerald',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', tag: 'Flagship Multimodal' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', tag: 'Affordable & Quick' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', tag: 'High Precision' },
      { id: 'o3-mini', name: 'o3 Mini', tag: 'Reasoning' }
    ],
    defaultModel: 'gpt-4o-mini',
    keyPlaceholder: 'sk-proj-...',
    envKeyName: 'OPENAI_API_KEY',
    defaultBaseUrl: 'https://api.openai.com/v1',
    description: 'OpenAI GPT-4o family with vision parsing and email drafting.'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: 'Claude 3.7',
    color: 'amber',
    models: [
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', tag: 'Hybrid Thinking' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tag: 'Top Vision & Copy' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tag: 'Ultra-Fast' }
    ],
    defaultModel: 'claude-3-5-sonnet-20241022',
    keyPlaceholder: 'sk-ant-api03-...',
    envKeyName: 'ANTHROPIC_API_KEY',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    description: 'Claude models with nuanced visual assessment and peer-to-peer copywriting.'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    badge: 'Unified Router',
    color: 'purple',
    models: [
      { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic Claude 3.5 Sonnet' },
      { id: 'google/gemini-2.5-flash', name: 'Google Gemini 2.5 Flash' },
      { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' }
    ],
    defaultModel: 'openai/gpt-4o',
    keyPlaceholder: 'sk-or-v1-...',
    envKeyName: 'OPENROUTER_API_KEY',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    description: 'Universal gateway to over 200+ models with one unified API key.'
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    badge: 'Ultra Fast',
    color: 'orange',
    models: [
      { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision', tag: 'Vision & Fast' },
      { id: 'llama-3.2-11b-vision-preview', name: 'Llama 3.2 11B Vision', tag: 'Ultra Lightweight' },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', tag: 'Text Powerhouse' }
    ],
    defaultModel: 'llama-3.2-90b-vision-preview',
    keyPlaceholder: 'gsk_...',
    envKeyName: 'GROQ_API_KEY',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    description: 'LPUs offering lightning-fast speeds for instant audits and drafts.'
  },
  {
    id: 'custom',
    name: 'Custom / Ollama / Local',
    badge: 'Self-Hosted',
    color: 'sky',
    models: [
      { id: 'custom', name: 'Custom Model ID' },
      { id: 'llava', name: 'Ollama LLaVA (Vision)' },
      { id: 'llama3.2-vision', name: 'Ollama LLaMA 3.2 Vision' }
    ],
    defaultModel: 'custom',
    keyPlaceholder: 'API Key (leave blank if local/unauthenticated)',
    envKeyName: 'CUSTOM_AI_API_KEY',
    defaultBaseUrl: 'http://localhost:11434/v1',
    description: 'Connect any OpenAI-compatible API endpoint, local Ollama, vLLM, or LM Studio.'
  }
];
