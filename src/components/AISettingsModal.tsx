/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  Sparkles, 
  Check, 
  ExternalLink, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Zap, 
  Server, 
  Sliders,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Globe
} from 'lucide-react';
import { AIConfig, AIProvider } from '../types.ts';
import { AI_PROVIDERS, ProviderOption } from '../constants.ts';
import { safeFetchJson } from '../utils/api.ts';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  onSave: (newConfig: AIConfig) => void;
}

export default function AISettingsModal({
  isOpen,
  onClose,
  config,
  onSave
}: AISettingsModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(config.provider || 'gemini');
  const [selectedModel, setSelectedModel] = useState<string>(config.model || 'gemini-2.5-flash');
  const [customModelInput, setCustomModelInput] = useState<string>(config.customModel || '');
  const [useCustomModel, setUseCustomModel] = useState<boolean>(Boolean(config.customModel));
  const [apiKey, setApiKey] = useState<string>(config.apiKey || '');
  const [baseUrl, setBaseUrl] = useState<string>(config.baseUrl || '');
  const [geoapifyKey, setGeoapifyKey] = useState<string>(() => {
    try {
      return localStorage.getItem('prospectpilot_geoapify_key') || '';
    } catch {
      return '';
    }
  });
  const [showKey, setShowKey] = useState<boolean>(false);
  
  // Test connection state
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [serverKeys, setServerKeys] = useState<Record<string, boolean>>({});

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProvider(config.provider || 'gemini');
      setSelectedModel(config.model || 'gemini-2.5-flash');
      setCustomModelInput(config.customModel || '');
      setUseCustomModel(Boolean(config.customModel));
      setApiKey(config.apiKey || '');
      setBaseUrl(config.baseUrl || '');
      setTestResult(null);

      // Fetch server key status safely
      safeFetchJson<Record<string, boolean>>('/api/ai/server-status')
        .then(data => setServerKeys(data || {}))
        .catch(() => {
          // In static hosting without backend, serverKeys remains empty
        });
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const currentProviderInfo = AI_PROVIDERS.find(p => p.id === selectedProvider) || AI_PROVIDERS[0];
  const hasServerKey = Boolean(serverKeys[selectedProvider]);

  const handleProviderSelect = (prov: ProviderOption) => {
    setSelectedProvider(prov.id);
    setSelectedModel(prov.defaultModel);
    setUseCustomModel(false);
    setTestResult(null);
    if (prov.defaultBaseUrl) {
      setBaseUrl(prov.defaultBaseUrl);
    } else {
      setBaseUrl('');
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    const testConfig: AIConfig = {
      provider: selectedProvider,
      model: useCustomModel && customModelInput.trim() ? customModelInput.trim() : selectedModel,
      apiKey: apiKey.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
      customModel: useCustomModel && customModelInput.trim() ? customModelInput.trim() : undefined
    };

    try {
      const data = await safeFetchJson<{ ok: boolean; message: string }>('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiConfig: testConfig })
      });
      
      if (data && data.ok) {
        setTestResult({ ok: true, message: data.message || 'Connection verified successfully!' });
      } else {
        setTestResult({ ok: false, message: data?.message || 'Failed to authenticate with provider.' });
      }
    } catch (err: any) {
      // If backend test failed, check if client API key was supplied and test direct if possible
      const keyVal = apiKey.trim();
      if (keyVal && selectedProvider === 'gemini') {
        try {
          const directRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(keyVal)}`);
          if (directRes.ok) {
            setTestResult({ ok: true, message: 'Google Gemini API Key is valid and active!' });
            return;
          }
        } catch {}
      } else if (keyVal && selectedProvider === 'openai') {
        try {
          const directRes = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${keyVal}` }
          });
          if (directRes.ok) {
            setTestResult({ ok: true, message: 'OpenAI API Key is valid and active!' });
            return;
          }
        } catch {}
      } else if (keyVal && selectedProvider === 'openrouter') {
        try {
          const directRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
            headers: { 'Authorization': `Bearer ${keyVal}` }
          });
          if (directRes.ok) {
            setTestResult({ ok: true, message: 'OpenRouter API Key is valid and active!' });
            return;
          }
        } catch {}
      } else if (keyVal && selectedProvider === 'groq') {
        try {
          const directRes = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { 'Authorization': `Bearer ${keyVal}` }
          });
          if (directRes.ok) {
            setTestResult({ ok: true, message: 'Groq API Key is valid and active!' });
            return;
          }
        } catch {}
      }

      setTestResult({ ok: false, message: err?.message || 'Network error testing AI provider.' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const finalModel = useCustomModel && customModelInput.trim() ? customModelInput.trim() : selectedModel;
    const newConfig: AIConfig = {
      provider: selectedProvider,
      model: finalModel,
      apiKey: apiKey.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
      customModel: useCustomModel && customModelInput.trim() ? customModelInput.trim() : undefined
    };
    try {
      if (geoapifyKey.trim()) {
        localStorage.setItem('prospectpilot_geoapify_key', geoapifyKey.trim());
      } else {
        localStorage.removeItem('prospectpilot_geoapify_key');
      }
    } catch {}
    onSave(newConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="ai-settings-dialog" 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                AI Provider & Model Settings
              </h2>
              <p className="text-xs text-slate-400">
                Configure OpenAI, Anthropic Claude, Gemini, OpenRouter, Groq, or Custom endpoints
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Provider Selection Cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Select AI Engine
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {AI_PROVIDERS.map((prov) => {
                const isSelected = selectedProvider === prov.id;
                const isEnvActive = Boolean(serverKeys[prov.id]);

                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleProviderSelect(prov)}
                    className={`relative text-left p-3 rounded-xl border transition-all flex flex-col justify-between min-h-[82px] ${
                      isSelected
                        ? 'bg-indigo-950/50 border-indigo-500 text-white ring-1 ring-indigo-500/50'
                        : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="font-semibold text-xs text-white">{prov.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">{prov.badge}</span>
                      {isEnvActive ? (
                        <span className="text-[9px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/50 flex items-center gap-1 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          ENV
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {currentProviderInfo.description}
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Model Choice
              </label>
              <button
                type="button"
                onClick={() => setUseCustomModel(!useCustomModel)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {useCustomModel ? 'Pick from presets' : 'Enter custom model ID'}
              </button>
            </div>

            {useCustomModel ? (
              <div>
                <input
                  type="text"
                  placeholder="e.g. gpt-4o-2024-11-20 or claude-3-7-sonnet-20250219"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Specify any specific model ID supported by your provider or endpoint.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentProviderInfo.models.map((mod) => {
                  const isModSelected = selectedModel === mod.id;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => setSelectedModel(mod.id)}
                      className={`p-2.5 rounded-lg border text-left flex items-center justify-between text-xs transition-all ${
                        isModSelected
                          ? 'bg-slate-800 border-indigo-500/80 text-white font-medium shadow-sm'
                          : 'bg-slate-950/60 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="truncate">{mod.name}</span>
                      {mod.tag && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 border border-indigo-900/40 ml-2 shrink-0">
                          {mod.tag}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* API Key Input */}
          <div className="space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>{currentProviderInfo.name} API Key</span>
              </label>
              {hasServerKey && (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/40">
                  <CheckCircle2 className="w-3 h-3" /> Server key configured ({currentProviderInfo.envKeyName})
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={
                  hasServerKey 
                    ? `Optional: Using server ${currentProviderInfo.envKeyName}. Enter here to override.`
                    : currentProviderInfo.keyPlaceholder
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 pr-10 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-[10px] text-slate-400">
              Keys entered here are securely stored in your local browser state and used for lead audits & cold emails.
            </p>
          </div>

          {/* Base URL (for OpenRouter, Groq, Ollama, custom endpoints) */}
          {(selectedProvider === 'openrouter' || selectedProvider === 'groq' || selectedProvider === 'custom') && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>API Base URL</span>
              </label>
              <input
                type="text"
                placeholder={currentProviderInfo.defaultBaseUrl || 'https://api.example.com/v1'}
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500">
                Defaults to <code className="text-slate-400">{currentProviderInfo.defaultBaseUrl}</code>
              </p>
            </div>
          )}

          {/* Optional Geoapify Places Key */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Geoapify Places API Key</span>
                <span className="text-[10px] text-slate-500 font-normal">(Optional)</span>
              </label>
              {serverKeys.geoapify && (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-900/40">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Server Configured
                </span>
              )}
            </div>
            <input
              type="text"
              placeholder={serverKeys.geoapify ? "Server key active. Enter here to override." : "e.g. 7a8b9c... (or leave blank for free auto-search)"}
              value={geoapifyKey}
              onChange={(e) => setGeoapifyKey(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="text-[10px] text-slate-400">
              Leave blank to use the built-in free OpenStreetMap / US local directory search engine.
            </p>
          </div>

          {/* Connection Test Feedback */}
          {testResult && (
            <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
              testResult.ok 
                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300' 
                : 'bg-red-950/40 border-red-800/80 text-red-300'
            }`}>
              {testResult.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-[11px] leading-relaxed">
                <p className="font-semibold">{testResult.ok ? 'Connection Verified' : 'Authentication Error'}</p>
                <p className="text-slate-300 mt-0.5">{testResult.message}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
          >
            {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-400" />}
            <span>{testing ? 'Testing...' : 'Test Connection'}</span>
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-lg shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply AI Provider</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
