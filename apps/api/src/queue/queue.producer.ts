import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { EnrichmentJobPayload } from '@company-intel/shared';

export const ENRICHMENT_QUEUE = 'enrichment';

@Injectable()
export class QueueProducer {
  private readonly logger = new Logger(QueueProducer.name);
  private queue: Queue<EnrichmentJobPayload>;

  constructor(private readonly config: ConfigService) {
    this.queue = new Queue<EnrichmentJobPayload>(ENRICHMENT_QUEUE, {
      connection: {
        host: this.config.get<string>('REDIS_HOST', 'localhost'),
        port: this.config.get<number>('REDIS_PORT', 6379),
        password: this.config.get<string>('REDIS_PASSWORD'),
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }

  async enqueueEnrichment(payload: EnrichmentJobPayload): Promise<string> {
    const job = await this.queue.add('enrich', payload, {
      jobId: `${payload.tenantId}:${payload.slack?.threadTs ?? Date.now()}`,
    });
    this.logger.log(`Enqueued enrichment job ${job.id} for tenant ${payload.tenantId}`);
    return job.id ?? '';
  }
}
