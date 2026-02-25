'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface Run {
  id: string;
  trigger: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'DEGRADED';
  outputSummary: string | null;
  durationMs: number | null;
  createdAt: string;
  _count: { steps: number; errors: number };
}

const statusClasses: Record<string, string> = {
  COMPLETED: 'badge-green',
  FAILED: 'badge-red',
  DEGRADED: 'badge-yellow',
  RUNNING: 'badge-blue',
  PENDING: 'badge-gray',
};

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Run[]>('/runs?take=50').then(({ data }) => {
      setRuns(data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Enrichment Runs</h2>
        <p className="text-gray-500 mt-1">History of all bot invocations</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : runs.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500">No runs yet. Runs appear after the bot is triggered.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trigger</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Steps</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">When</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{run.trigger}</td>
                  <td className="px-4 py-3">
                    <span className={statusClasses[run.status] ?? 'badge-gray'}>{run.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{run._count.steps}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {run.durationMs != null ? `${run.durationMs}ms` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {run.outputSummary ?? '—'}
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
