// =============================================================================
// Enrichment Processor — BullMQ job handler
//
// Flow:
//   1. Create Run record (RUNNING)
//   2. Look up SlackWorkspace → decrypt bot token
//   3. Load enabled integrations → decrypt configs
//   4. Load thread memory
//   5. Run all integrations in parallel (RunStep per integration)
//   6. Build LLM prompt (memory + results)
//   7. Call LLM
//   8. Post Slack reply
//   9. Append to thread memory
//  10. Update Run → COMPLETED / DEGRADED / FAILED
// =============================================================================

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import {
  prisma,
  decryptObject,
  RunStatus,
  RunStepStatus,
} from '@company-intel/db';
import type { IntegrationType } from '@company-intel/db';
import type {
  EnrichmentJobPayload,
  EnrichmentJobResult,
  NormalizedResult,
  NormalizedResultItem,
} from '@company-intel/shared';
import { errResult, okResult } from '@company-intel/shared';

// =============================================================================
// LLM Helper — mirrors apps/api/src/llm/llm.service.ts but standalone
// =============================================================================

type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string };

async function callLlm(messages: LlmMessage[]): Promise<string> {
  const provider = process.env['LLM_PROVIDER'] ?? 'openai';

  // ── OpenAI ──────────────────────────────────────────────────────────────────
  if (provider === 'openai') {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
    const model = process.env['OPENAI_MODEL'] ?? 'gpt-4o-mini';

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.7 }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${txt}`);
    }
    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content ?? '';
  }

  // ── Anthropic ────────────────────────────────────────────────────────────────
  if (provider === 'anthropic') {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    const model = process.env['ANTHROPIC_MODEL'] ?? 'claude-3-5-haiku-20241022';

    const systemMsg = messages.find((m) => m.role === 'system')?.content;
    const chatMessages = messages.filter((m) => m.role !== 'system');
    const body: Record<string, unknown> = { model, max_tokens: 1024, messages: chatMessages };
    if (systemMsg) body['system'] = systemMsg;

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
      const txt = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${txt}`);
    }
    const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
    return data.content.find((c) => c.type === 'text')?.text ?? '';
  }

  // ── Gemini ───────────────────────────────────────────────────────────────────
  if (provider === 'gemini') {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
    const model = process.env['GEMINI_MODEL'] ?? 'gemini-1.5-flash';

    const systemInstruction = messages.find((m) => m.role === 'system')?.content;
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    };
    if (systemInstruction) body['systemInstruction'] = { parts: [{ text: systemInstruction }] };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${txt}`);
    }
    const data = (await res.json()) as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    return data.candidates[0]?.content?.parts[0]?.text ?? '';
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
}

// =============================================================================
// Integration Runners — standalone fetch-based equivalents of the API handlers
// =============================================================================

async function runSlack(
  config: { botToken: string; maxHistoryResults?: number },
  query: string,
  t0: number,
): Promise<NormalizedResult> {
  const count = config.maxHistoryResults ?? 20;
  const res = await fetch(
    `https://slack.com/api/search.messages?query=${encodeURIComponent(query)}&count=${count}`,
    { headers: { Authorization: `Bearer ${config.botToken}` } },
  );
  const data = (await res.json()) as {
    ok: boolean;
    messages?: {
      matches?: Array<{
        text: string;
        permalink: string;
        channel: { name: string };
        ts: string;
      }>;
    };
    error?: string;
  };

  if (!data.ok) {
    return errResult('SLACK', `Slack search failed: ${data.error ?? 'unknown'}`, {
      durationMs: Date.now() - t0,
    });
  }

  const items: NormalizedResultItem[] = (data.messages?.matches ?? []).map((m) => ({
    label: `#${m.channel.name} @ ${new Date(parseFloat(m.ts) * 1000).toISOString()}`,
    summary: m.text,
    data: { channel: m.channel.name, ts: m.ts },
    url: m.permalink,
    timestamp: new Date(parseFloat(m.ts) * 1000).toISOString(),
  }));

  return okResult('SLACK', items, { durationMs: Date.now() - t0 });
}

