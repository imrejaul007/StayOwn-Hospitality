# ===========================================
# Hotel OTA API — Multi-stage Dockerfile
# ===========================================
# Production: docker build -t hotel-ota-api . && docker run -p 3000:3000 hotel-ota-api
# Dev:        docker compose up api
# ===========================================

# ── Builder Stage ──────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (include devDeps for prisma generate)
COPY package*.json ./
RUN npm ci

# Copy Prisma schema from packages/database/prisma/ (not local prisma/)
COPY ../../packages/database/prisma/ ./prisma-schema/

# Generate Prisma client using the schema from packages/
RUN npx prisma generate --schema=./prisma-schema/schema.prisma

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Production Stage ───────────────────────
FROM node:20-alpine
WORKDIR /app

# Install tini for signal handling and curl for health checks
RUN apk add --no-cache tini curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy only production dependencies and built output
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/.prisma/ ./node_modules/.prisma/
COPY --from=builder /app/dist/ ./dist/

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 3000

# Health check — Render will poll this to confirm the service is ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:3000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
