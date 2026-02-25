'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { Brain, MessageSquare } from 'lucide-react';

interface ThreadMemory {
  id: string;
  threadKey: string;
  summaryText: string | null;
  totalTurns: number;
  totalChars: number;
  updatedAt: string;
}

export default function MemoryPage() {
  const [threads, setThreads] = useState<ThreadMemory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ThreadMemory[]>('/memory?take=100').then(({ data }) => {
      setThreads(data);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Thread Memory</h2>
        <p className="text-gray-500 mt-1">Conversation histories stored per Slack thread</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : threads.length === 0 ? (
        <div className="card p-12 text-center">
          <Brain size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No thread memories yet</h3>
          <p className="text-gray-500 mt-1">Memories are created when the bot responds in threads</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Thread Key</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Summary</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Turns</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Size</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {threads.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-xs truncate">
                    {t.threadKey}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-sm truncate">
                    {t.summaryText ?? (
                      <span className="text-gray-400 italic">No summary yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-gray-600">
                      <MessageSquare size={12} /> {t.totalTurns}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(t.totalChars / 1000).toFixed(1)}k chars
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
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
