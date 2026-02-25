import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@company-intel/db';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  async findAll(tenantId: string): Promise<any[]> {
    return prisma.user.findMany({
      where: { memberships: { some: { tenantId } } },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        memberships: { where: { tenantId }, select: { role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<any> {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);

    return prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, updatedAt: true },
    });
  }
}
