import { Controller, Get, Patch, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService, LlmProvider } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('llm')
  @ApiOperation({ summary: 'Get LLM settings (API keys masked)' })
  getLlmSettings(@TenantId() tenantId: string) {
    return this.settingsService.getLlmSettingsMasked(tenantId);
  }

  @Patch('llm')
  @ApiOperation({ summary: 'Save LLM settings (provider configs + encrypted API keys)' })
  async saveLlmSettings(
    @TenantId() tenantId: string,
    @Body() body: { providers: any[] },
  ) {
    await this.settingsService.saveLlmSettings(tenantId, body);
    return { saved: true };
  }

  @Post('llm/test/:provider')
  @ApiOperation({ summary: 'Test a specific LLM provider API key' })
  testProvider(
    @TenantId() tenantId: string,
    @Param('provider') provider: LlmProvider,
    @Body() body: { apiKey?: string },
  ) {
    return this.settingsService.testProvider(tenantId, provider, body.apiKey);
  }
}
