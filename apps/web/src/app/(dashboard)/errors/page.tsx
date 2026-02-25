'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle } from 'lucide-react';

interface ErrorLog {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  createdAt: string;
}

export default function ErrorsPage() {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    // Errors are stored in the DB but exposed via the runs endpoint's related errors
    // For now we fetch through a direct API call if available
    api
      .get<ErrorLog[]>('/errors')
      .then(({ data }) => setErrors(data))
      .catch(() => setErrors([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Error Logs</h2>
        <p className="text-gray-500 mt-1">Integration and system errors</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : errors.length === 0 ? (
        <div className="card p-12 text-center">
          <AlertTriangle size={48} className="mx-auto text-green-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No errors</h3>
          <p className="text-gray-500 mt-1">Everything looks good!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {errors.map((err) => (
            <div key={err.id} className="card overflow-hidden">
              <div
                className="p-4 flex items-start justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(expanded === err.id ? null : err.id)}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{err.message}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Source: <span className="font-mono">{err.source}</span> ·{' '}
                      {formatDistanceToNow(new Date(err.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <span className="text-gray-400 text-xs">{expanded === err.id ? '▲' : '▼'}</span>
              </div>
              {expanded === err.id && err.stack && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <pre className="text-xs text-gray-600 font-mono overflow-x-auto whitespace-pre-wrap">
                    {err.stack}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
