'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PlayCircle, Plug, Brain, AlertTriangle } from 'lucide-react';

interface Stats {
  integrations: number;
  runs: number;
  threads: number;
  errors: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const [intResp, runsResp, memResp] = await Promise.allSettled([
        api.get('/integrations'),
        api.get('/runs?take=1'),
        api.get('/memory'),
      ]);

      setStats({
        integrations:
          intResp.status === 'fulfilled' ? (intResp.value.data as unknown[]).length : 0,
        runs: runsResp.status === 'fulfilled' ? (runsResp.value.data as unknown[]).length : 0,
        threads: memResp.status === 'fulfilled' ? (memResp.value.data as unknown[]).length : 0,
        errors: 0,
      });
    };

    fetchStats();
  }, []);

  const cards = [
    { label: 'Integrations', value: stats?.integrations, icon: Plug, color: 'blue' },
    { label: 'Recent Runs', value: stats?.runs, icon: PlayCircle, color: 'green' },
    { label: 'Thread Memories', value: stats?.threads, icon: Brain, color: 'purple' },
    { label: 'Errors (24h)', value: stats?.errors, icon: AlertTriangle, color: 'red' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Overview of your Company Intel Bot</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {value ?? '—'}
                </p>
              </div>
              <div className={`p-3 rounded-full bg-${color}-50`}>
                <Icon className={`text-${color}-600`} size={24} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 card p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <a href="/integrations" className="btn-secondary justify-start">
            <Plug size={16} className="mr-2" /> Configure Integrations
          </a>
          <a href="/runs" className="btn-secondary justify-start">
            <PlayCircle size={16} className="mr-2" /> View Run History
          </a>
          <a href="/memory" className="btn-secondary justify-start">
            <Brain size={16} className="mr-2" /> Browse Thread Memory
          </a>
        </div>
      </div>
    </div>
  );
}
