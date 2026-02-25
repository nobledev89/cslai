// =============================================================================
// Company Intel Worker — BullMQ enrichment worker entry point
// =============================================================================

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import type { EnrichmentJobPayload } from '@company-intel/shared';
import { processEnrichment } from './processors/enrichment.processor';

// ─── Logger ──────────────────────────────────────────────────────────────────

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  ...(process.env['NODE_ENV'] !== 'production'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});

// ─── Redis connection ─────────────────────────────────────────────────────────

const connection = new Redis({
  host: process.env['REDIS_HOST'] ?? 'localhost',
  port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  password: process.env['REDIS_PASSWORD'] ?? undefined,
  // Required for BullMQ — disables the auto-retry on blocking commands
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

connection.on('connect', () => {
  logger.info('Redis connected');
});

// ─── Worker ───────────────────────────────────────────────────────────────────

const ENRICHMENT_QUEUE = 'enrichment';
const CONCURRENCY = parseInt(process.env['WORKER_CONCURRENCY'] ?? '5', 10);

const worker = new Worker<EnrichmentJobPayload>(
  ENRICHMENT_QUEUE,
  async (job: Job<EnrichmentJobPayload>) => {
    logger.info(
      { jobId: job.id, tenantId: job.data.tenantId, threadKey: job.data.threadKey },
      'Received enrichment job',
    );
    return processEnrichment(job, logger);
  },
  {
    connection,
    concurrency: CONCURRENCY,
    limiter: {
      max: 50,
      duration: 60_000, // 50 jobs/min global rate limit
    },
  },
);

// ─── Worker events ────────────────────────────────────────────────────────────

worker.on('completed', (job, result) => {
  logger.info(
    { jobId: job.id, runId: result?.runId, durationMs: result?.durationMs },
    'Job completed',
  );
});

worker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err: err?.message, stack: err?.stack }, 'Job failed');
});

worker.on('error', (err) => {
  logger.error({ err: err.message }, 'Worker error');
});

worker.on('stalled', (jobId) => {
  logger.warn({ jobId }, 'Job stalled — will be retried');
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutdown signal received — draining worker');
  try {
    await worker.close();
    connection.disconnect();
    logger.info('Worker shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// ─── Start ────────────────────────────────────────────────────────────────────

logger.info(
  { queue: ENRICHMENT_QUEUE, concurrency: CONCURRENCY },
  '🚀 Company Intel Worker started',
);
