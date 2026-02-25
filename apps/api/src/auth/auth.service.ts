// =============================================================================
// Auth Service — login, register, refresh, logout
// =============================================================================

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '@company-intel/db';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from '../common/decorators/current-user.decorator';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Validate user credentials (used by LocalStrategy) ────────────────────
  async validateUser(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;

    return user;
  }

  // ─── Login ────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // Grab first membership (users belong to one tenant in this system)
    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      include: { tenant: true },
    });

    if (!membership) throw new UnauthorizedException('No tenant membership found');

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user.id, user.email, membership.tenantId, membership.role);
  }

  // ─── Register ─────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });
    if (!tenant) throw new NotFoundException(`Tenant '${dto.tenantSlug}' not found`);

    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        memberships: {
          create: { tenantId: tenant.id, role: 'ADMIN' },
        },
      },
    });

    return this.issueTokens(user.id, user.email, tenant.id, 'ADMIN');
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────
  async refresh(rawToken: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: rawToken },
      include: {
        user: {
          include: { memberships: { include: { tenant: true } } },
        },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const membership = stored.user.memberships[0];
    if (!membership) throw new UnauthorizedException('No tenant membership');

    return this.issueTokens(
      stored.user.id,
      stored.user.email,
      membership.tenantId,
      membership.role,
    );
  }

  // ─── Logout ───────────────────────────────────────────────────────────────
  async logout(rawToken: string) {
    await prisma.refreshToken.updateMany({
      where: { token: rawToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Token helpers ────────────────────────────────────────────────────────
  private async issueTokens(
    userId: string,
    email: string,
    tenantId: string,
    role: string,
  ) {
    const payload: JwtPayload = { sub: userId, email, tenantId, role };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      secret: this.config.getOrThrow('JWT_SECRET'),
    });

    const rawRefreshToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    await prisma.refreshToken.create({
      data: { userId, token: rawRefreshToken, expiresAt },
    });

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: 900 };
  }
}
