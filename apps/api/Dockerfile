# =============================================================================
# Company Intel Bot — API Dockerfile
# Multi-stage build: builder → production
# =============================================================================

# ─── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.json ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN pnpm --filter @company-intel/db exec prisma generate

# Build shared + db + api
RUN pnpm --filter @company-intel/shared build
RUN pnpm --filter @company-intel/db build
RUN pnpm --filter @company-intel/api build

# ─── Stage 2: production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests for prod install
COPY package.json pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install production deps only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma schema (needed at runtime for migrations)
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

# Copy generated Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "apps/api/dist/main"]
