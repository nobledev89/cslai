// =============================================================================
// Company Intel Bot — API Bootstrap
// =============================================================================

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ─── Logger ────────────────────────────────────────────────────────────────
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // ─── Security ──────────────────────────────────────────────────────────────
  app.use(helmet());

  // ─── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigins = configService
    .get<string>('CORS_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
  });

  // ─── Cookies ───────────────────────────────────────────────────────────────
  app.use(cookieParser());

  // ─── Global pipes ──────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Global filters ────────────────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ─── Global prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api', {
    exclude: [
      '/health',
      '/ready',
      '/integrations/slack/events',
    ],
  });

  // ─── Swagger (non-prod only) ────────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Company Intel Bot API')
      .setDescription('Multi-tenant company intelligence Slack bot API')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('refresh_token')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // ─── Start ─────────────────────────────────────────────────────────────────
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API listening on port ${port} (${nodeEnv})`);
}

bootstrap();
