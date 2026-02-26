# Fix: Build Error - "Unexpected token 'export'"

## Problem
The worker is crashing because it's trying to import TypeScript files instead of compiled JavaScript. The shared packages (`@company-intel/db` and `@company-intel/shared`) need to be built before the worker.

## Solution - Run on Production Server

```bash
# SSH into server
ssh ubuntu@ip-172-31-17-236

# Navigate to project
cd /home/ubuntu/cslai

# Build everything in the correct order (this builds all packages)
pnpm build

# Restart all services
pm2 restart all

# Check worker logs
pm2 logs worker --lines 20
```

## What This Does

`pnpm build` will:
1. Build `packages/db` → compiles TypeScript to JavaScript
2. Build `packages/shared` → compiles TypeScript to JavaScript  
3. Build `apps/worker` → compiles TypeScript and can now import compiled packages
4. Build `apps/api` → compiles TypeScript
5. Build `apps/web` → compiles Next.js app

## Verify It's Working

After running the commands, you should see:

```bash
pm2 logs worker --lines 10
```

**Good output:**
```
🚀 Company Intel Worker started
    queue: "enrichment"
    concurrency: 5
Redis connected
```

**No more errors about "Unexpected token 'export'"**

## If It Still Doesn't Work

### Option 1: Clean Build
```bash
cd /home/ubuntu/cslai

# Clean everything
rm -rf node_modules apps/*/dist packages/*/dist apps/web/.next

# Reinstall and rebuild
pnpm install
pnpm build

# Restart
pm2 restart all
```

### Option 2: Check Node Version
```bash
node --version
# Should be v20.20.0 (which you have)
```

### Option 3: Manually Build Packages
```bash
cd /home/ubuntu/cslai

# Build packages in order
pnpm --filter @company-intel/db build
pnpm --filter @company-intel/shared build
pnpm --filter worker build
pnpm --filter api build

# Restart
pm2 restart all
```

## Test After Fix

Once the worker starts without errors, test in Slack:

```
@YourBotName tell me about order 12345
```

The bot should respond within 5-15 seconds.

## Why This Happened

The worker's TypeScript configuration imports from the source `packages/db/src/index.ts` during development, but in production it needs the compiled JavaScript from `packages/db/dist/index.js`. Running `pnpm build` ensures all packages are compiled before being used.
