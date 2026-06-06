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
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Lead, ProgressState } from './types.ts';
import { US_CITIES, NICHES } from './constants.ts';

export default function App() {
  const [niche, setNiche] = useState(NICHES[0].label);
  const [city, setCity] = useState(US_CITIES[0].city);
  const [state, setState] = useState(US_CITIES[0].state);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingLeadId, setProcessingLeadId] = useState<string | null>(null);
  const [activeTabMapping, setActiveTabMapping] = useState<Record<string, 'audit' | 'email'>>({});
  const [manualEmails, setManualEmails] = useState<Record<string, string>>({});

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
      const response = await fetch('/api/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, city, state, category: selectedNiche?.category })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setLeads(data);
    } catch (err) {
      console.error(err);
      alert("Search failed. Check your API key.");
    } finally {
      setLoading(false);
    }
  };

  const processLead = async (lead: Lead) => {
    setProcessingLeadId(lead.id);
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'processing' } : l));

    try {
      // 1. Extract Contact
      const extractRes = await fetch('/api/leads/extract-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: lead.website })
      });
      const { emails } = await extractRes.json();
      
      // 2. Audit Website
      const auditRes = await fetch('/api/leads/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: lead.website, name: lead.name })
      });
      const audit = await auditRes.json();

      // 3. Generate Email
      const emailRes = await fetch('/api/leads/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead, audit })
      });
      const draft = await emailRes.json();

      const updatedLead = {
        ...lead,
        emails,
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
    } catch (err) {
      console.error(err);
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'failed' } : l));
    } finally {
      setProcessingLeadId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const removeLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  return (
    <div id="app-container" className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">ProspectPilot</h1>
          <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase font-semibold tracking-wider">v2.1 Pro</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-[10px] text-slate-400 font-mono">API_READY: GEOAPIFY_ACTIVE</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
            <div className="w-4 h-4 bg-slate-600 rounded-full" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-0">
        {/* Search Panel / Nav */}
        <nav className="flex flex-col md:flex-row items-center gap-4 py-8 bg-transparent">
          <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Niche / Industry</label>
              <select 
                value={niche} 
                onChange={(e) => setNiche(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
              >
                {NICHES.map(n => <option key={n.label} value={n.label}>{n.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">City</label>
              <select 
                value={city} 
                onChange={(e) => setCity(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all appearance-none cursor-pointer"
              >
                {US_CITIES.map(c => <option key={c.city} value={c.city}>{c.city}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">State</label>
              <input 
                type="text" 
                value={state} 
                readOnly 
                className="bg-slate-900/50 border border-white/5 rounded-lg px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed italic" 
              />
            </div>
          </div>
          <button 
            onClick={handleSearch}
            disabled={loading}
            className="w-full md:w-auto mt-0 md:mt-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-8 py-2.5 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{loading ? 'Finding...' : 'Find Leads'}</span>
          </button>
        </nav>

        {/* Results */}
        <div className="space-y-6">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Found Results ({leads.length})</span>
            <span className="text-indigo-400">Sort: Score</span>
          </div>

          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {leads.map((lead, index) => {
                const isCompleted = lead.status === 'completed';
                const scoreColor = (lead.auditScore || 0) > 75 ? 'emerald' : (lead.auditScore || 0) > 50 ? 'yellow' : 'red';
                
                return (
                  <motion.div 
                    key={lead.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ delay: index * 0.05 }}
                    className={`bg-slate-900/40 rounded-r-xl border-y border-r border-white/5 shadow-xl transition-all ${
                      isCompleted ? `border-l-4 border-l-${scoreColor}-500 bg-slate-800` : 'border-l-4 border-l-slate-700 opacity-80'
                    }`}
                    layout
                  >
                    {/* Lead Header */}
                    <div className="p-4 flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-bold text-sm truncate ${isCompleted ? 'text-white' : 'text-slate-300'}`}>{lead.name}</h3>
                          {isCompleted && (
                            <span className={`text-[10px] font-bold text-${scoreColor}-400 px-2 py-0.5 bg-${scoreColor}-400/10 rounded`}>
                              {lead.auditScore}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mb-3">{lead.website.replace('https://', '').replace('http://', '')}</p>
                        
                        <div className="flex items-center justify-between">
                          {isCompleted ? (
                            <div className="flex items-center gap-2">
                              {manualEmails[lead.id] ? (
                                <span className="text-[10px] bg-slate-950 px-2 py-1 rounded text-slate-400 font-mono">{manualEmails[lead.id]}</span>
                              ) : (
                                <span className="text-[10px] bg-slate-950 px-2 py-1 rounded text-slate-500 italic">Email Needed</span>
                              )}
                              <div className="flex gap-1">
                                <div className={`w-1.5 h-1.5 rounded-full bg-${scoreColor}-500`}></div>
                                <div className={`w-1.5 h-1.5 rounded-full bg-${scoreColor}-500`}></div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                               <MapPin className="w-3 h-3 text-slate-600" />
                               <span className="text-[10px] text-slate-600 truncate">{lead.address}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {lead.status === 'idle' && (
                          <button 
                            onClick={() => processLead(lead)}
                            className="p-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 rounded-lg transition-all"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                        {lead.status === 'processing' && (
                          <div className="p-2">
                            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                          </div>
                        )}
                        <button 
                          onClick={() => removeLead(lead.id)}
                          className="p-2 hover:bg-red-500/10 text-slate-600 hover:text-red-400 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Detail Side-Effect Content */}
                    {isCompleted && (
                      <div className="p-4 pt-0 space-y-4 border-t border-white/5 mt-2">
                        <div className="flex gap-px bg-white/5 p-1 rounded-lg w-fit mt-4">
                          <button 
                            onClick={() => setActiveTabMapping(prev => ({ ...prev, [lead.id]: 'audit' }))}
                            className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeTabMapping[lead.id] === 'audit' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            Audit Detail
                          </button>
                          <button 
                            onClick={() => setActiveTabMapping(prev => ({ ...prev, [lead.id]: 'email' }))}
                            className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeTabMapping[lead.id] === 'email' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                          >
                            Cold Email
                          </button>
                        </div>

                        <div className="min-h-[160px]">
                          {activeTabMapping[lead.id] === 'audit' ? (
                            <div className="space-y-4 animate-in fade-in duration-300">
                               <div className="flex gap-4">
                                  {lead.screenshotUrl && (
                                    <div className="w-32 aspect-video bg-slate-900 rounded border border-white/5 overflow-hidden shrink-0">
                                      <img src={lead.screenshotUrl} alt="Audit Screenshot" className="w-full h-full object-cover opacity-60" />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <p className="text-[11px] text-slate-400 leading-relaxed italic mb-3">"{lead.auditDetail}"</p>
                                    <div className="flex gap-2 flex-wrap">
                                      {(lead as any).auditGaps?.slice(0, 2).map((g: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-white/5 text-[9px] text-slate-400 uppercase font-bold tracking-tighter">
                                          {g}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                               </div>
                            </div>
                          ) : (
                            <div className="space-y-3 animate-in fade-in duration-300">
                               <div className="space-y-1">
                                  <label className="text-[9px] uppercase font-bold text-indigo-400 tracking-wider">Subject</label>
                                  <p className="text-xs font-medium text-white bg-slate-950/50 p-2 rounded border border-white/5">{(lead as any).coldEmailSubject}</p>
                               </div>
                               <div className="relative group">
                                  <div className="w-full bg-slate-950/50 border border-white/10 rounded-lg p-3 text-xs text-slate-300 leading-relaxed font-serif italic whitespace-pre-line min-h-[100px]">
                                    {lead.coldEmail}
                                  </div>
                                  <button 
                                    onClick={() => copyToClipboard(lead.coldEmail || '')}
                                    className="absolute top-2 right-2 p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
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
             <div className="py-24 border border-white/5 bg-slate-900/20 rounded-2xl flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center border border-white/5">
                  <Search className="w-6 h-6 text-slate-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Market is Cold</h3>
                  <p className="text-xs text-slate-500">Search a niche and city to find hot leads for audit.</p>
                </div>
             </div>
          )}
        </div>
      </main>

      {/* Sleek Footer Bar */}
      <footer className="fixed bottom-0 left-0 right-0 px-8 py-3 bg-indigo-600 flex items-center justify-between text-white z-50">
        <div className="flex items-center gap-4">
           <span className="text-[10px] font-bold">SYSTEM STATUS:</span>
           <div className="flex items-center gap-1">
             <span className="text-[10px] opacity-70">Scraping</span>
             <div className="w-8 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className={`h-full bg-white transition-all duration-500 ${loading ? 'w-2/3' : 'w-full'}`}></div>
             </div>
             <span className="text-[10px] opacity-70 ml-2">Pilot Mode</span>
             <div className="w-8 h-1 bg-white/20 rounded-full overflow-hidden">
                <div className={`h-full bg-white transition-all duration-500 ${processingLeadId ? 'w-1/2 animate-pulse' : 'w-full'}`}></div>
             </div>
           </div>
        </div>
        <div className="text-[10px] font-mono tracking-widest hidden sm:block">SYSTEMS_STABLE_READY_TO_PILOT</div>
      </footer>
      
      {/* Spacer for fixed footer */}
      <div className="h-16" />
    </div>
  );
}
