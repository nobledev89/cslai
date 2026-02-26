# Testing Your Slack Bot Integration

This guide will help you test the Slack bot integration with TrackPod, WooCommerce, and Slack to ensure everything is working correctly.

## Prerequisites

Before testing, ensure you have:

1. ✅ **Slack App configured** with event subscription URL verified
2. ✅ **All integrations configured** in the dashboard:
   - Slack (bot token and signing secret)
   - WooCommerce (API credentials)
   - TrackPod (API key)
3. ✅ **Services running**:
   - API server (`pnpm dev` or deployed)
   - Worker process (`pnpm --filter worker dev` or deployed)
   - Redis (for job queue)
   - PostgreSQL (for database)

## System Architecture

When you mention the bot in Slack:

```
1. Slack → POST /integrations/slack/events
2. API verifies signature → enqueues enrichment job
3. Worker picks up job → runs all enabled integrations in parallel
4. Worker calls LLM with aggregated data
5. Worker posts response back to Slack thread
```

## Step 1: Verify All Services Are Running

### Check API Server
```bash
# Should respond with health check
curl http://localhost:3001/health
```

### Check Worker Logs
```bash
# Worker should be listening for jobs
pnpm --filter worker dev
# Look for: "Worker started and listening for enrichment jobs"
```

### Check Slack Event Subscriptions
1. Go to [Slack API Dashboard](https://api.slack.com/apps)
2. Select your app
3. Navigate to **Event Subscriptions**
4. Ensure **Request URL** is verified (green checkmark)
5. Ensure `app_mention` event is subscribed under **Subscribe to bot events**

## Step 2: Test Integration Configurations

### Test TrackPod Integration
```bash
# Test the connection manually via API
curl -X POST http://localhost:3001/integrations/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "type": "TRACKPOD",
    "config": {
      "apiKey": "YOUR_TRACKPOD_API_KEY"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "TrackPod connection successful"
}
```

### Test WooCommerce Integration
```bash
curl -X POST http://localhost:3001/integrations/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "type": "WOOCOMMERCE",
    "config": {
      "baseUrl": "https://your-shop.com",
      "consumerKey": "ck_xxxxx",
      "consumerSecret": "cs_xxxxx"
    }
  }'
```

## Step 3: Invite Bot to a Slack Channel

1. Open Slack and go to a test channel
2. Type `/invite @YourBotName` (replace with your bot's name)
3. The bot should join the channel

## Step 4: Test Bot with Simple Query

### Test 1: General Query
In the Slack channel, mention your bot:

```
@YourBotName What integrations are you connected to?
```

**Expected behavior:**
- Bot receives the mention
- All enabled integrations are queried (even if no results found)
- LLM generates a response listing available integrations
- Response posted in thread

### Test 2: TrackPod Order Query
```
@YourBotName Tell me about order 12345
```

**Expected behavior:**
- TrackPod searches for order number "12345"
- If found: Shows order status, route, customer name
- If not found: Indicates no results from TrackPod
- LLM synthesizes response based on available data

### Test 3: TrackPod Route Query
```
@YourBotName What's the status of route RT-001?
```

**Expected behavior:**
- TrackPod searches for route code "RT-001"
- Shows route status, driver name, vehicle, order count
- LLM provides summary

### Test 4: WooCommerce Order Query
```
@YourBotName Find WooCommerce order 789
```

**Expected behavior:**
- WooCommerce searches for order ID or customer name "789"
- Shows order status, total, customer details
- LLM provides formatted response

### Test 5: Multi-Integration Query
```
@YourBotName Tell me everything about order ABC123
```

**Expected behavior:**
- **ALL** integrations search for "ABC123":
  - TrackPod searches orders and routes
  - WooCommerce searches orders
  - Slack searches message history
- LLM combines results from all sources
- Response cites which integration provided each piece of info

## Step 5: Monitor Logs and Database

### Check API Logs
```bash
# Watch for incoming Slack events
tail -f apps/api/logs/app.log

# Look for:
# "Slack mention from team=T... channel=C..."
# "Enrichment job enqueued"
```

### Check Worker Logs
```bash
tail -f apps/worker/logs/worker.log

# Look for:
# "Starting enrichment"
# "Loaded integrations" (count: 3)
# "Integration step done" (for TRACKPOD, WOOCOMMERCE, SLACK)
# "LLM responded"
# "Slack reply posted"
# "Enrichment complete"
```

### Check Database Records
```sql
-- View recent runs
SELECT 
  id, 
  trigger, 
  status, 
  "outputSummary", 
  "durationMs",
  "createdAt"
FROM "Run"
ORDER BY "createdAt" DESC
LIMIT 10;

-- View run steps (integration results)
SELECT 
  r.id as run_id,
  rs.integration,
  rs.status,
  rs."durationMs",
  rs."errorMessage"
FROM "Run" r
JOIN "RunStep" rs ON rs."runId" = r.id
WHERE r."createdAt" > NOW() - INTERVAL '1 hour'
ORDER BY r."createdAt" DESC;

-- View thread memory
SELECT 
  "threadKey",
  "totalTurns",
  "totalChars",
  "updatedAt"
FROM "ThreadMemory"
ORDER BY "updatedAt" DESC
LIMIT 5;
```

## Step 6: Test Conversation Memory

The bot maintains conversation context within each thread.

### Test Conversation Flow
```
User: @Bot Tell me about order 12345
Bot: [Provides details about order 12345]

User: What about the driver?
Bot: [Should remember we're talking about order 12345 and provide driver info]

User: When will it be delivered?
Bot: [Should provide delivery info for the same order]
```

**How it works:**
- Each Slack thread has a unique `threadKey`
- Last 50 messages stored in `ThreadMemory` table
- Last 6 conversation turns sent to LLM for context

## Step 7: Test Error Handling

### Test with Invalid API Key
1. Go to dashboard → Integrations
2. Temporarily change TrackPod API key to something invalid
3. Mention bot with a query
4. **Expected:** Bot responds but notes TrackPod failed (degraded status)

### Test with Network Timeout
```sql
-- Set very low timeout for testing
UPDATE "IntegrationConfig"
SET "configEnc" = /* update encrypted config with timeoutMs: 1 */
WHERE type = 'TRACKPOD';
```

### Test with No Results
```
@Bot Tell me about order NONEXISTENT999
```

**Expected:** Bot responds indicating no matching orders/routes found

## Step 8: Verify Integration Data Quality

### Check TrackPod Response Format
The bot should show:
- ✅ Order number
- ✅ Order status
- ✅ Route code
- ✅ Customer name
- ✅ Address (if available)

### Check WooCommerce Response Format
The bot should show:
- ✅ Order ID
- ✅ Customer name
- ✅ Order status
- ✅ Order total
- ✅ Email (if relevant)

### Check Slack Search Results
The bot should show:
- ✅ Channel name
- ✅ Message preview
- ✅ Timestamp
- ✅ Permalink to original message

## Troubleshooting

### Bot Doesn't Respond

**Check 1: Event Subscriptions**
- Verify Slack Event Subscriptions URL is verified
- Check `app_mention` is subscribed
- Verify bot has `chat:write` and `app_mentions:read` scopes

**Check 2: Worker Running**
```bash
# Restart worker
pnpm --filter worker dev
```

**Check 3: Redis Connection**
```bash
# Test Redis
redis-cli ping
# Should respond: PONG
```

**Check 4: Database Connection**
```bash
# Test database
pnpm --filter @company-intel/db prisma studio
```

### Bot Responds with Error

**Check Error Logs**
```sql
SELECT 
  source,
  message,
  stack,
  "createdAt"
FROM "ErrorLog"
ORDER BY "createdAt" DESC
LIMIT 10;
```

### Integration Returns No Results

**Verify Configuration:**
1. Check integration is enabled in dashboard
2. Verify API credentials are correct
3. Test integration endpoint directly with curl
4. Check integration API documentation for correct query format

### LLM Not Responding

**Check Environment Variables:**
```bash
# Verify LLM configuration
echo $LLM_PROVIDER  # should be: openai, anthropic, or gemini
echo $OPENAI_API_KEY  # if using OpenAI
```

## Performance Benchmarks

Expected response times:

- **Simple query (no results):** 2-5 seconds
- **Single integration with results:** 3-8 seconds  
- **Multiple integrations with results:** 5-12 seconds
- **Complex query with LLM reasoning:** 8-15 seconds

If responses take longer:
- Check network latency to external APIs
- Verify database query performance
- Review worker resource allocation
- Check Redis performance

## Next Steps

Once basic testing is complete:

1. **Load Testing:** Test with multiple concurrent queries
2. **Webhook Testing:** Configure TrackPod/WooCommerce webhooks for real-time updates
3. **Advanced Queries:** Test complex multi-step reasoning queries
4. **Custom Integrations:** Add more integrations as needed
5. **Monitoring:** Set up alerts for failed runs or high error rates

## Success Criteria

Your integration is working correctly if:

- ✅ Bot responds to mentions within 15 seconds
- ✅ All enabled integrations are queried
- ✅ Results from multiple sources are combined intelligently
- ✅ Bot maintains conversation context across messages
- ✅ Errors are handled gracefully with helpful messages
- ✅ Database records show COMPLETED or DEGRADED status (not FAILED)
- ✅ Thread memory persists across conversations

## Example Successful Query

```
User: @Bot What can you tell me about order ABC123?

Bot: I found information about ABC123 from multiple sources:

**TrackPod (Delivery):**
- Order #ABC123
- Status: In Transit
- Route: RT-2024-02-26
- Driver: John Smith
- Delivery Address: 123 Main St

**WooCommerce (E-commerce):**
- Order #ABC123
- Customer: Jane Doe (jane@example.com)
- Status: Processing
- Total: $129.99
- Placed: 2024-02-25

**Slack (Communications):**
- Found 2 recent mentions in #orders channel
- Latest: Customer inquired about delivery time (2 hours ago)

The order is currently out for delivery with John Smith and should arrive today. 
Customer was asking about timing - you may want to follow up with an ETA.
```

---

**Need Help?** Check the logs first, then review the integration configuration in the dashboard.
