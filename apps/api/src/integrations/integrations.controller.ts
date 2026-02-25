import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all integrations for the tenant' })
  findAll(@TenantId() tenantId: string): Promise<any[]> {
    return this.integrationsService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single integration config' })
  findOne(@TenantId() tenantId: string, @Param('id') id: string): Promise<any> {
    return this.integrationsService.findOne(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new integration' })
  create(
    @TenantId() tenantId: string,
    @Body() body: { type: any; name: string; config: Record<string, unknown> },
  ): Promise<any> {
    return this.integrationsService.create(tenantId, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an integration' })
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() body: { name?: string; enabled?: boolean; config?: Record<string, unknown> },
  ): Promise<any> {
    return this.integrationsService.update(tenantId, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an integration' })
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.integrationsService.remove(tenantId, id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test integration connectivity' })
  test(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.integrationsService.testConnection(tenantId, id);
  }
}
