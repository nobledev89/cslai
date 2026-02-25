import { IIntegration } from '../integration.interface';
import { NormalizedResult, CustomRestConfig, okResult, errResult } from '@company-intel/shared';

function getByPath(obj: unknown, path: string): unknown {
  // Simple dot-notation JSONPath (e.g. "$.results" → obj.results)
  const normalized = path.replace(/^\$\.?/, '');
  if (!normalized) return obj;
  return normalized.split('.').reduce((acc: any, key) => acc?.[key], obj);
}

export class CustomRestIntegration implements IIntegration {
  constructor(private readonly config: CustomRestConfig) {}

  async testConnection(): Promise<void> {
    const res = await fetch(this.config.baseUrl, {
      method: this.config.method,
      headers: this.config.headers,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    if (!res.ok) throw new Error(`Custom REST test failed: ${res.status} ${res.statusText}`);
  }

  async runEnrichment(query: string): Promise<NormalizedResult> {
    try {
      let url = this.config.baseUrl;
      let body: string | undefined;

      if (this.config.method === 'GET') {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}${this.config.queryParam}=${encodeURIComponent(query)}`;
      } else {
        body = JSON.stringify({ [this.config.queryParam]: query });
      }

      const res = await fetch(url, {
        method: this.config.method,
        headers: {
          ...this.config.headers,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!res.ok) return errResult(`Custom REST request failed: ${res.status}`);

      const responseData = await res.json();
      const results = getByPath(responseData, this.config.resultsJsonPath);
      if (!Array.isArray(results)) return errResult('resultsJsonPath did not return an array');

      const items = results.map((item: unknown) => ({
        label: String(getByPath(item, this.config.labelJsonPath) ?? JSON.stringify(item)),
        value: JSON.stringify(item),
        source: 'custom_rest' as const,
        metadata: { raw: item },
      }));

      return okResult(items);
    } catch (err: any) {
      return errResult(err?.message ?? 'Unknown Custom REST error');
    }
  }
}
