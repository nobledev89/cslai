import { z } from 'zod';

// =============================================================================
// Integration config schemas — one per integration type.
// These are used for validation in both the API and Admin UI.
// =============================================================================

// ─── Slack ────────────────────────────────────────────────────────────────────

export const SlackConfigSchema = z.object({
  botToken: z.string().min(1).startsWith('xoxb-', {
    message: 'Bot token must start with xoxb-',
  }),
  signingSecret: z.string().min(1),
  allowedChannels: z.array(z.string()).default([]),
  /** Maximum Slack API history search results per query */
  maxHistoryResults: z.number().int().min(1).max(200).default(20),
});

export type SlackConfig = z.infer<typeof SlackConfigSchema>;

// ─── WooCommerce ──────────────────────────────────────────────────────────────

export const WooCommerceConfigSchema = z.object({
  baseUrl: z.string().url({ message: 'Must be a valid URL, e.g. https://shop.example.com' }),
  consumerKey: z.string().min(1).startsWith('ck_', {
    message: 'Consumer key must start with ck_',
  }),
  consumerSecret: z.string().min(1).startsWith('cs_', {
    message: 'Consumer secret must start with cs_',
  }),
  /** WooCommerce REST API version */
  apiVersion: z.enum(['wc/v3', 'wc/v2']).default('wc/v3'),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
});

export type WooCommerceConfig = z.infer<typeof WooCommerceConfigSchema>;

// ─── Gmail OAuth2 ─────────────────────────────────────────────────────────────

export const GmailConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  /** Stored after OAuth flow completes */
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiry: z.number().optional(),
  /** Max emails to return per search */
  maxResults: z.number().int().min(1).max(100).default(10),
});

export type GmailConfig = z.infer<typeof GmailConfigSchema>;

// ─── Custom REST ──────────────────────────────────────────────────────────────

export const CustomRestConfigSchema = z.object({
  baseUrl: z.string().url(),
  method: z.enum(['GET', 'POST']).default('GET'),
  /** Static headers (Authorization, etc.) */
  headers: z.record(z.string()).default({}),
  /** Query param name or request body field that receives the search term */
  queryParam: z.string().default('q'),
  /** JSONPath expression to extract results array from response */
  resultsJsonPath: z.string().default('$.results'),
  /** JSONPath to extract a human-readable label from each result item */
  labelJsonPath: z.string().default('$.name'),
  timeoutMs: z.number().int().min(500).max(30000).default(8000),
});

export type CustomRestConfig = z.infer<typeof CustomRestConfigSchema>;

// ─── Trackpod (feature-flagged stub) ─────────────────────────────────────────

export const TrackpodConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z
    .string()
    .url()
    .default('https://api.trackpod.io'),
  enabled: z.boolean().default(false),
});

export type TrackpodConfig = z.infer<typeof TrackpodConfigSchema>;

// ─── Union ────────────────────────────────────────────────────────────────────

export const IntegrationConfigSchemas = {
  SLACK: SlackConfigSchema,
  WOOCOMMERCE: WooCommerceConfigSchema,
  GMAIL: GmailConfigSchema,
  CUSTOM_REST: CustomRestConfigSchema,
  TRACKPOD: TrackpodConfigSchema,
} as const;

export type IntegrationConfigMap = {
  SLACK: SlackConfig;
  WOOCOMMERCE: WooCommerceConfig;
  GMAIL: GmailConfig;
  CUSTOM_REST: CustomRestConfig;
  TRACKPOD: TrackpodConfig;
};
