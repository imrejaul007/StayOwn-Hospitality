# ============================================================
# Verify Service — Product Verification API
# ============================================================
# Production: docker build -t verify-service . && docker run -p 3001:3000 verify-service
# Dev:        docker compose up verify-service
# ============================================================

# ── Builder Stage ────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# ── Production Stage ────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache curl tini

RUN addgroup -g 1001 -S nodejs && \
    adduser -S verify -u 1001

# Copy built application
COPY --from=builder --chown=verify:nodejs /app/dist ./dist
COPY --from=builder --chown=verify:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=verify:nodejs /app/package.json ./package.json
COPY --from=builder --chown=verify:nodejs /app/prisma ./prisma

USER verify
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:3000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
