'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  const [llmProvider, setLlmProvider] = useState('openai');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // In a real implementation, this would PATCH a /settings endpoint
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500 mt-1">Configure LLM provider and system settings</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* LLM Provider */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <Settings size={20} className="text-gray-500" />
            <h3 className="font-semibold text-gray-900">LLM Configuration</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                LLM Provider
              </label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="input"
              >
                <option value="openai">OpenAI (GPT-4o-mini)</option>
                <option value="anthropic">Anthropic (Claude 3.5)</option>
                <option value="gemini">Google Gemini 1.5</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Configure API keys in your .env file
              </p>
            </div>
          </div>
        </div>

        {/* Rate Limits */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-5">Rate Limiting</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Requests per minute
              </label>
              <input type="number" className="input" defaultValue={100} min={1} max={1000} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Window (seconds)
              </label>
              <input type="number" className="input" defaultValue={60} min={10} max={3600} />
            </div>
          </div>
        </div>

        {/* Slack */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-5">Slack Events Endpoint</h3>
          <div className="bg-gray-50 rounded-md p-4 font-mono text-sm text-gray-700">
            {process.env.NEXT_PUBLIC_API_URL ?? 'https://api.ai.corporatespec.com'}
            /integrations/slack/events
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Use this URL when configuring your Slack app's Event Subscriptions
          </p>
        </div>

        <button onClick={handleSave} className="btn-primary">
          {saved ? '✓ Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
