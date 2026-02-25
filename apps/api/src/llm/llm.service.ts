// =============================================================================
// LLM Service — provider-agnostic: openai / anthropic / gemini
// =============================================================================

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type LlmProvider = 'openai' | 'anthropic' | 'gemini';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmOptions {
  provider?: LlmProvider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly config: ConfigService) {}

  async chat(messages: LlmMessage[], options: LlmOptions = {}): Promise<string> {
    const provider = options.provider ?? (this.config.get<string>('LLM_PROVIDER', 'openai') as LlmProvider);

    switch (provider) {
      case 'openai':
        return this.chatOpenAI(messages, options);
      case 'anthropic':
        return this.chatAnthropic(messages, options);
      case 'gemini':
        return this.chatGemini(messages, options);
      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }

  // ─── OpenAI ──────────────────────────────────────────────────────────────
  private async chatOpenAI(messages: LlmMessage[], options: LlmOptions): Promise<string> {
    const apiKey = this.config.getOrThrow<string>('OPENAI_API_KEY');
    const model = options.model ?? this.config.get<string>('OPENAI_MODEL', 'gpt-4o-mini');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? '';
  }

  // ─── Anthropic (Claude) ──────────────────────────────────────────────────
  private async chatAnthropic(messages: LlmMessage[], options: LlmOptions): Promise<string> {
    const apiKey = this.config.getOrThrow<string>('ANTHROPIC_API_KEY');
    const model = options.model ?? this.config.get<string>('ANTHROPIC_MODEL', 'claude-3-5-haiku-20241022');

    // Separate system message
    const systemMsg = messages.find((m) => m.role === 'system')?.content;
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxTokens ?? 1024,
      messages: chatMessages,
    };
    if (systemMsg) body.system = systemMsg;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    return data.content.find((c) => c.type === 'text')?.text ?? '';
  }

  // ─── Google Gemini ───────────────────────────────────────────────────────
  private async chatGemini(messages: LlmMessage[], options: LlmOptions): Promise<string> {
    const apiKey = this.config.getOrThrow<string>('GEMINI_API_KEY');
    const model = options.model ?? this.config.get<string>('GEMINI_MODEL', 'gemini-1.5-flash');

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find((m) => m.role === 'system')?.content;

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
      },
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    return data.candidates[0]?.content?.parts[0]?.text ?? '';
  }
}
