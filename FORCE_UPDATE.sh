#!/bin/bash
# Force update script for production server

set -e  # Exit on error

echo "======================================"
echo "Force Update & Fix Worker"
echo "======================================"
echo ""

cd /home/ubuntu/cslai

# Check current commit
echo "Current commit:"
git log -1 --oneline
echo ""

# Force fetch and reset
echo "Force fetching latest from GitHub..."
git fetch origin main
git reset --hard origin/main
echo ""

# Show new commit
echo "New commit:"
git log -1 --oneline
echo ""

# Clean node_modules in worker
echo "Cleaning worker node_modules..."
rm -rf apps/worker/node_modules
rm -rf node_modules/.pnpm/*tsx*
echo ""

# Reinstall everything
echo "Installing dependencies..."
pnpm install --force
echo ""

# Verify tsx is installed
echo "Checking for tsx..."
if [ -f "node_modules/.bin/tsx" ]; then
    echo "✅ tsx found in node_modules/.bin/"
    ./node_modules/.bin/tsx --version
else
    echo "❌ tsx NOT found!"
    echo "Checking what's in worker dependencies:"
    cat apps/worker/package.json | grep -A 10 "dependencies"
fi
echo ""

# Check if tsx is in apps/worker/node_modules
echo "Checking apps/worker/node_modules/.pnpm..."
ls -la apps/worker/node_modules/.pnpm/ | grep tsx || echo "tsx not found in worker pnpm store"
echo ""

# Reload PM2 configuration
echo "Reloading PM2 configuration..."
pm2 delete worker || true
pm2 start ecosystem.config.js --only worker
echo ""

# Show logs
echo "Showing worker logs..."
sleep 3
pm2 logs worker --lines 50 --nostream
echo ""

echo "======================================"
echo "Done! Check logs above for status"
echo "======================================"
