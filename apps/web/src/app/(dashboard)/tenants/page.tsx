'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Users, Plus, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count: { memberships: number; integrationConfigs: number };
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', slug: '' });

  const fetchTenants = async () => {
    try {
      const { data } = await api.get<Tenant[]>('/tenants');
      setTenants(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const handleCreate = async () => {
    if (!newTenant.name || !newTenant.slug) return;
    await api.post('/tenants', newTenant);
    setNewTenant({ name: '', slug: '' });
    setShowForm(false);
    await fetchTenants();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete tenant "${name}"? This will delete ALL associated data.`)) return;
    await api.delete(`/tenants/${id}`);
    await fetchTenants();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tenants</h2>
          <p className="text-gray-500 mt-1">Manage organizations (OWNER only)</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Tenant
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Create Tenant</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                className="input"
                placeholder="Acme Corp"
                value={newTenant.name}
                onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                type="text"
                className="input"
                placeholder="acme-corp"
                value={newTenant.slug}
                onChange={(e) =>
                  setNewTenant({ ...newTenant, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })
                }
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleCreate} className="btn-primary">Create</button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Members</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Integrations</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.slug}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {t._count.memberships}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t._count.integrationConfigs}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