async function runWooCommerce(
  config: {
    baseUrl: string;
    consumerKey: string;
    consumerSecret: string;
    apiVersion?: string;
  },
  query: string,
  t0: number,
): Promise<NormalizedResult> {
  const version = config.apiVersion ?? 'wc/v3';
  const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');

  const res = await fetch(
    `${config.baseUrl}/wp-json/${version}/orders?search=${encodeURIComponent(query)}&per_page=20`,
    {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    },
  );

  if (!res.ok) {
    return errResult('WOOCOMMERCE', `WooCommerce API error ${res.status}`, {
      durationMs: Date.now() - t0,
    });
  }

  const orders = (await res.json()) as Array<{
    id: number;
    status: string;
    total: string;
    date_created: string;
    billing: { first_name: string; last_name: string; email: string };
  }>;

  const items: NormalizedResultItem[] = orders.map((o) => ({
    label: `Order #${o.id} — ${o.billing.first_name} ${o.billing.last_name}`,
    summary: `Status: ${o.status}, Total: ${o.total}`,
    data: { id: o.id, status: o.status, total: o.total, email: o.billing.email },
    timestamp: o.date_created,
  }));

  return okResult('WOOCOMMERCE', items, { totalCount: items.length, durationMs: Date.now() - t0 });
}

