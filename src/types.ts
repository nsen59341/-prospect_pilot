/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'groq' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  customModel?: string;
}

export interface Lead {
  id: string;
  name: string;
  website: string;
  address: string;
  city: string;
  state: string;
  emails?: string[];
  auditScore?: number;
  auditDetail?: string;
  auditPains?: string[];
  auditGaps?: string[];
  coldEmail?: string;
  coldEmailSubject?: string;
  screenshotUrl?: string;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface ProgressState {
  step: 'scraping' | 'extracting' | 'capturing' | 'auditing' | 'drafting' | 'idle';
  percent: number;
}
