/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  Globe, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ShieldCheck, 
  FileText, 
  Copy,
  ChevronRight,
  TrendingDown,
  ExternalLink,
  Loader2,
  Trash2,
  Sliders,
  Sparkles,
  Zap,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lead, ProgressState, AIConfig } from './types.ts';
import { US_CITIES, NICHES, AI_PROVIDERS } from './constants.ts';
import AISettingsModal from './components/AISettingsModal.tsx';
import { safeFetchJson } from './utils/api.ts';

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'gemini',
  model: 'gemini-2.5-flash'
};

export default function App() {
  const [niche, setNiche] = useState(NICHES[0].label);
  const [city, setCity] = useState(US_CITIES[0].city);
  const [state, setState] = useState(US_CITIES[0].state);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingLeadId, setProcessingLeadId] = useState<string | null>(null);
  const [activeTabMapping, setActiveTabMapping] = useState<Record<string, 'audit' | 'email'>>({});
  const [manualEmails, setManualEmails] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // AI Configuration State
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    try {
      const saved = localStorage.getItem('prospectpilot_ai_config');
      return saved ? JSON.parse(saved) : DEFAULT_AI_CONFIG;
    } catch {
      return DEFAULT_AI_CONFIG;
    }
  });
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Save AI Config to localStorage
  const handleSaveAiConfig = (newConfig: AIConfig) => {
    setAiConfig(newConfig);
    try {
      localStorage.setItem('prospectpilot_ai_config', JSON.stringify(newConfig));
    } catch {}
  };

  // Find active provider info
  const activeProvider = useMemo(() => {
    return AI_PROVIDERS.find(p => p.id === aiConfig.provider) || AI_PROVIDERS[0];
  }, [aiConfig.provider]);

  // Auto-update state when city changes
  useEffect(() => {
    const found = US_CITIES.find(c => c.city === city);
    if (found) {
      setState(found.state);
    }
  }, [city]);

  const handleSearch = async () => {
    setLoading(true);
    setLeads([]);
    try {
      const selectedNiche = NICHES.find(n => n.label === niche);
      const data = await safeFetchJson<Lead[]>('/api/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, city, state, category: selectedNiche?.category })
      });
      setLeads(data || []);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Search failed. Check your API key or server configuration.");
    } finally {
      setLoading(false);
    }
  };

  const processLead = async (lead: Lead) => {
    setProcessingLeadId(lead.id);
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'processing', error: undefined } : l));

    try {
      // 1. Extract Contact
      const extractData = await safeFetchJson<{ emails?: string[] }>('/api/leads/extract-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: lead.website })
      }).catch(() => ({ emails: [] }));
      const emails = extractData.emails || [];
      
      // 2. Audit Website with active AI provider
      const audit = await safeFetchJson<{
        score: number;
        detail: string;
        pains?: string[];
        gaps?: string[];
        screenshotUrl?: string;
        error?: string;
      }>('/api/leads/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          website: lead.website, 
          name: lead.name,
          aiConfig
        })
      });
      if (audit.error) throw new Error(audit.error);

      // 3. Generate Email with active AI provider
      const draft = await safeFetchJson<{
        subject?: string;
        body?: string;
        error?: string;
      }>('/api/leads/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lead, 
          audit,
          aiConfig
        })
      });
      if (draft.error) throw new Error(draft.error);

      const updatedLead: Lead = {
        ...lead,
        emails: emails && emails.length > 0 ? emails : undefined,
        auditScore: audit.score,
        auditDetail: audit.detail,
        auditPains: audit.pains,
        auditGaps: audit.gaps,
        screenshotUrl: audit.screenshotUrl,
        coldEmail: draft.body,
        coldEmailSubject: draft.subject,
        status: 'completed' as const
      };

      setLeads(prev => prev.map(l => l.id === lead.id ? updatedLead : l));
      if (emails?.[0]) {
        setManualEmails(prev => ({ ...prev, [lead.id]: emails[0] }));
      }
      setActiveTabMapping(prev => ({ ...prev, [lead.id]: 'audit' }));
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || 'Processing failed. Check AI provider API key.';
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'failed', error: errMsg } : l));
    } finally {
      setProcessingLeadId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const removeLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  return (
    <div id="app-container" className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="flex items-center justify-between px-6 sm:px-8 py-3.5 border-b border-white/10 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="text-white w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white">ProspectPilot</h1>
            <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase font-semibold tracking-wider">Multi-AI</span>
          </div>
        </div>

        {/* AI Engine Selector & Controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            id="ai-provider-button"
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 hover:text-white transition-all shadow-sm group"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              <span className="font-semibold text-white">{activeProvider.name}</span>
              <span className="text-slate-400 text-[11px] hidden md:inline font-mono">
                ({aiConfig.customModel || aiConfig.model})
              </span>
            </div>
            <Sliders className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-400 transition-colors ml-0.5" />
          </button>

          <button
            onClick={() => setIsAiModalOpen(true)}
            className="p-2 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 transition-all text-xs font-medium flex items-center gap-1.5"
            title="Configure AI API Keys & Models"
          >
            <Key className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Keys</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 sm:px-8 py-0">
        {/* Search Panel / Nav */}
        <nav className="flex flex-col md:flex-row items-center gap-4 py-6 bg-transparent">
          <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Niche / Industry</label>
              <select 
                value={niche} 
                onChange={(e) => setNiche(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
              >
                {NICHES.map(n => <option key={n.label} value={n.label}>{n.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">City</label>
              <select 
                value={city} 
                onChange={(e) => setCity(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
              >
                {US_CITIES.map(c => <option key={c.city} value={c.city}>{c.city}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">State</label>
              <input 
                type="text" 
                value={state} 
                readOnly 
                className="bg-slate-900/50 border border-white/5 rounded-lg px-4 py-2.5 text-xs text-slate-400 cursor-not-allowed italic" 
              />
            </div>
          </div>
          <button 
            id="search-leads-button"
            onClick={handleSearch}
            disabled={loading}
            className="w-full md:w-auto mt-0 md:mt-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-8 py-2.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 text-xs"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{loading ? 'Searching Local Leads...' : 'Find Leads'}</span>
          </button>
        </nav>

        {/* Results */}
        <div className="space-y-6">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
            <span className="uppercase tracking-wider font-semibold text-slate-400">
              Found Results ({leads.length})
            </span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">AI Powered by:</span>
              <span className="font-semibold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/50">
                {activeProvider.name} ({aiConfig.customModel || aiConfig.model})
              </span>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {leads.map((lead, index) => {
                const isCompleted = lead.status === 'completed';
                const isFailed = lead.status === 'failed';
                const score = lead.auditScore || 0;
                const scoreColor = score >= 70 ? 'emerald' : score >= 50 ? 'amber' : 'red';
                
                return (
                  <motion.div 
                    key={lead.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-slate-900/60 rounded-xl border border-white/10 shadow-xl transition-all overflow-hidden ${
                      isCompleted ? 'bg-slate-900/80 border-slate-700/80' : isFailed ? 'border-red-500/40 bg-red-950/20' : 'opacity-90'
                    }`}
                    layout
                  >
                    {/* Lead Header */}
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-bold text-sm truncate ${isCompleted ? 'text-white' : 'text-slate-200'}`}>
                            {lead.name}
                          </h3>
                          {isCompleted && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              score >= 70 
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' 
                                : score >= 50 
                                  ? 'bg-amber-950 text-amber-400 border border-amber-800/50' 
                                  : 'bg-red-950 text-red-400 border border-red-800/50'
                            }`}>
                              Audit: {lead.auditScore}/100
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 truncate mb-2.5 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-500" />
                          <a 
                            href={lead.website} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="hover:text-indigo-400 transition-colors"
                          >
                            {lead.website.replace('https://', '').replace('http://', '')}
                          </a>
                        </p>
                        
                        <div className="flex items-center justify-between">
                          {isCompleted ? (
                            <div className="flex items-center gap-2">
                              {manualEmails[lead.id] ? (
                                <span className="text-[10px] bg-slate-950 px-2 py-1 rounded text-slate-300 font-mono flex items-center gap-1 border border-white/5">
                                  <Mail className="w-3 h-3 text-indigo-400" />
                                  {manualEmails[lead.id]}
                                </span>
                              ) : (
                                <span className="text-[10px] bg-slate-950 px-2 py-1 rounded text-slate-400 italic">
                                  Contact page crawl complete
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{lead.address}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {lead.status === 'idle' && (
                          <button 
                            onClick={() => processLead(lead)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all text-xs font-semibold shadow-md shadow-indigo-600/20 active:scale-95"
                          >
                            <span>Audit</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {lead.status === 'processing' && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-950/60 border border-indigo-800/60 rounded-lg text-indigo-400 text-xs">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Auditing ({activeProvider.badge})...</span>
                          </div>
                        )}

                        {lead.status === 'failed' && (
                          <button 
                            onClick={() => processLead(lead)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-300 rounded-lg text-xs transition-colors"
                          >
                            <span>Retry</span>
                          </button>
                        )}

                        <button 
                          onClick={() => removeLead(lead.id)}
                          className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                          title="Remove Lead"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Failed Warning Banner */}
                    {isFailed && lead.error && (
                      <div className="px-4 py-2.5 bg-red-950/40 border-t border-red-900/40 flex items-center justify-between text-xs text-red-300">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                          <span className="truncate">{lead.error}</span>
                        </div>
                        <button
                          onClick={() => setIsAiModalOpen(true)}
                          className="px-2 py-1 bg-red-900/60 hover:bg-red-800 text-white rounded text-[10px] font-medium shrink-0 ml-2"
                        >
                          Configure Key
                        </button>
                      </div>
                    )}

                    {/* Expanded Detail Side-Effect Content */}
                    {isCompleted && (
                      <div className="p-4 pt-2 space-y-4 border-t border-white/5 bg-slate-950/40">
                        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg w-fit border border-slate-800">
                          <button 
                            onClick={() => setActiveTabMapping(prev => ({ ...prev, [lead.id]: 'audit' }))}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                              activeTabMapping[lead.id] === 'audit' 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            AI Visual Audit
                          </button>
                          <button 
                            onClick={() => setActiveTabMapping(prev => ({ ...prev, [lead.id]: 'email' }))}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                              activeTabMapping[lead.id] === 'email' 
                                ? 'bg-indigo-600 text-white shadow-sm' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Generated Cold Email
                          </button>
                        </div>

                        <div className="min-h-[140px]">
                          {activeTabMapping[lead.id] === 'audit' ? (
                            <div className="space-y-3">
                               <div className="flex flex-col sm:flex-row gap-4">
                                  {lead.screenshotUrl && (
                                    <div className="w-full sm:w-36 aspect-video bg-slate-900 rounded-lg border border-white/10 overflow-hidden shrink-0">
                                      <img 
                                        src={lead.screenshotUrl} 
                                        alt="Audit Screenshot" 
                                        className="w-full h-full object-cover" 
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <p className="text-xs text-slate-300 leading-relaxed mb-3">
                                      "{lead.auditDetail}"
                                    </p>
                                    <div className="flex gap-1.5 flex-wrap">
                                      {lead.auditGaps?.map((g: string, i: number) => (
                                        <span 
                                          key={i} 
                                          className="px-2 py-0.5 rounded bg-slate-900 border border-indigo-500/20 text-[10px] text-indigo-300 font-medium"
                                        >
                                          • {g}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                               </div>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                               <div className="space-y-1">
                                  <label className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Subject</label>
                                  <p className="text-xs font-medium text-white bg-slate-900 p-2 rounded-md border border-white/5 font-mono">
                                    {lead.coldEmailSubject}
                                  </p>
                               </div>
                               <div className="relative group">
                                  <div className="w-full bg-slate-900 border border-white/10 rounded-lg p-3 text-xs text-slate-200 leading-relaxed whitespace-pre-line min-h-[90px] font-sans">
                                    {lead.coldEmail}
                                  </div>
                                  <button 
                                    onClick={() => copyToClipboard(lead.coldEmail || '', lead.id)}
                                    className="absolute top-2 right-2 p-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 rounded-md transition-all flex items-center gap-1 text-[11px] border border-indigo-500/30"
                                  >
                                    {copiedId === lead.id ? (
                                      <>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-400 text-[10px]">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span className="text-[10px]">Copy</span>
                                      </>
                                    )}
                                  </button>
                               </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>

          {leads.length === 0 && !loading && (
             <div className="py-20 border border-white/5 bg-slate-900/30 rounded-2xl flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center border border-white/10">
                  <Search className="w-6 h-6 text-slate-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">No Leads Loaded Yet</h3>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Select a target niche and US city above to scan high-intent prospects, extract direct contacts, and generate AI-driven audit pitches.
                  </p>
                </div>
             </div>
          )}
        </div>
      </main>

      {/* Sleek Bottom Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 px-6 sm:px-8 py-2.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-slate-300 z-30 backdrop-blur-md">
        <div className="flex items-center gap-4 text-xs">
           <div className="flex items-center gap-2">
             <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
             <span className="text-[11px] text-slate-300">
               Engine: <strong className="text-white">{activeProvider.name}</strong> ({aiConfig.customModel || aiConfig.model})
             </span>
           </div>
           {processingLeadId && (
             <span className="text-[11px] text-indigo-400 flex items-center gap-1.5">
               <Loader2 className="w-3 h-3 animate-spin" />
               Processing lead audit...
             </span>
           )}
        </div>

        <button
          onClick={() => setIsAiModalOpen(true)}
          className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
        >
          <span>Switch AI Model</span>
          <Sliders className="w-3 h-3" />
        </button>
      </footer>
      
      {/* AI Settings Modal */}
      <AISettingsModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        config={aiConfig}
        onSave={handleSaveAiConfig}
      />

      {/* Spacer for fixed footer */}
      <div className="h-16" />
    </div>
  );
}

