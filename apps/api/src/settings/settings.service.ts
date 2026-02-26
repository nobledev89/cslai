// =============================================================================
// Settings Service — per-tenant LLM provider configuration with fallback chain
// =============================================================================

import { Injectable } from '@nestjs/common';
import { prisma, encryptObject, decryptObject } from '@company-intel/db';
import { ConfigService } from '@nestjs/config';

export type LlmProvider = 'openai' | 'anthropic' | 'gemini';

export interface LlmProviderConfig {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  enabled: boolean;
  priority: number; // 1 = highest priority
}

export interface LlmSettings {
  providers: LlmProviderConfig[];
}

const DEFAULT_SETTINGS: LlmSettings = {
  providers: [
    { provider: 'openai', model: 'gpt-5-mini', apiKey: '', enabled: false, priority: 1 },
    { provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: '', enabled: false, priority: 2 },
    { provider: 'gemini', model: 'gemini-2.5-flash', apiKey: '', enabled: false, priority: 3 },
  ],
};

@Injectable()
export class SettingsService {
  constructor(private readonly config: ConfigService) {}

  // ─── Read ───────────────────────────────────────────────────────────────────

  async getLlmSettings(tenantId: string): Promise<LlmSettings> {
    const record = await prisma.tenantSetting.findUnique({ where: { tenantId } });
    if (!record?.llmConfigEnc) return DEFAULT_SETTINGS;
    return decryptObject<LlmSettings>(record.llmConfigEnc);
  }

  /** Returns settings with API keys masked for safe display */
  async getLlmSettingsMasked(tenantId: string): Promise<{
    providers: Array<Omit<LlmProviderConfig, 'apiKey'> & { hasApiKey: boolean }>;
  }> {
    const settings = await this.getLlmSettings(tenantId);
    return {
      providers: settings.providers.map(({ apiKey, ...rest }) => ({
        ...rest,
        hasApiKey: apiKey.length > 0,
      })),
    };
  }

  // ─── Write ──────────────────────────────────────────────────────────────────

  async saveLlmSettings(
    tenantId: string,
    incoming: { providers: Array<Omit<LlmProviderConfig, 'apiKey'> & { apiKey?: string }> },
  ): Promise<void> {
    // Merge: if apiKey is empty/omitted, keep the existing key
    const existing = await this.getLlmSettings(tenantId);
    const existingMap = new Map(existing.providers.map((p) => [p.provider, p]));

    const merged: LlmProviderConfig[] = incoming.providers.map((p) => ({
      provider: p.provider,
      model: p.model,
      enabled: p.enabled,
      priority: p.priority,
      apiKey: p.apiKey && p.apiKey.trim().length > 0 ? p.apiKey.trim() : (existingMap.get(p.provider)?.apiKey ?? ''),
    }));

    const enc = encryptObject<LlmSettings>({ providers: merged });

    await prisma.tenantSetting.upsert({
      where: { tenantId },
      create: { tenantId, llmConfigEnc: enc },
      update: { llmConfigEnc: enc },
    });
  }

  // ─── Test ───────────────────────────────────────────────────────────────────

  async testProvider(
    tenantId: string,
    provider: LlmProvider,
    apiKey?: string,
  ): Promise<{ ok: boolean; message: string }> {
    // Use provided key first, fall back to stored key
    let key = apiKey?.trim() ?? '';
    if (!key) {
      const settings = await this.getLlmSettings(tenantId);
      key = settings.providers.find((p) => p.provider === provider)?.apiKey ?? '';
    }
    if (!key) {
      return { ok: false, message: 'No API key provided' };
    }

    try {
      switch (provider) {
        case 'openai':
          return await this.testOpenAI(key);
        case 'anthropic':
          return await this.testAnthropic(key);
        case 'gemini':
          return await this.testGemini(key);
        default:
          return { ok: false, message: `Unknown provider: ${provider}` };
      }
    } catch (err: any) {
      return { ok: false, message: err?.message ?? 'Unknown error' };
    }
  }

  private async testOpenAI(apiKey: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) return { ok: true, message: 'OpenAI API key is valid' };
    const body = await res.json().catch(() => ({}));
    return { ok: false, message: (body as any)?.error?.message ?? `HTTP ${res.status}` };
  }

  private async testAnthropic(apiKey: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });
    if (res.ok || res.status === 400) return { ok: true, message: 'Anthropic API key is valid' };
    const body = await res.json().catch(() => ({}));
    return { ok: false, message: (body as any)?.error?.message ?? `HTTP ${res.status}` };
  }

  private async testGemini(apiKey: string): Promise<{ ok: boolean; message: string }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    if (res.ok) return { ok: true, message: 'Gemini API key is valid' };
    const body = await res.json().catch(() => ({}));
    return { ok: false, message: (body as any)?.error?.message ?? `HTTP ${res.status}` };
  }

  // ─── Fallback-chain helper (used by LlmService) ──────────────────────────────

  /** Returns providers sorted by priority, only enabled + having an apiKey */
  async getOrderedProviders(tenantId: string): Promise<LlmProviderConfig[]> {
    const settings = await this.getLlmSettings(tenantId);
    return settings.providers
      .filter((p) => p.enabled && p.apiKey)
      .sort((a, b) => a.priority - b.priority);
  }
}
