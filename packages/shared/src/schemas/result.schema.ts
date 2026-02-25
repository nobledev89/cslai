import { z } from 'zod';

// =============================================================================
// NormalizedResult — the standard output shape every integration must return.
// This ensures the LLM receives consistent, well-typed context regardless of
// which integration produced the data.
// =============================================================================

export const NormalizedResultItemSchema = z.object({
  /** Human-readable label for this result (company name, order ID, etc.) */
  label: z.string(),
  /** Short summary or description of this item */
  summary: z.string().optional(),
  /** Key-value metadata specific to the integration */
  data: z.record(z.unknown()).default({}),
  /** ISO 8601 timestamp this item was created or last updated, if available */
  timestamp: z.string().optional(),
  /** Source URL, if applicable */
  url: z.string().url().optional(),
});

export type NormalizedResultItem = z.infer<typeof NormalizedResultItemSchema>;

export const NormalizedResultSchema = z.object({
  /** Integration type that produced this result */
  source: z.string(),
  /** Whether the integration completed successfully */
  success: z.boolean(),
  /** Human-readable status message (shown in Admin UI run steps) */
  statusMessage: z.string().optional(),
  /** Structured results array — empty on failure */
  items: z.array(NormalizedResultItemSchema).default([]),
  /** Total results available (may be more than returned) */
  totalCount: z.number().int().optional(),
  /** Duration of the integration call in milliseconds */
  durationMs: z.number().int().optional(),
  /** Raw error, if success = false */
  error: z
    .object({
      code: z.string().optional(),
      message: z.string(),
    })
    .optional(),
});

export type NormalizedResult = z.infer<typeof NormalizedResultSchema>;

// Helper — create a successful result
export function okResult(
  source: string,
  items: NormalizedResultItem[],
  opts?: { statusMessage?: string; totalCount?: number; durationMs?: number },
): NormalizedResult {
  return {
    source,
    success: true,
    statusMessage: opts?.statusMessage ?? `Found ${items.length} result(s)`,
    items,
    totalCount: opts?.totalCount ?? items.length,
    durationMs: opts?.durationMs,
  };
}

// Helper — create a failed result
export function errResult(
  source: string,
  message: string,
  opts?: { code?: string; durationMs?: number },
): NormalizedResult {
  return {
    source,
    success: false,
    statusMessage: `Error: ${message}`,
    items: [],
    error: { code: opts?.code, message },
    durationMs: opts?.durationMs,
  };
}
