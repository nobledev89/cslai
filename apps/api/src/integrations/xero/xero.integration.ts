import { IIntegration } from '../integration.interface';
import { NormalizedResult, XeroConfig, okResult, errResult } from '@company-intel/shared';

export class XeroIntegration implements IIntegration {
  constructor(private readonly config: XeroConfig) {}

  private get authHeaders() {
    if (!this.config.accessToken) {
      throw new Error('Xero access token is missing. Please complete OAuth flow.');
    }
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
      'Xero-tenant-id': this.config.tenantId,
    };
  }

  async testConnection(): Promise<void> {
    // Test connection by fetching organisation details
    const url = 'https://api.xero.com/api.xro/2.0/Organisation';
    const res = await fetch(url, {
      headers: this.authHeaders,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    
    if (res.status === 401) {
      throw new Error('Xero authentication failed. Please re-authenticate.');
    }
    
    if (!res.ok) {
      throw new Error(`Xero test failed: ${res.status} ${res.statusText}`);
    }
  }

  async runEnrichment(query: string): Promise<NormalizedResult> {
    const startTime = Date.now();
    try {
      // Search contacts, invoices, and purchase orders based on the query
      const results = await Promise.allSettled([
        this.searchContacts(query),
        this.searchInvoices(query),
      ]);

      const durationMs = Date.now() - startTime;

      const items: Array<{
        label: string;
        summary: string;
        data: Record<string, unknown>;
        timestamp?: string;
      }> = [];

      // Process contact results
      if (results[0].status === 'fulfilled') {
        items.push(...results[0].value);
      }

      // Process invoice results
      if (results[1].status === 'fulfilled') {
        items.push(...results[1].value);
      }

      // Limit results to maxResults
      const limitedItems = items.slice(0, this.config.maxResults);

      return okResult('XERO', limitedItems, { durationMs });
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      return errResult('XERO', err?.message ?? 'Unknown Xero error', { durationMs });
    }
  }

  private async searchContacts(query: string) {
    const url = `https://api.xero.com/api.xro/2.0/Contacts?where=Name.Contains("${encodeURIComponent(query)}")`;
    const res = await fetch(url, {
      headers: this.authHeaders,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      Contacts: Array<{
        ContactID: string;
        Name: string;
        EmailAddress?: string;
        ContactStatus?: string;
        UpdatedDateUTC?: string;
      }>;
    };

    return (data.Contacts || []).map((contact) => ({
      label: `Contact: ${contact.Name}`,
      summary: `Email: ${contact.EmailAddress || 'N/A'}, Status: ${contact.ContactStatus || 'N/A'}`,
      data: {
        contactId: contact.ContactID,
        name: contact.Name,
        email: contact.EmailAddress,
        status: contact.ContactStatus,
      },
      timestamp: contact.UpdatedDateUTC,
    }));
  }

  private async searchInvoices(query: string) {
    const url = `https://api.xero.com/api.xro/2.0/Invoices?where=Contact.Name.Contains("${encodeURIComponent(query)}")`;
    const res = await fetch(url, {
      headers: this.authHeaders,
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      Invoices: Array<{
        InvoiceID: string;
        InvoiceNumber: string;
        Type: string;
        Status: string;
        Total: number;
        CurrencyCode: string;
        Contact: { Name: string };
        DateString?: string;
        UpdatedDateUTC?: string;
      }>;
    };

    return (data.Invoices || []).map((invoice) => ({
      label: `${invoice.Type} #${invoice.InvoiceNumber} — ${invoice.Contact.Name}`,
      summary: `Status: ${invoice.Status}, Total: ${invoice.CurrencyCode} ${invoice.Total}`,
      data: {
        invoiceId: invoice.InvoiceID,
        invoiceNumber: invoice.InvoiceNumber,
        type: invoice.Type,
        status: invoice.Status,
        total: invoice.Total,
        currency: invoice.CurrencyCode,
        contactName: invoice.Contact.Name,
      },
      timestamp: invoice.UpdatedDateUTC || invoice.DateString,
    }));
  }
}
