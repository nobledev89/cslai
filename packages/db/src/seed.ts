/**
 * Seed script — creates the initial super-admin tenant + owner user.
 * Run with: make seed  (or: pnpm --filter @company-intel/db exec tsx src/seed.ts)
 *
 * Reads from env:
 *   SEED_ADMIN_EMAIL
 *   SEED_ADMIN_PASSWORD
 *   SEED_TENANT_NAME
 */

import { hash } from 'bcryptjs';

import { prisma } from './client';

async function main(): Promise<void> {
  const email = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@example.com';
  const password = process.env['SEED_ADMIN_PASSWORD'] ?? 'changeme';
  const tenantName = process.env['SEED_TENANT_NAME'] ?? 'Default Tenant';
  const slug = tenantName.toLowerCase().replace(/\s+/g, '-');

  console.log(`\n🌱 Seeding database...`);
  console.log(`   Tenant : ${tenantName} (${slug})`);
  console.log(`   Admin  : ${email}\n`);

  // 1. Upsert tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {},
    create: { name: tenantName, slug },
  });
  console.log(`✅ Tenant: ${tenant.id}`);

  // 2. Upsert user
  const passwordHash = await hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: 'Super Admin',
      emailVerified: true,
    },
  });
  console.log(`✅ User: ${user.id}`);

  // 3. Upsert membership (OWNER role)
  const membership = await prisma.membership.upsert({
    where: {
      tenantId_userId: { tenantId: tenant.id, userId: user.id },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: 'OWNER',
    },
  });
  console.log(`✅ Membership: ${membership.id} (OWNER)`);

  console.log(`\n🎉 Seed complete!\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
