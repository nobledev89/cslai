// =============================================================================
// Integrations Service — CRUD + test connection
// =============================================================================

import { Injectable, NotFoundException } from '@nestjs/common';
import { prisma, decryptObject } from '@company-intel/db';
import { IntegrationType } from '@company-intel/db';
import { RegistryService } from './registry.service';

@Injectable()
export class IntegrationsService {
  constructor(private readonly registry: RegistryService) {}

  async findAll(tenantId: string): Promise<any[]> {
    return prisma.integrationConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        name: true,
        enabled: true,
        lastTestedAt: true,
        testStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(tenantId: string, id: string): Promise<any> {
    const config = await prisma.integrationConfig.findFirst({
      where: { id, tenantId },
    });
    if (!config) throw new NotFoundException(`Integration ${id} not found`);
    return config;
  }

  async create(tenantId: string, body: { type: IntegrationType; name: string; config: Record<string, unknown> }): Promise<any> {
    const configEnc = JSON.stringify(
      await import('@company-intel/db').then((m) =>
        m.encryptObject(body.config),
      ),
    );
    return prisma.integrationConfig.create({
      data: { tenantId, type: body.type, name: body.name, configEnc },
    });
  }

  async update(
    tenantId: string,
    id: string,
    body: { name?: string; enabled?: boolean; config?: Record<string, unknown> },
  ): Promise<any> {
    await this.findOne(tenantId, id);
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.enabled !== undefined) data.enabled = body.enabled;
    if (body.config) {
      data.configEnc = JSON.stringify(
        await import('@company-intel/db').then((m) =>
          m.encryptObject(body.config!),
        ),
      );
    }
    return prisma.integrationConfig.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await prisma.integrationConfig.delete({ where: { id } });
    return { deleted: true };
  }

  async testConnection(tenantId: string, id: string) {
    const record = await this.findOne(tenantId, id);
    const rawConfig = decryptObject(JSON.parse(record.configEnc)) as Record<string, unknown>;
    const integration = this.registry.build(record.type, rawConfig);

    let testStatus: string;
    try {
      await integration.testConnection();
      testStatus = 'ok';
    } catch (err: any) {
      testStatus = `error: ${err?.message ?? 'unknown'}`;
    }

    await prisma.integrationConfig.update({
      where: { id },
      data: { lastTestedAt: new Date(), testStatus },
    });

    return { status: testStatus };
  }
}
