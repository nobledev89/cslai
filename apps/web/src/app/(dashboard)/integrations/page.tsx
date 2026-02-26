'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plug, Plus, Trash2, TestTube, CheckCircle, XCircle, X } from 'lucide-react';

interface Integration {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  testStatus: string | null;
  lastTestedAt: string | null;
}

type IntegrationType = 'SLACK' | 'WOOCOMMERCE' | 'GMAIL' | 'CUSTOM_REST' | 'TRACKPOD';

// ─── Per-type default configs ─────────────────────────────────────────────────

const defaultConfigs: Record<IntegrationType, Record<string, unknown>> = {
  SLACK: { botToken: '', signingSecret: '', allowedChannels: [], maxHistoryResults: 20 },
  WOOCOMMERCE: { baseUrl: '', consumerKey: '', consumerSecret: '', apiVersion: 'wc/v3', timeoutMs: 10000 },
  GMAIL: { clientId: '', clientSecret: '', redirectUri: '', maxResults: 10 },
  CUSTOM_REST: { baseUrl: '', method: 'GET', headers: {}, queryParam: 'q', resultsJsonPath: '$.results', labelJsonPath: '$.name', timeoutMs: 8000 },
  TRACKPOD: { apiKey: '', baseUrl: 'https://api.trackpod.io', enabled: false },
};

// ─── Field renderer ───────────────────────────────────────────────────────────

function ConfigFields({
  type,
  config,
  onChange,
}: {
  type: IntegrationType;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const field = (
    key: string,
    label: string,
    inputType = 'text',
    placeholder = '',
  ) => (
    <div key={key}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={inputType}
        value={(config[key] as string) ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(key, inputType === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  if (type === 'SLACK') return (
    <>
      {field('botToken', 'Bot Token', 'text', 'xoxb-...')}
      {field('signingSecret', 'Signing Secret', 'password')}
      {field('maxHistoryResults', 'Max History Results', 'number')}
    </>
  );

  if (type === 'WOOCOMMERCE') return (
    <>
      {field('baseUrl', 'Store URL', 'url', 'https://shop.example.com')}
      {field('consumerKey', 'Consumer Key', 'text', 'ck_...')}
      {field('consumerSecret', 'Consumer Secret', 'password', 'cs_...')}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">API Version</label>
        <select
          value={(config['apiVersion'] as string) ?? 'wc/v3'}
          onChange={(e) => onChange('apiVersion', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="wc/v3">wc/v3</option>
          <option value="wc/v2">wc/v2</option>
        </select>
      </div>
      {field('timeoutMs', 'Timeout (ms)', 'number')}
    </>
  );

  if (type === 'GMAIL') return (
    <>
      {field('clientId', 'Client ID')}
      {field('clientSecret', 'Client Secret', 'password')}
      {field('redirectUri', 'Redirect URI', 'url', 'https://...')}
      {field('maxResults', 'Max Results', 'number')}
    </>
  );

  if (type === 'CUSTOM_REST') return (
    <>
      {field('baseUrl', 'Base URL', 'url', 'https://api.example.com/search')}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
        <select
          value={(config['method'] as string) ?? 'GET'}
          onChange={(e) => onChange('method', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
      </div>
      {field('queryParam', 'Query Param', 'text', 'q')}
      {field('resultsJsonPath', 'Results JSONPath', 'text', '$.results')}
      {field('labelJsonPath', 'Label JSONPath', 'text', '$.name')}
      {field('timeoutMs', 'Timeout (ms)', 'number')}
    </>
  );

  if (type === 'TRACKPOD') return (
    <>
      {field('apiKey', 'API Key', 'password')}
      {field('baseUrl', 'Base URL', 'url', 'https://api.trackpod.io')}
    </>
  );

  return null;
}

// ─── Add Integration Modal ────────────────────────────────────────────────────

function AddIntegrationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<IntegrationType>('SLACK');
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, unknown>>(defaultConfigs['SLACK']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTypeChange = (newType: IntegrationType) => {
    setType(newType);
    setConfig(defaultConfigs[newType]);
    setError(null);
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/integrations', { type, name: name.trim(), config });
      onCreated();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to create integration';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Add Integration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Integration Type</label>
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as IntegrationType)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="SLACK">Slack</option>
                <option value="WOOCOMMERCE">WooCommerce</option>
                <option value="GMAIL">Gmail</option>
                <option value="CUSTOM_REST">Custom REST</option>
                <option value="TRACKPOD">Trackpod</option>
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={name}
                placeholder="e.g. My Slack Bot"
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Dynamic config fields */}
            <ConfigFields type={type} config={config} onChange={handleConfigChange} />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
            <button type="button" onClick={onClose} className="btn-secondary py-2 px-4 text-sm">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary py-2 px-4 text-sm">
              {submitting ? 'Creating…' : 'Create Integration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchIntegrations = async () => {
    try {
      const { data } = await api.get<Integration[]>('/integrations');
      setIntegrations(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIntegrations(); }, []);

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      await api.post(`/integrations/${id}/test`);
      await fetchIntegrations();
    } finally {
      setTesting(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this integration?')) return;
    await api.delete(`/integrations/${id}`);
    await fetchIntegrations();
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    await api.patch(`/integrations/${id}`, { enabled: !enabled });
    await fetchIntegrations();
  };

  return (
    <div>
      {showAddModal && (
        <AddIntegrationModal
          onClose={() => setShowAddModal(false)}
          onCreated={fetchIntegrations}
        />
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Integrations</h2>
          <p className="text-gray-500 mt-1">Configure data sources for enrichment</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Integration
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : integrations.length === 0 ? (
        <div className="card p-12 text-center">
          <Plug size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No integrations yet</h3>
          <p className="text-gray-500 mt-1">Add your first integration to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((int) => (
            <div key={int.id} className="card p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                  int.type === 'SLACK' ? 'bg-purple-500' :
                  int.type === 'WOOCOMMERCE' ? 'bg-violet-500' :
                  int.type === 'GMAIL' ? 'bg-red-500' :
                  int.type === 'CUSTOM_REST' ? 'bg-blue-500' : 'bg-gray-500'
                }`}>
                  {int.type.slice(0, 2)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{int.name}</p>
                  <p className="text-sm text-gray-500">{int.type}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {int.testStatus && (
                  <span 
                    className={`flex items-center gap-1 text-sm ${
                      int.testStatus === 'ok' ? 'text-green-600' : 'text-red-600'
                    }`}
                    title={int.testStatus !== 'ok' ? int.testStatus : undefined}
                  >
                    {int.testStatus === 'ok' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    {int.testStatus === 'ok' ? 'Connected' : 'Error'}
                    {int.testStatus !== 'ok' && int.testStatus !== 'error' && (
                      <span className="text-xs text-red-500 ml-1">
                        ({int.testStatus.replace('error: ', '')})
                      </span>
                    )}
                  </span>
                )}

                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => handleToggle(int.id, int.enabled)}
                    className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                      int.enabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      int.enabled ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </div>
                  <span className="text-sm text-gray-600">{int.enabled ? 'Enabled' : 'Disabled'}</span>
                </label>

                <button
                  onClick={() => handleTest(int.id)}
                  disabled={testing === int.id}
                  className="btn-secondary py-1 px-3 text-xs flex items-center gap-1"
                >
                  <TestTube size={12} />
                  {testing === int.id ? 'Testing…' : 'Test'}
                </button>

                <button
                  onClick={() => handleDelete(int.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
