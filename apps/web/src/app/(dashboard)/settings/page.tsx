'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Settings,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = 'openai' | 'anthropic' | 'gemini';

interface ProviderRow {
  provider: Provider;
  model: string;
  apiKey: string;       // live input value (empty = keep existing)
  hasApiKey: boolean;   // loaded from server — key already stored
  enabled: boolean;
  priority: number;
  testStatus: 'idle' | 'testing' | 'ok' | 'error';
  testMessage: string;
}

// ─── Model catalogue ──────────────────────────────────────────────────────────

const MODELS: Record<Provider, Array<{ label: string; value: string }>> = {
  openai: [
    { label: 'GPT-5.2',      value: 'gpt-5.2' },
    { label: 'GPT-5.2 Pro',  value: 'gpt-5.2-pro' },
    { label: 'GPT-5.1',      value: 'gpt-5.1' },
    { label: 'GPT-5 Mini',   value: 'gpt-5-mini' },
    { label: 'GPT-5 Nano',   value: 'gpt-5-nano' },
  ],
  anthropic: [
    { label: 'Claude Opus 4.6',    value: 'claude-opus-4-6' },
    { label: 'Claude Sonnet 4.6',  value: 'claude-sonnet-4-6' },
    { label: 'Claude Haiku 4.5',   value: 'claude-haiku-4-5-20251001' },
    { label: 'Claude Opus 4.5',    value: 'claude-opus-4-5-20251101' },
    { label: 'Claude Sonnet 4.5',  value: 'claude-sonnet-4-5-20250929' },
  ],
  gemini: [
    { label: 'Gemini 3.1 Pro (Preview)',   value: 'gemini-3.1-pro-preview' },
    { label: 'Gemini 3 Pro (Preview)',     value: 'gemini-3-pro-preview' },
    { label: 'Gemini 3 Flash (Preview)',   value: 'gemini-3-flash-preview' },
    { label: 'Gemini 2.5 Pro',             value: 'gemini-2.5-pro' },
    { label: 'Gemini 2.5 Flash',           value: 'gemini-2.5-flash' },
  ],
};

const PROVIDER_META: Record<Provider, { name: string; color: string; placeholder: string }> = {
  openai:    { name: 'OpenAI',         color: 'bg-emerald-500', placeholder: 'sk-…' },
  anthropic: { name: 'Anthropic',      color: 'bg-orange-500',  placeholder: 'sk-ant-…' },
  gemini:    { name: 'Google Gemini',  color: 'bg-blue-500',    placeholder: 'AIza…' },
};

