import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma } from '@company-intel/db';
import type { Run, RunStep } from '@company-intel/db';

@Injectable()
export class RunsService {
  async findAll(tenantId: string, skip = 0, take = 20): Promise<Array<Run & { _count: { steps: number; errors: number } }>> {
    return prisma.run.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { _count: { select: { steps: true, errors: true } } },
    });
  }

  async findOne(tenantId: string, id: string): Promise<Run & { steps: RunStep[]; errors: any[] }> {
    const run = await prisma.run.findFirst({
      where: { id, tenantId },
      include: { steps: { orderBy: { createdAt: 'asc' } }, errors: true },
    });
    if (!run) throw new NotFoundException(`Run ${id} not found`);
    return run;
  }
}
