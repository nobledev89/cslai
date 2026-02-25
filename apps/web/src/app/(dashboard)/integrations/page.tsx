'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plug, Plus, Trash2, TestTube, CheckCircle, XCircle } from 'lucide-react';

interface Integration {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  testStatus: string | null;
  lastTestedAt: string | null;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Integrations</h2>
          <p className="text-gray-500 mt-1">Configure data sources for enrichment</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
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
                  <span className={`flex items-center gap-1 text-sm ${
                    int.testStatus === 'ok' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {int.testStatus === 'ok' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                    {int.testStatus === 'ok' ? 'Connected' : 'Error'}
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