const DEFAULT_ROWS: ProviderRow[] = [
  { provider: 'openai',    model: 'gpt-5-mini',        apiKey: '', hasApiKey: false, enabled: false, priority: 1, testStatus: 'idle', testMessage: '' },
  { provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: '', hasApiKey: false, enabled: false, priority: 2, testStatus: 'idle', testMessage: '' },
  { provider: 'gemini',    model: 'gemini-2.5-flash',  apiKey: '', hasApiKey: false, enabled: false, priority: 3, testStatus: 'idle', testMessage: '' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [rows, setRows] = useState<ProviderRow[]>(DEFAULT_ROWS);
  const [showKeys, setShowKeys] = useState<Record<Provider, boolean>>({ openai: false, anthropic: false, gemini: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // ── Load saved settings ────────────────────────────────────────────────────

  useEffect(() => {
    api.get<{ providers: Array<{ provider: Provider; model: string; hasApiKey: boolean; enabled: boolean; priority: number }> }>('/settings/llm')
      .then(({ data }) => {
        const sorted = [...data.providers].sort((a, b) => a.priority - b.priority);
        setRows(
          sorted.map((p) => ({
            provider: p.provider,
            model: p.model,
            apiKey: '',
            hasApiKey: p.hasApiKey,
            enabled: p.enabled,
            priority: p.priority,
            testStatus: 'idle',
            testMessage: '',
          })),
        );
      })
      .catch(() => {/* use defaults */})
      .finally(() => setLoading(false));
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const updateRow = (provider: Provider, patch: Partial<ProviderRow>) => {
    setRows((prev) => prev.map((r) => r.provider === provider ? { ...r, ...patch } : r));
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= rows.length) return;
    setRows((prev) => {
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr.map((r, i) => ({ ...r, priority: i + 1 }));
    });
  };

  // ── Test a provider ──────────────────────────────────────────────────────

  const handleTest = async (provider: Provider) => {
    const row = rows.find((r) => r.provider === provider)!;
    updateRow(provider, { testStatus: 'testing', testMessage: '' });
    try {
      const { data } = await api.post<{ ok: boolean; message: string }>(
        `/settings/llm/test/${provider}`,
        { apiKey: row.apiKey || undefined },
      );
      updateRow(provider, { testStatus: data.ok ? 'ok' : 'error', testMessage: data.message });
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Request failed';
      updateRow(provider, { testStatus: 'error', testMessage: msg });
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await api.patch('/settings/llm', {
        providers: rows.map((r, i) => ({
          provider: r.provider,
          model: r.model,
          apiKey: r.apiKey || undefined,
          enabled: r.enabled,
          priority: i + 1,
        })),
      });
      // Reload to refresh hasApiKey flags
      const { data } = await api.get<{ providers: any[] }>('/settings/llm');
      const sorted = [...data.providers].sort((a, b) => a.priority - b.priority);
      setRows((prev) =>
        sorted.map((p) => {
          const existing = prev.find((r) => r.provider === p.provider)!;
          return { ...existing, hasApiKey: p.hasApiKey, apiKey: '' };
        }),
      );
      setSaveMsg('Settings saved!');
    } catch (err: any) {
      setSaveMsg(err?.response?.data?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Loading settings…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500 mt-1">Configure LLM providers and system settings</p>
      </div>

      <div className="max-w-2xl space-y-6">

        {/* ── LLM Providers ──────────────────────────────────────────────────── */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-2">
            <Settings size={20} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900">LLM Providers</h3>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Drag to reorder. Providers are tried top-to-bottom — if the first fails the next is used automatically.
          </p>

          <div className="space-y-4">
            {rows.map((row, index) => {
              const meta = PROVIDER_META[row.provider];
              return (
                <div key={row.provider} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-center gap-3">
                    {/* Priority arrows */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveRow(index, -1)}
                        disabled={index === 0}
                        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => moveRow(index, 1)}
                        disabled={index === rows.length - 1}
                        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>

                    {/* Priority badge */}
                    <span className="text-xs font-bold text-gray-400 w-4">#{index + 1}</span>

                    {/* Provider badge */}
                    <div className={`w-8 h-8 rounded-lg ${meta.color} flex items-center justify-center text-white text-xs font-bold`}>
                      {meta.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900 flex-1">{meta.name}</span>

                    {/* Enabled toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        onClick={() => updateRow(row.provider, { enabled: !row.enabled })}
                        className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${row.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${row.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-sm text-gray-500">{row.enabled ? 'Active' : 'Off'}</span>
                    </label>
                  </div>

                  {/* Model + API key */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Model */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                      <select
                        value={row.model}
                        onChange={(e) => updateRow(row.provider, { model: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {MODELS[row.provider].map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* API Key */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        API Key
                        {row.hasApiKey && (
                          <span className="ml-1 text-green-600 font-normal">(stored ✓)</span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type={showKeys[row.provider] ? 'text' : 'password'}
                          value={row.apiKey}
                          placeholder={row.hasApiKey ? '••••••••  (leave blank to keep)' : meta.placeholder}
                          onChange={(e) => updateRow(row.provider, { apiKey: e.target.value, testStatus: 'idle', testMessage: '' })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKeys((k) => ({ ...k, [row.provider]: !k[row.provider] }))}
                          className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                        >
                          {showKeys[row.provider] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Test row */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleTest(row.provider)}
                      disabled={row.testStatus === 'testing' || (!row.apiKey && !row.hasApiKey)}
                      className="btn-secondary py-1 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {row.testStatus === 'testing' ? (
                        <><Loader2 size={12} className="animate-spin" /> Testing…</>
                      ) : 'Test Connection'}
                    </button>

                    {row.testStatus === 'ok' && (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle size={14} /> {row.testMessage}
                      </span>
                    )}
                    {row.testStatus === 'error' && (
                      <span className="flex items-center gap-1 text-sm text-red-600">
                        <XCircle size={14} /> {row.testMessage}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Slack Endpoint ─────────────────────────────────────────────────── */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-3">Slack Events Endpoint</h3>
          <div className="bg-gray-50 rounded-md p-4 font-mono text-sm text-gray-700 break-all">
            {process.env.NEXT_PUBLIC_API_URL ?? 'https://api.cslai.corporatespec.com'}
            /integrations/slack/events
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Use this URL when configuring your Slack app's Event Subscriptions.
          </p>
        </div>

        {/* ── Save ────────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saveMsg && (
            <span className={`text-sm font-medium ${saveMsg.includes('Failed') || saveMsg.includes('failed') ? 'text-red-600' : 'text-green-600'}`}>
              {saveMsg}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
