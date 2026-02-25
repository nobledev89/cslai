import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { prisma } from '@company-intel/db';

@ApiTags('health')
@Controller()
export class HealthController {
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe — always returns 200' })
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe — checks DB connectivity' })
  async ready() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', db: 'ok', timestamp: new Date().toISOString() };
    } catch {
      return { status: 'not ready', db: 'error', timestamp: new Date().toISOString() };
    }
  }
}
