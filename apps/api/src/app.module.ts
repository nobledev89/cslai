// =============================================================================
// Company Intel Bot — Root Application Module
// =============================================================================

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { MemoryModule } from './memory/memory.module';
import { RunsModule } from './runs/runs.module';
import { LlmModule } from './llm/llm.module';
import { QueueModule } from './queue/queue.module';
import { HealthModule } from './health/health.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    // ─── Config ──────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),

    // ─── Pino Logger ─────────────────────────────────────────────────────────
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL', 'info'),
          transport:
            config.get('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
      }),
    }),

    // ─── Rate Limiting ───────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL', 60000),
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),

    // ─── Feature Modules ─────────────────────────────────────────────────────
    AuthModule,
    TenantsModule,
    UsersModule,
    IntegrationsModule,
    MemoryModule,
    RunsModule,
    LlmModule,
    QueueModule,
    HealthModule,
    SettingsModule,
  ],
})
export class AppModule {}
