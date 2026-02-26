# Slack Bot Fix - Deployment Instructions

## Problem
The Slack bot was not replying because the `SlackWorkspace` record was missing from the database for team `T01GVPQL2BG`.

## Solution
Run the setup script on the live server to create the SlackWorkspace record.

## Deployment Steps

### On the Live Server:

1. **Pull the latest changes:**
   ```bash
   cd /path/to/cslai
   git pull origin main
   ```

2. **Install the new dependency (dotenv):**
   ```bash
   pnpm install
   ```

3. **Run the setup script:**
   ```bash
   npx tsx setup-slack-workspace.ts
   ```
   
   This will:
   - Connect to your production database
   - Find the first tenant (or you can modify the script to use a specific tenant)
   - Create a SlackWorkspace record linking team `T01GVPQL2BG` to that tenant
   - Encrypt and store the bot token

4. **Restart the API with PM2:**
   ```bash
   pm2 restart api
   ```

5. **Test the bot:**
   - Go to your Slack workspace
   - Mention the bot with `@Aira` (or your bot's name)
   - The bot should now respond!

## What Was Fixed

1. **Updated setup-slack-workspace.ts**: Added dotenv to load environment variables (DATABASE_URL, ENCRYPTION_KEY)
2. **Added dotenv dependency**: Required for the setup script to work
3. **Created documentation**: This guide for deployment

## Verification

After deployment, check the PM2 logs to confirm:
```bash
pm2 logs api
```

You should see messages like:
- "Slack mention from team=T01GVPQL2BG channel=..."
- "Enrichment job enqueued successfully"

Instead of:
- "SlackWorkspace not found for team=T01GVPQL2BG"
