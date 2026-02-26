# REAL FIX: Module Resolution Issue

## The Problem
The worker's compiled JavaScript is trying to import TypeScript source files instead of compiled JavaScript files. This happens because pnpm workspace resolution is pointing to source files.

## Run These Commands on Your Server

```bash
# SSH to server
ssh ubuntu@ip-172-31-17-236
cd /home/ubuntu/cslai

# Step 1: Check if packages/db is actually built
ls -la packages/db/dist/
# Should see: index.js, index.d.ts, etc.

# Step 2: Check what the worker's compiled code imports
head -30 apps/worker/dist/processors/enrichment.processor.js
# Look for: require('@company-intel/db')

# Step 3: Check node_modules linking
ls -la node_modules/@company-intel/
# Should show symlinks to packages/db and packages/shared
```

## Solution 1: Force Package Rebuild

```bash
cd /home/ubuntu/cslai

# Clean everything
rm -rf node_modules
rm -rf apps/*/dist
rm -rf packages/*/dist
rm -rf apps/web/.next

# Reinstall (this recreates symlinks)
pnpm install

# Generate Prisma client FIRST (critical!)
cd packages/db
pnpm db:generate
cd ../..

# Build packages in order
pnpm --filter @company-intel/db build
pnpm --filter @company-intel/shared build

# Verify packages built
ls -la packages/db/dist/
ls -la packages/shared/dist/

# Build worker
pnpm --filter worker build

# Verify worker references compiled packages
grep -A 5 '@company-intel/db' apps/worker/dist/processors/enrichment.processor.js

# Restart
pm2 restart worker
pm2 logs worker --lines 30
```

## Solution 2: Check Package Exports

If Solution 1 doesn't work, the issue might be in how packages export their modules.

On your LOCAL machine, let's add explicit exports to packages/db/package.json:

```json
{
  "name": "@company-intel/db",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  ...
}
```

Do the same for packages/shared/package.json, then push and pull on server.

## Solution 3: Alternative - Use tsx in Production

If the module resolution continues to be problematic, you can run the worker with `tsx` in production instead of compiled JavaScript:

**On server, edit /home/ubuntu/cslai/ecosystem.config.js:**

Change worker config from:
```javascript
{
  name: 'worker',
  cwd: '/home/ubuntu/cslai',
  script: 'node',
  args: 'apps/worker/dist/main.js',  // OLD - problematic
  ...
}
```

To:
```javascript
{
  name: 'worker',
  cwd: '/home/ubuntu/cslai',
  script: 'npx',
  args: 'tsx apps/worker/src/main.ts',  // NEW - runs TypeScript directly
  ...
}
```

Then:
```bash
pm2 restart worker
pm2 logs worker
```

## Diagnostic Commands

Run these to understand what's happening:

```bash
cd /home/ubuntu/cslai

# Check if @company-intel/db resolves correctly
node -e "console.log(require.resolve('@company-intel/db'))"
# Should output: /home/ubuntu/cslai/packages/db/dist/index.js

# If it outputs src/index.ts, the symlink is wrong

# Check the actual symlink
readlink node_modules/@company-intel/db
# Should point to: ../../packages/db

# Check what's in that directory
ls -la packages/db/
# Should have both 'src' and 'dist' directories
```

## What's Actually Wrong

The issue is that when pnpm creates workspace symlinks, Node's module resolution is picking up the TypeScript source files instead of the compiled dist files. This happens when:

1. The `dist` folder doesn't exist or is incomplete
2. The package.json `main` field is ignored
3. Node's module resolution algorithm finds `.ts` files before `.js` files

## Quick Test

After any fix attempt, test with:

```bash
cd /home/ubuntu/cslai
node -e "const db = require('@company-intel/db'); console.log('Success!', Object.keys(db));"
```

If this works without errors, the worker should work too.
