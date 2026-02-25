import { IIntegration } from '../integration.interface';
import { NormalizedResult, WooCommerceConfig, okResult, errResult } from '@company-intel/shared';

export class WooCommerceIntegration implements IIntegration {
  constructor(private readonly config: WooCommerceConfig) {}

  private get baseHeaders() {
    const credentials = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`,
    ).toString('base64');
    return { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' };
  }

  async testConnection(): Promise<void> {
    const url = `${this.config.baseUrl}/wp-json/${this.config.apiVersion}/system_status`;
    const res = await fetch(url, {
      headers: this.baseHeaders,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    if (!res.ok) throw new Error(`WooCommerce test failed: ${res.status} ${res.statusText}`);
  }

  async runEnrichment(query: string): Promise<NormalizedResult> {
    try {
      const url = `${this.config.baseUrl}/wp-json/${this.config.apiVersion}/orders?search=${encodeURIComponent(query)}&per_page=10`;
      const res = await fetch(url, {
        headers: this.baseHeaders,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!res.ok) return errResult(`WooCommerce request failed: ${res.status}`);

      const orders = (await res.json()) as Array<{
        id: number;
        status: string;
        total: string;
        billing: { first_name: string; last_name: string; email: string };
        date_created: string;
      }>;

      const items = orders.map((o) => ({
        label: `Order #${o.id} — ${o.billing.first_name} ${o.billing.last_name}`,
        value: `Status: ${o.status}, Total: ${o.total}, Email: ${o.billing.email}, Created: ${o.date_created}`,
        source: 'woocommerce' as const,
        metadata: { orderId: o.id, status: o.status, total: o.total },
      }));

      return okResult(items);
    } catch (err: any) {
      return errResult(err?.message ?? 'Unknown WooCommerce error');
    }
  }
}
