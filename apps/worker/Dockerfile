FROM node:20-alpine AS base
RUN npm install -g pnpm@9
WORKDIR /app

# ─── Install dependencies ─────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile

# ─── Build packages ───────────────────────────────────────────────────────────
FROM deps AS builder
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker
RUN cd packages/db && pnpm exec prisma generate
RUN pnpm --filter @company-intel/db build
RUN pnpm --filter @company-intel/shared build
RUN pnpm --filter @company-intel/worker build

# ─── Production image ─────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/node_modules ./apps/worker/node_modules

WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]
