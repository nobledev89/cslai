// Fix script to delete and recreate SlackWorkspace with correct encryption key
// Run this on your production server: npx tsx fix-slack-workspace.ts

import * as dotenv from 'dotenv';
dotenv.config();

import { prisma, encryptObject } from './packages/db/src/index';

const SLACK_TEAM_ID = process.env.SLACK_TEAM_ID || 'T01GVPQL2BG';
const SLACK_TEAM_NAME = process.env.SLACK_TEAM_NAME || 'Corporate Spec Workspace';
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';

if (!SLACK_BOT_TOKEN) {
  console.error('❌ Error: SLACK_BOT_TOKEN environment variable is required');
  console.error('Please set it in your .env file');
  process.exit(1);
}

async function fix() {
  try {
    console.log('Fixing SlackWorkspace encryption issue...\n');

    // Delete existing workspace if it exists
    const existing = await prisma.slackWorkspace.findFirst({
      where: { teamId: SLACK_TEAM_ID },
    });

    if (existing) {
      console.log('🗑️  Deleting existing SlackWorkspace with wrong encryption...');
      await prisma.slackWorkspace.delete({
        where: { id: existing.id },
      });
      console.log('✅ Deleted\n');
    }

    // Get tenant
    const tenants = await prisma.tenant.findMany();
    if (tenants.length === 0) {
      console.error('❌ No tenants found!');
      process.exit(1);
    }

    const tenant = tenants[0];
    console.log(`Using tenant: ${tenant.name} (${tenant.id})\n`);

    // Encrypt bot token with CURRENT server's encryption key
    console.log('🔐 Encrypting bot token with production ENCRYPTION_KEY...');
    const botTokenEnc = encryptObject({ botToken: SLACK_BOT_TOKEN });

    // Create new SlackWorkspace
    const workspace = await prisma.slackWorkspace.create({
      data: {
        tenantId: tenant.id,
        teamId: SLACK_TEAM_ID,
        teamName: SLACK_TEAM_NAME,
        botTokenEnc,
        allowedChannels: [],
      },
    });

    console.log('✅ SlackWorkspace recreated successfully!');
    console.log(workspace);
    console.log('\n🎉 Now restart the worker and test your bot!');
    console.log('   pm2 restart worker');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fix();
