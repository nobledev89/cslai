import { IIntegration } from '../integration.interface';
import { NormalizedResult, GmailConfig, okResult, errResult } from '@company-intel/shared';

export class GmailIntegration implements IIntegration {
  constructor(private readonly config: GmailConfig) {}

  private async getAccessToken(): Promise<string> {
    if (
      this.config.accessToken &&
      this.config.tokenExpiry &&
      this.config.tokenExpiry > Date.now() + 60_000
    ) {
      return this.config.accessToken;
    }

    if (!this.config.refreshToken) throw new Error('No Gmail refresh token — re-authorize');

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.config.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = (await res.json()) as { access_token?: string; error?: string };
    if (!data.access_token) throw new Error(`Gmail token refresh failed: ${data.error}`);
    return data.access_token;
  }

  async testConnection(): Promise<void> {
    const token = await this.getAccessToken();
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Gmail test failed: ${res.status}`);
  }

  async runEnrichment(query: string): Promise<NormalizedResult> {
    try {
      const token = await this.getAccessToken();

      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${this.config.maxResults}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const listData = (await listRes.json()) as { messages?: Array<{ id: string }> };
      if (!listData.messages?.length) return okResult([]);

      const items = await Promise.all(
        listData.messages.slice(0, this.config.maxResults).map(async (msg) => {
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const msgData = (await msgRes.json()) as {
            id: string;
            snippet: string;
            payload: { headers: Array<{ name: string; value: string }> };
          };

          const headers = msgData.payload.headers ?? [];
          const subject = headers.find((h) => h.name === 'Subject')?.value ?? '(no subject)';
          const from = headers.find((h) => h.name === 'From')?.value ?? '';
          const date = headers.find((h) => h.name === 'Date')?.value ?? '';

          return {
            label: subject,
            value: `From: ${from}\nDate: ${date}\nSnippet: ${msgData.snippet}`,
            source: 'gmail' as const,
            metadata: { messageId: msg.id, from, date },
          };
        }),
      );

      return okResult(items);
    } catch (err: any) {
      return errResult(err?.message ?? 'Unknown Gmail error');
    }
  }
}
