# Deploying Worker Update to Production

The TrackPod integration has been added to the worker processor, but your production server needs to be updated with the new code.

## Quick Deployment Steps

Run these commands on your **production server** (ubuntu@ip-172-31-17-236):

```bash
# 1. Navigate to the project directory
cd /home/ubuntu/cslai

# 2. Pull latest code from GitHub
git pull origin main

# 3. Install any new dependencies (if any)
pnpm install

# 4. Rebuild the worker
pnpm --filter worker build

# 5. Restart the worker via PM2
pm2 restart worker

# 6. Check the worker logs
pm2 logs worker --lines 50
```

## Alternative: Full Rebuild

If you want to rebuild everything:

```bash
cd /home/ubuntu/cslai
git pull origin main
pnpm install
pnpm build
pm2 restart all
```

## Verify Deployment

After restart, check the logs:

```bash
# Watch worker logs in real-time
pm2 logs worker --lines 100

# You should see:
# - "Worker started and listening for enrichment jobs"
# - No errors about missing integrations
```

## Test Again in Slack

Once deployed, try mentioning your bot again:

```
@YourBotName Tell me about order 12345
```

Expected response time: 5-15 seconds

## Troubleshooting After Deployment

### Check if code was pulled
```bash
cd /home/ubuntu/cslai
git log -1
# Should show commit: "Add TrackPod integration to worker processor"
```

### Check if worker compiled
```bash
ls -la /home/ubuntu/cslai/apps/worker/dist/
# Should have main.js and other files
```

### Check PM2 status
```bash
pm2 status
# All services should show "online"
```

### View detailed worker logs
```bash
pm2 logs worker --lines 200 | grep -i "trackpod\|error\|enrichment"
```

### Check database for recent runs
If the bot still doesn't respond, SSH to the server and check the database:

```bash
# On server, connect to postgres
psql -U intel -d company_intel_dev

# Check recent runs
SELECT id, trigger, status, "createdAt", "outputSummary"
FROM "Run"
ORDER BY "createdAt" DESC
LIMIT 5;

# Check for errors
SELECT source, message, "createdAt"
FROM "ErrorLog"
ORDER BY "createdAt" DESC
LIMIT 10;
```

## Common Issues After Deploy

### Issue 1: Worker not picking up jobs
**Solution:** Check Redis connection
```bash
redis-cli ping
# Should respond: PONG
```

### Issue 2: API not enqueueing jobs
**Solution:** Check API logs
```bash
pm2 logs api --lines 100 | grep -i "slack"
```

### Issue 3: Slack events not reaching API
**Solution:** Check Slack Event Subscriptions
- Go to https://api.slack.com/apps
- Verify Request URL is still verified
- Check challenge URL points to your domain

### Issue 4: Integration configs missing
**Solution:** Verify integrations are enabled in database
```sql
SELECT type, enabled, "createdAt"
FROM "IntegrationConfig"
WHERE "tenantId" = 'your-tenant-id';
```

## Environment Variables Check

Ensure these are set in ecosystem.config.js on the server:

**Worker Environment:**
- `REDIS_URL` or `REDIS_HOST`
- `DATABASE_URL`
- `ENCRYPTION_KEY`
- `LLM_PROVIDER` (openai/anthropic/gemini)
- `OPENAI_API_KEY` (or appropriate LLM key)

**API Environment:**
- `SLACK_SIGNING_SECRET` (must match Slack app)
- All the same as worker for database/redis/encryption

## Quick Health Check

```bash
# On the server
curl http://localhost:3001/health
# Should return: {"status":"ok"}

# Check if bot is reachable from Slack
# Slack should POST to: https://cslai.corporatespec.com/integrations/slack/events
```

## If Still Not Working

1. **Check Slack App Permissions:**
   - `app_mentions:read`
   - `chat:write`
   - `channels:read`
   - `groups:read`

2. **Verify Bot is in Channel:**
   - `/invite @BotName` in Slack channel

3. **Check Firewall/Caddy:**
   - Ensure Caddy is forwarding requests to API on port 3001
   ```bash
   systemctl status caddy
   curl -v https://cslai.corporatespec.com/health
   ```

4. **Manual Test API Endpoint:**
   ```bash
   # From any machine, test the Slack endpoint
   curl -X POST https://cslai.corporatespec.com/integrations/slack/events \
     -H "Content-Type: application/json" \
     -d '{"type":"url_verification","challenge":"test123"}'
   
   # Should respond with: {"challenge":"test123"}
   ```

## Success Indicators

After deployment, you should see:

✅ Worker process shows "online" in PM2
✅ No errors in worker logs
✅ Bot responds to mentions within 15 seconds
✅ Database shows new Run records when bot is mentioned
✅ Worker logs show "Enrichment complete" messages

---

**Need immediate help?** Check the worker logs first:
```bash
pm2 logs worker --err --lines 100
```
