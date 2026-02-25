import { IIntegration } from '../integration.interface';
import { NormalizedResult, SlackConfig, okResult, errResult } from '@company-intel/shared';

export class SlackIntegration implements IIntegration {
  constructor(private readonly config: SlackConfig) {}

  async testConnection(): Promise<void> {
    const res = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${this.config.botToken}` },
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) throw new Error(`Slack auth.test failed: ${data.error}`);
  }

  async runEnrichment(query: string): Promise<NormalizedResult> {
    const startTime = Date.now();
    try {
      const res = await fetch(
        `https://slack.com/api/search.messages?query=${encodeURIComponent(query)}&count=${this.config.maxHistoryResults}`,
        { headers: { Authorization: `Bearer ${this.config.botToken}` } },
      );
      const data = (await res.json()) as {
        ok: boolean;
        messages?: { matches?: Array<{ text: string; permalink: string; channel: { name: string }; ts: string }> };
        error?: string;
      };

      const durationMs = Date.now() - startTime;

      if (!data.ok) return errResult('SLACK', `Slack search failed: ${data.error}`, { durationMs });

      const items = (data.messages?.matches ?? []).map((m) => ({
        label: `#${m.channel.name} @ ${new Date(parseFloat(m.ts) * 1000).toISOString()}`,
        summary: m.text,
        data: { channel: m.channel.name, ts: m.ts },
        url: m.permalink,
      }));

      return okResult('SLACK', items, { durationMs });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      return errResult('SLACK', err?.message ?? 'Unknown Slack error', { durationMs });
    }
  }
}
