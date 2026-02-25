import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MemoryService } from './memory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@ApiTags('memory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  @ApiOperation({ summary: 'List all thread memories for the tenant' })
  listThreads(
    @TenantId() tenantId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.memoryService.listThreads(
      tenantId,
      skip ? parseInt(skip, 10) : 0,
      take ? parseInt(take, 10) : 50,
    );
  }

  @Get(':threadKey')
  @ApiOperation({ summary: 'Get a thread memory with messages' })
  getThread(@TenantId() tenantId: string, @Param('threadKey') threadKey: string) {
    return this.memoryService.getThread(tenantId, threadKey);
  }
}
