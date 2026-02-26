// Quick script to create SlackWorkspace record
// Run this on your server with: node setup-slack-workspace.js

const { PrismaClient } = require('./node_modules/@prisma/client');
const { encryptObject } = require('./packages/db/dist/encryption');

// Load environment variables
require('dotenv').config({ path: './.env' });

const prisma = new PrismaClient();

async function setup() {
  try {
    console.log('Setting up Slack workspace...\n');

    // Check if tenant exists
    const tenants = await prisma.tenant.findMany();
    console.log('Existing tenants:', tenants.map(t => ({ id: t.id, name: t.name })));
    
    if (tenants.length === 0) {
      console.error('\n❌ No tenants found! Create a tenant first.');
      process.exit(1);
    }

    const tenant = tenants[0]; // Use first tenant
    console.log(`\nUsing tenant: ${tenant.name} (${tenant.id})\n`);

    // Slack team details (UPDATE THESE!)
    const SLACK_TEAM_ID = 'T01GVPQL2BG'; // Your Slack team ID from logs
    const SLACK_TEAM_NAME = 'Your Workspace Name'; // Replace with your workspace name
    const SLACK_BOT_TOKEN = 'xoxb-your-actual-bot-token-here'; // Get from Slack app OAuth page

    // Check if SlackWorkspace already exists
    const existing = await prisma.slackWorkspace.findFirst({
      where: { teamId: SLACK_TEAM_ID },
    });

    if (existing) {
      console.log('✅ SlackWorkspace already exists:', existing);
      process.exit(0);
    }

    // Encrypt bot token
    const botTokenEnc = encryptObject({ botToken: SLACK_BOT_TOKEN });

    // Create SlackWorkspace
    const workspace = await prisma.slackWorkspace.create({
      data: {
        tenantId: tenant.id,
        teamId: SLACK_TEAM_ID,
        teamName: SLACK_TEAM_NAME,
        botTokenEnc,
        allowedChannels: [], // Empty = all channels allowed
      },
    });

    console.log('✅ SlackWorkspace created successfully!');
    console.log(workspace);
    console.log('\nNow restart the API and test your bot!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setup();
