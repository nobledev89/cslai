// =============================================================================
// Slack Events Controller — POST /integrations/slack/events
// Handles Slack URL verification + message events
// =============================================================================

import {
  Controller,
  Post,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { QueueProducer } from '../../queue/queue.producer';
import { prisma, decryptObject } from '@company-intel/db';

interface SlackUrlVerification {
  type: 'url_verification';
  challenge: string;
}

interface SlackEventCallback {
  type: 'event_callback';
  team_id: string;
  event: {
    type: string;
    text?: string;
    user?: string;
    channel?: string;
    thread_ts?: string;
    ts?: string;
    bot_id?: string;
  };
  event_id: string;
}

type SlackPayload = SlackUrlVerification | SlackEventCallback;

@Controller('integrations/slack')
export class SlackEventsController {
  private readonly logger = new Logger(SlackEventsController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly queueProducer: QueueProducer,
  ) {}

  @Post('events')
  @HttpCode(HttpStatus.OK)
  async handleEvent(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-slack-signature') sig: string,
    @Headers('x-slack-request-timestamp') ts: string,
    @Body() payload: SlackPayload,
  ) {
    // ─── URL verification handshake (no signature check needed) ─────────────
    if (payload.type === 'url_verification') {
      this.logger.log('Slack URL verification challenge received');
      return { challenge: payload.challenge };
    }

    // ─── Verify Slack signature for all other events ───────────────────────
    // Try to get signing secret from database first, fallback to env
    let signingSecret = this.config.get<string>('SLACK_SIGNING_SECRET', '');
    
    // For event_callback, we can get the signing secret from the integration config
    if (payload.type === 'event_callback') {
      try {
        const slackConfig = await prisma.integrationConfig.findFirst({
          where: { type: 'SLACK', enabled: true },
        });
        
        if (slackConfig) {
          const decrypted = decryptObject<{ signingSecret?: string }>(slackConfig.configEnc);
          if (decrypted.signingSecret) {
            signingSecret = decrypted.signingSecret;
            this.logger.debug('Using Slack signing secret from database');
          }
        }
      } catch (error) {
        this.logger.warn('Failed to fetch Slack config from database, using env var');
      }
    }
    
    if (signingSecret && signingSecret !== 'dev_signing_secret_changeme') {
      const rawBody = req.rawBody?.toString() ?? JSON.stringify(payload);
      const baseString = `v0:${ts}:${rawBody}`;
      const expected = `v0=${createHmac('sha256', signingSecret).update(baseString).digest('hex')}`;
      if (
        !sig ||
        !timingSafeEqual(Buffer.from(expected), Buffer.from(sig.padEnd(expected.length, '\0').slice(0, expected.length)))
      ) {
        this.logger.warn('Slack signature verification failed');
        return { ok: false };
      }
    } else {
      this.logger.warn('No valid Slack signing secret configured - skipping signature verification (INSECURE)');
    }

    // ─── Event callback ─────────────────────────────────────────────────────
    if (payload.type === 'event_callback') {
      const { event, team_id } = payload;

      // Skip bot messages
      if (event.bot_id) return { ok: true };

      // Only handle app_mention events
      if (event.type !== 'app_mention') return { ok: true };

      this.logger.log(`Slack mention from team=${team_id} channel=${event.channel}`);

      // Look up the actual tenant ID from SlackWorkspace
      const workspace = await prisma.slackWorkspace.findFirst({
        where: { teamId: team_id },
      });

      if (!workspace) {
        this.logger.warn(`SlackWorkspace not found for team=${team_id} - cannot process mention`);
        return { ok: true }; // Return ok to prevent retries
      }

      try {
        await this.queueProducer.enqueueEnrichment({
          tenantId: workspace.tenantId, // Use actual tenant ID from database
          threadKey: `slack:${team_id}:${event.channel}:${event.thread_ts ?? event.ts}`,
          userMessage: event.text ?? '',
          slack: {
            teamId: team_id,
            channelId: event.channel ?? '',
            threadTs: event.thread_ts ?? event.ts ?? '',
            userId: event.user ?? '',
            botUserId: '', // Will be resolved by worker
          },
          enqueuedAt: new Date().toISOString(),
        });
        this.logger.log('Enrichment job enqueued successfully');
      } catch (error) {
        this.logger.error(`Failed to enqueue enrichment job: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    }

    return { ok: true };
  }
}