async function runGmail(
  config: {
    accessToken?: string;
    maxResults?: number;
  },
  query: string,
  t0: number,
): Promise<NormalizedResult> {
  if (!config.accessToken) {
    return errResult('GMAIL', 'Gmail access token not configured — complete OAuth flow first', {
      durationMs: Date.now() - t0,
    });
  }

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${config.maxResults ?? 10}`,
    { headers: { Authorization: `Bearer ${config.accessToken}` } },
  );

  if (!res.ok) {
    return errResult('GMAIL', `Gmail API error ${res.status}`, { durationMs: Date.now() - t0 });
  }

  const data = (await res.json()) as { messages?: Array<{ id: string; threadId: string }> };
  const messages = data.messages ?? [];

  // Fetch metadata for first 5 messages
  const detailResults = await Promise.allSettled(
    messages.slice(0, 5).map(async (m) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        { headers: { Authorization: `Bearer ${config.accessToken}` } },
      );
      if (!msgRes.ok) return null;
      return (await msgRes.json()) as {
        id: string;
        snippet: string;
        payload: { headers: Array<{ name: string; value: string }> };
      };
    }),
  );

  const items: NormalizedResultItem[] = detailResults
    .filter(
      (r): r is PromiseFulfilledResult<NonNullable<(typeof detailResults)[0] extends PromiseFulfilledResult<infer T> ? T : never>> =>
        r.status === 'fulfilled' && r.value !== null,
    )
    .map((r) => {
      const msg = r.value as {
        id: string;
        snippet: string;
        payload: { headers: Array<{ name: string; value: string }> };
      };
      const subject = msg.payload?.headers?.find((h) => h.name === 'Subject')?.value ?? '(no subject)';
      const from = msg.payload?.headers?.find((h) => h.name === 'From')?.value ?? '';
      return {
        label: subject,
        summary: msg.snippet,
        data: { from, id: msg.id },
        url: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
      };
    });

  return okResult('GMAIL', items, { totalCount: messages.length, durationMs: Date.now() - t0 });
}

async function runCustomRest(
  config: {
    baseUrl: string;
    method?: string;
    headers?: Record<string, string>;
    queryParam?: string;
  },
  query: string,
  t0: number,
): Promise<NormalizedResult> {
  const method = (config.method ?? 'GET').toUpperCase();
  const queryParam = config.queryParam ?? 'q';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers ?? {}),
  };

  const url = method === 'GET'
    ? `${config.baseUrl}?${queryParam}=${encodeURIComponent(query)}`
    : config.baseUrl;

  const body = method !== 'GET' ? JSON.stringify({ [queryParam]: query }) : undefined;

  const res = await fetch(url, { method, headers, body });

  if (!res.ok) {
    return errResult('CUSTOM_REST', `Custom REST API error ${res.status}`, {
      durationMs: Date.now() - t0,
    });
  }

  const responseData = (await res.json()) as unknown;
  const results = Array.isArray(responseData)
    ? responseData
    : (responseData as Record<string, unknown>)?.['results'] ??
      (responseData as Record<string, unknown>)?.['data'] ?? [];

  const items: NormalizedResultItem[] = (Array.isArray(results) ? results : []).map(
    (r: unknown, i: number) => {
      const item = r as Record<string, unknown>;
      return {
        label: String(item?.['name'] ?? item?.['title'] ?? item?.['label'] ?? `Result ${i + 1}`),
        summary: String(
          item?.['description'] ?? item?.['summary'] ?? JSON.stringify(r),
        ).substring(0, 500),
        data: item as Record<string, unknown>,
      };
    },
  );

  return okResult('CUSTOM_REST', items, { totalCount: items.length, durationMs: Date.now() - t0 });
}

async function runTrackpod(
  config: {
    apiKey: string;
    baseUrl?: string;
    maxResults?: number;
    timeoutMs?: number;
  },
  query: string,
  t0: number,
): Promise<NormalizedResult> {
  const baseUrl = config.baseUrl ?? 'https://api.track-pod.com';
  const maxResults = config.maxResults ?? 20;
  const timeoutMs = config.timeoutMs ?? 10000;

  const headers = {
    'X-API-KEY': config.apiKey,
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate, br',
    'Content-Type': 'application/json',
  };

  // Try to search for both orders and routes in parallel
  const results = await Promise.allSettled([
    // Search orders by number
    fetch(`${baseUrl}/Order/Number/${encodeURIComponent(query)}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    }),
    // Search routes by code
    fetch(`${baseUrl}/Route/Code/${encodeURIComponent(query)}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    }),
  ]);

  const items: NormalizedResultItem[] = [];

  // Process order result
  if (results[0].status === 'fulfilled' && results[0].value.ok) {
    try {
      const order = (await results[0].value.json()) as {
        id?: string;
        number?: string;
        orderNumber?: string;
        status?: string;
        routeCode?: string;
        route?: { code?: string };
        address?: string;
        customerName?: string;
        customer?: { name?: string };
        modifiedDate?: string;
        createdDate?: string;
      };

      if (order && order.id) {
        items.push({
          label: `Order #${order.number || order.orderNumber || query}`,
          summary: `Status: ${order.status || 'N/A'}, Route: ${order.routeCode || order.route?.code || 'N/A'}`,
          data: {
            orderId: order.id,
            orderNumber: order.number || order.orderNumber,
            status: order.status,
            routeCode: order.routeCode || order.route?.code,
            address: order.address,
            customerName: order.customerName || order.customer?.name,
          },
          timestamp: order.modifiedDate || order.createdDate,
        });
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Process route result
  if (results[1].status === 'fulfilled' && results[1].value.ok) {
    try {
      const route = (await results[1].value.json()) as {
        id?: string;
        code?: string;
        status?: string;
        driver?: { name?: string };
        vehicle?: { number?: string };
        orderCount?: number;
        orders?: Array<unknown>;
        date?: string;
        modifiedDate?: string;
        createdDate?: string;
      };

      if (route && route.id) {
        items.push({
          label: `Route: ${route.code || query}`,
          summary: `Status: ${route.status || 'N/A'}, Driver: ${route.driver?.name || 'N/A'}, Orders: ${route.orderCount || route.orders?.length || 0}`,
          data: {
            routeId: route.id,
            routeCode: route.code,
            status: route.status,
            driverName: route.driver?.name,
            vehicleNumber: route.vehicle?.number,
            orderCount: route.orderCount || route.orders?.length,
            date: route.date,
          },
          timestamp: route.modifiedDate || route.createdDate || route.date,
        });
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Check for authentication errors
  for (const result of results) {
    if (result.status === 'fulfilled' && (result.value.status === 401 || result.value.status === 403)) {
      return errResult('TRACKPOD', 'TrackPod authentication failed. Please check your API key.', {
        durationMs: Date.now() - t0,
      });
    }
  }

  // If no results found, return empty success
  if (items.length === 0) {
    return okResult('TRACKPOD', [], {
      totalCount: 0,
      durationMs: Date.now() - t0,
      statusMessage: 'No orders or routes found matching the query',
    });
  }

  // Limit results
  const limitedItems = items.slice(0, maxResults);

  return okResult('TRACKPOD', limitedItems, {
    totalCount: limitedItems.length,
    durationMs: Date.now() - t0,
  });
}

// ─── Dispatch to correct integration runner ───────────────────────────────────

async function runIntegration(
  type: IntegrationType,
  config: Record<string, unknown>,
  query: string,
): Promise<NormalizedResult> {
  const t0 = Date.now();
  try {
    switch (type) {
      case 'SLACK':
        return await runSlack(config as { botToken: string; maxHistoryResults?: number }, query, t0);
      case 'WOOCOMMERCE':
        return await runWooCommerce(
          config as { baseUrl: string; consumerKey: string; consumerSecret: string; apiVersion?: string },
          query,
          t0,
        );
      case 'GMAIL':
        return await runGmail(config as { accessToken?: string; maxResults?: number }, query, t0);
      case 'CUSTOM_REST':
        return await runCustomRest(
          config as { baseUrl: string; method?: string; headers?: Record<string, string>; queryParam?: string },
          query,
          t0,
        );
      case 'TRACKPOD':
        return await runTrackpod(
          config as { apiKey: string; baseUrl?: string; maxResults?: number; timeoutMs?: number },
          query,
          t0,
        );
      default:
        return errResult(type as string, `Unknown integration type: ${type}`, { durationMs: 0 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errResult(type as string, message, { durationMs: Date.now() - t0 });
  }
}

// =============================================================================
// Slack Reply Helper
// =============================================================================

async function postSlackReply(
  botToken: string,
  channelId: string,
  threadTs: string,
  text: string,
): Promise<void> {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ channel: channelId, thread_ts: threadTs, text }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(`Slack chat.postMessage failed: ${data.error ?? 'unknown'}`);
}

// =============================================================================
// LLM Prompt Builder
// =============================================================================

type MemoryMessage = { role: string; content: string; ts?: string };

function buildLlmMessages(
  userMessage: string,
  memoryMessages: MemoryMessage[],
  integrationResults: NormalizedResult[],
): LlmMessage[] {
  const integrationContext = integrationResults
    .map((r) => {
      if (!r.success) {
        return `[${r.source}]: Error — ${r.error?.message ?? r.statusMessage ?? 'unknown'}`;
      }
      const topItems = r.items
        .slice(0, 5)
        .map((item) => `  • ${item.label}${item.summary ? ': ' + item.summary : ''}`)
        .join('\n');
      return `[${r.source}] (${r.items.length} result${r.items.length === 1 ? '' : 's'}):\n${topItems}`;
    })
    .join('\n\n');

  const systemPrompt = [
    'You are a company intelligence assistant integrated with Slack.',
    'You have access to real-time data from connected business integrations.',
    'Provide concise, accurate, and actionable answers based on the data provided.',
    'When referencing specific data points, briefly cite the source in parentheses.',
    'If no relevant data was found, say so clearly and suggest what to check.',
  ].join(' ');

  const messages: LlmMessage[] = [{ role: 'system', content: systemPrompt }];

  // Include up to last 6 conversation turns for context
  for (const m of memoryMessages.slice(-6)) {
    if (m.role === 'user' || m.role === 'assistant') {
      messages.push({ role: m.role as 'user' | 'assistant', content: m.content });
    }
  }

  // Current user query enriched with integration data
  const userContent = integrationContext
    ? `User query: ${userMessage}\n\nLive data from integrations:\n${integrationContext}`
    : userMessage;

  messages.push({ role: 'user', content: userContent });

  return messages;
}

// =============================================================================
// Main Processor
// =============================================================================

export async function processEnrichment(
  job: Job<EnrichmentJobPayload>,
  logger: Logger,
): Promise<EnrichmentJobResult> {
  const payload = job.data;
  const t0 = Date.now();

  logger.info(
    { jobId: job.id, tenantId: payload.tenantId, threadKey: payload.threadKey },
    'Starting enrichment',
  );

  // ── 1. Create a Run record ────────────────────────────────────────────────
  const run = await prisma.run.create({
    data: {
      tenantId: payload.tenantId,
      jobId: job.id ?? null,
      trigger: payload.slack ? 'slack_mention' : 'api',
      status: RunStatus.RUNNING,
      inputData: payload as unknown as Parameters<typeof prisma.run.create>[0]['data']['inputData'],
      startedAt: new Date(),
    },
  });

  try {
    // ── 2. Resolve Slack bot token ──────────────────────────────────────────
    let botToken: string | undefined;

    if (payload.slack?.teamId) {
      const workspace = await prisma.slackWorkspace.findFirst({
        where: { teamId: payload.slack.teamId },
      });
      if (workspace) {
        const dec = decryptObject<{ botToken: string }>(workspace.botTokenEnc);
        botToken = dec.botToken;
      } else {
        logger.warn(
          { teamId: payload.slack.teamId },
          'SlackWorkspace not found — cannot post reply',
        );
      }
    }

    // ── 3. Load enabled integrations ────────────────────────────────────────
    const integrationConfigs = await prisma.integrationConfig.findMany({
      where: { tenantId: payload.tenantId, enabled: true },
    });

    logger.info(
      { runId: run.id, count: integrationConfigs.length },
      'Loaded integrations',
    );

    // ── 4. Load thread memory ────────────────────────────────────────────────
    const threadMemory = await prisma.threadMemory.findUnique({
      where: {
        tenantId_threadKey: {
          tenantId: payload.tenantId,
          threadKey: payload.threadKey,
        },
      },
    });
    const memoryMessages: MemoryMessage[] =
      (threadMemory?.messages as MemoryMessage[] | null) ?? [];

    // ── 5. Run integrations in parallel ──────────────────────────────────────
    const integrationResults = await Promise.allSettled(
      integrationConfigs.map(async (ic) => {
        const step = await prisma.runStep.create({
          data: {
            runId: run.id,
            integration: ic.type,
            status: RunStepStatus.RUNNING,
            inputData: { query: payload.userMessage } as unknown as Parameters<
              typeof prisma.runStep.create
            >[0]['data']['inputData'],
          },
        });

        const stepT0 = Date.now();
        try {
          const rawConfig = decryptObject<Record<string, unknown>>(ic.configEnc);
          const result = await runIntegration(ic.type, rawConfig, payload.userMessage);

          await prisma.runStep.update({
            where: { id: step.id },
            data: {
              status: result.success ? RunStepStatus.COMPLETED : RunStepStatus.FAILED,
              outputData: result as unknown as Parameters<
                typeof prisma.runStep.update
              >[0]['data']['outputData'],
              errorMessage: result.success ? null : (result.error?.message ?? null),
              durationMs: Date.now() - stepT0,
            },
          });

          logger.info(
            { runId: run.id, integration: ic.type, success: result.success },
            'Integration step done',
          );
          return result;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          await prisma.runStep.update({
            where: { id: step.id },
            data: {
              status: RunStepStatus.FAILED,
              errorMessage: message,
              durationMs: Date.now() - stepT0,
            },
          });
          return errResult(ic.type, message, { durationMs: Date.now() - stepT0 });
        }
      }),
    );

    const results: NormalizedResult[] = integrationResults.map((r) =>
      r.status === 'fulfilled' ? r.value : errResult('unknown', 'Integration task rejected'),
    );

    const successfulSources = results.filter((r) => r.success).length;
    const failedSources = results.filter((r) => !r.success).length;

    // ── 6. Build LLM prompt ───────────────────────────────────────────────────
    const llmMessages = buildLlmMessages(payload.userMessage, memoryMessages, results);

    // ── 7. Call LLM ───────────────────────────────────────────────────────────
    let responseText = '';
    try {
      responseText = await callLlm(llmMessages);
      logger.info({ runId: run.id, provider: process.env['LLM_PROVIDER'] ?? 'openai' }, 'LLM responded');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown LLM error';
      logger.error({ runId: run.id, err: message }, 'LLM call failed');
      responseText =
        '⚠️ I encountered an error generating a response. Please try again in a moment.';

      // Log the LLM error
      await prisma.errorLog.create({
        data: {
          tenantId: payload.tenantId,
          runId: run.id,
          source: 'enrichment.processor/llm',
          message,
          metadata: { jobId: job.id } as unknown as Parameters<
            typeof prisma.errorLog.create
          >[0]['data']['metadata'],
        },
      });
    }

    // ── 8. Post reply to Slack ─────────────────────────────────────────────────
    if (payload.slack && botToken) {
      try {
        await postSlackReply(
          botToken,
          payload.slack.channelId,
          payload.slack.threadTs,
          responseText,
        );
        logger.info({ runId: run.id, channel: payload.slack.channelId }, 'Slack reply posted');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown Slack error';
        logger.error({ runId: run.id, err: message }, 'Failed to post Slack reply');
        // Non-fatal — log but continue
        await prisma.errorLog.create({
          data: {
            tenantId: payload.tenantId,
            runId: run.id,
            source: 'enrichment.processor/slack-reply',
            message,
            metadata: { jobId: job.id, channel: payload.slack.channelId } as unknown as Parameters<
              typeof prisma.errorLog.create
            >[0]['data']['metadata'],
          },
        });
      }
    }

    // ── 9. Update thread memory ────────────────────────────────────────────────
    const newMessages: MemoryMessage[] = [
      ...memoryMessages,
      { role: 'user', content: payload.userMessage, ts: new Date().toISOString() },
      { role: 'assistant', content: responseText, ts: new Date().toISOString() },
    ].slice(-50); // Keep last 50 messages to prevent unbounded growth

    const totalChars = newMessages.reduce((acc, m) => acc + m.content.length, 0);

    await prisma.threadMemory.upsert({
      where: {
        tenantId_threadKey: {
          tenantId: payload.tenantId,
          threadKey: payload.threadKey,
        },
      },
      create: {
        tenantId: payload.tenantId,
        threadKey: payload.threadKey,
        messages: newMessages as unknown as Parameters<
          typeof prisma.threadMemory.upsert
        >[0]['create']['messages'],
        totalTurns: 1,
        totalChars,
      },
      update: {
        messages: newMessages as unknown as Parameters<
          typeof prisma.threadMemory.upsert
        >[0]['update']['messages'],
        totalTurns: { increment: 1 },
        totalChars,
      },
    });

    // ── 10. Update Run → final status ──────────────────────────────────────────
    const durationMs = Date.now() - t0;
    const finalStatus =
      failedSources === 0
        ? RunStatus.COMPLETED
        : failedSources < results.length
          ? RunStatus.DEGRADED
          : RunStatus.FAILED;

    await prisma.run.update({
      where: { id: run.id },
      data: {
        status: finalStatus,
        outputSummary: responseText.substring(0, 500),
        durationMs,
        completedAt: new Date(),
      },
    });

    const resultStatus =
      finalStatus === RunStatus.COMPLETED
        ? 'completed'
        : finalStatus === RunStatus.DEGRADED
          ? 'degraded'
          : 'failed';

    logger.info(
      { runId: run.id, status: resultStatus, successfulSources, failedSources, durationMs },
      'Enrichment complete',
    );

    return {
      runId: run.id,
      status: resultStatus,
      responseText,
      successfulSources,
      failedSources,
      durationMs,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack : undefined;
    const durationMs = Date.now() - t0;

    logger.error({ runId: run.id, jobId: job.id, err: message }, 'Enrichment job failed');

    // Record error log
    await prisma.errorLog.create({
      data: {
        tenantId: payload.tenantId,
        runId: run.id,
        source: 'enrichment.processor',
        message,
        stack,
        metadata: { jobId: job.id } as unknown as Parameters<
          typeof prisma.errorLog.create
        >[0]['data']['metadata'],
      },
    });

    // Mark run as FAILED
    await prisma.run.update({
      where: { id: run.id },
      data: { status: RunStatus.FAILED, durationMs, completedAt: new Date() },
    });

    throw err; // Re-throw so BullMQ handles retries
  }
}
