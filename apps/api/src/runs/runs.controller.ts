import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RunsService } from './runs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@ApiTags('runs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Get()
  @ApiOperation({ summary: 'List recent enrichment runs for the tenant' })
  findAll(
    @TenantId() tenantId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.runsService.findAll(
      tenantId,
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a run with all steps and errors' })
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.runsService.findOne(tenantId, id);
  }
}
