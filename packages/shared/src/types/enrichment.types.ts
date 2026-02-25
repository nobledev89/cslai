// =============================================================================
// Enrichment job payload types — passed from API → BullMQ → Worker
// =============================================================================

export interface EnrichmentJobPayload {
  /** Tenant that owns this job */
  tenantId: string;
  /** Unique key for the Slack (or other) thread */
  threadKey: string;
  /** The user's message / query */
  userMessage: string;
  /** Slack-specific context, if triggered by Slack */
  slack?: {
    teamId: string;
    channelId: string;
    threadTs: string;
    userId: string;
    botUserId: string;
  };
  /** ISO timestamp when the job was enqueued */
  enqueuedAt: string;
}

export interface EnrichmentJobResult {
  runId: string;
  status: 'completed' | 'degraded' | 'failed';
  /** Final LLM response text posted back to the user */
  responseText?: string;
  /** Number of integrations that succeeded */
  successfulSources: number;
  /** Number of integrations that failed (degraded) */
  failedSources: number;
  durationMs: number;
}
