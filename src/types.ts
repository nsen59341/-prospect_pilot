/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  coldEmail?: string;
  screenshotUrl?: string;
  status: 'idle' | 'processing' | 'completed' | 'failed';
}

export interface ProgressState {
  step: 'scraping' | 'extracting' | 'capturing' | 'auditing' | 'drafting' | 'idle';
  percent: number;
}
