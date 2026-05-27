# Habixo Service Dockerfile
# Smart Living OS powered by ReZ

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Rebuild native dependencies
FROM base AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 habixo

# Set environment
ENV NODE_ENV=production
ENV PORT=3007

# Copy built application
COPY --from=builder --chown=habixo:nodejs /app/dist ./dist
COPY --from=builder --chown=habixo:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=habixo:nodejs /app/package.json ./package.json

# Switch to non-root user
USER habixo

# Expose port
EXPOSE 3007

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3007/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
