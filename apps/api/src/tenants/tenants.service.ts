import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { prisma } from '@company-intel/db';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  async findAll() {
    return prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { memberships: true, integrationConfigs: true } } },
    });
  }

  async findOne(id: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        memberships: { include: { user: true } },
        integrationConfigs: true,
      },
    });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async create(dto: CreateTenantDto) {
    const existing = await prisma.tenant.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug '${dto.slug}' already taken`);

    return prisma.tenant.create({ data: { name: dto.name, slug: dto.slug } });
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);
    return prisma.tenant.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await prisma.tenant.delete({ where: { id } });
    return { deleted: true };
  }
}
