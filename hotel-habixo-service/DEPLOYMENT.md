# Habixo Service Deployment Guide

**Version:** 1.0.0
**Date:** May 7, 2026
**Status:** Production Ready

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Environment Variables](#environment-variables)
3. [Docker Deployment](#docker-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Render Deployment](#render-deployment)
6. [Health Check Endpoints](#health-check-endpoints)
7. [Monitoring Setup](#monitoring-setup)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (optional)
- Kubernetes cluster (optional)
- MongoDB 6.0+
- Redis 7.0+

### Local Development

```bash
# Clone the repository
git clone https://github.com/imrejaul007/rez-habixo-service.git
cd rez-habixo-service

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Run development server
npm run dev

# Server runs on http://localhost:3007
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3007` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/habixo` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | JWT signing secret | `your-jwt-secret` |
| `INTERNAL_SERVICE_TOKEN` | Internal API token | `your-internal-token` |

### ReZ Service URLs

| Variable | Description | Default |
|----------|-------------|---------|
| `REZ_AUTH_SERVICE_URL` | ReZ Auth service URL | `http://localhost:4002` |
| `REZ_WALLET_SERVICE_URL` | ReZ Wallet service URL | `http://localhost:4004` |
| `REZ_KARMA_SERVICE_URL` | ReZ Karma service URL | `http://localhost:4011` |
| `REZ_INTENT_GRAPH_URL` | ReZ Intent Graph URL | `http://localhost:3001` |
| `REZ_NOTIFICATIONS_URL` | ReZ Notifications URL | `http://localhost:4006` |
| `REZ_GAMIFICATION_URL` | ReZ Gamification URL | `http://localhost:4008` |
| `REZ_PROFILE_SERVICE_URL` | ReZ Profile service URL | `http://localhost:4003` |
| `REZ_PAYMENT_SERVICE_URL` | ReZ Payment service URL | `http://localhost:4005` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `info` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `CORS_ORIGINS` | Allowed CORS origins | `*` |
| `METRICS_PORT` | Prometheus metrics port | `9090` |

### Example .env File

```env
# Environment
NODE_ENV=production
PORT=3007

# Database
MONGODB_URI=mongodb://mongo:27017/habixo
REDIS_HOST=redis
REDIS_PORT=6379

# Security
JWT_SECRET=your-secure-jwt-secret-here
INTERNAL_SERVICE_TOKEN=your-internal-service-token-here

# ReZ Services
REZ_AUTH_SERVICE_URL=http://rez-auth-service:4002
REZ_WALLET_SERVICE_URL=http://rez-wallet-service:4004
REZ_KARMA_SERVICE_URL=http://rez-karma-service:4011
REZ_INTENT_GRAPH_URL=http://rez-intent-graph:3001
REZ_NOTIFICATIONS_URL=http://rez-notifications-hub:4006
REZ_GAMIFICATION_URL=http://rez-gamification-service:4008
REZ_PROFILE_SERVICE_URL=http://rez-profile-service:4003
REZ_PAYMENT_SERVICE_URL=http://rez-payment-service:4005

# Logging
LOG_LEVEL=info

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

---

## Docker Deployment

### Dockerfile

The service includes a production-ready Dockerfile:

```dockerfile
# habixo-service/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3007

CMD ["node", "dist/index.js"]
```

### Docker Compose

Create `docker-compose.yml` for local development:

```yaml
version: '3.8'

services:
  habixo:
    build: .
    ports:
      - "3007:3007"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/habixo
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - mongo
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3007/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  mongo_data:
  redis_data:
```

### Build and Run

```bash
# Build the Docker image
docker build -t habixo-service:latest .

# Run with docker-compose
docker-compose up -d

# Or run directly
docker run -d \
  --name habixo-service \
  -p 3007:3007 \
  -e MONGODB_URI=mongodb://host:27017/habixo \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  habixo-service:latest
```

### Docker Hub / GHCR Deployment

```bash
# Build and tag for GHCR
docker build -t ghcr.io/imrejaul007/rez-habixo-service:latest .

# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u imrejaul007 --password-stdin

# Push to GHCR
docker push ghcr.io/imrejaul007/rez-habixo-service:latest
```

---

## Kubernetes Deployment

### Deployment Manifest

Save as `k8s/habixo-service.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: habixo-service
  namespace: rez
  labels:
    app: habixo
    tier: backend
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: habixo
  template:
    metadata:
      labels:
        app: habixo
        tier: backend
        version: v1
    spec:
      containers:
        - name: habixo
          image: ghcr.io/imrejaul007/rez-habixo-service:latest
          ports:
            - name: http
              containerPort: 3007
              protocol: TCP
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3007"
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: rez-secrets
                  key: MONGODB_URI
            - name: REDIS_HOST
              value: "redis.rez.svc.cluster.local"
            - name: REDIS_PORT
              value: "6379"
            - name: INTERNAL_SERVICE_TOKEN
              valueFrom:
                secretKeyRef:
                  name: rez-secrets
                  key: HABIXO_INTERNAL_TOKEN
            - name: REZ_AUTH_SERVICE_URL
              value: "http://rez-auth-service.rez.svc.cluster.local:4002"
            - name: REZ_WALLET_SERVICE_URL
              value: "http://rez-wallet-service.rez.svc.cluster.local:4004"
            - name: REZ_KARMA_SERVICE_URL
              value: "http://rez-karma-service.rez.svc.cluster.local:4011"
            - name: REZ_INTENT_GRAPH_URL
              value: "http://rez-intent-graph.rez.svc.cluster.local:3001"
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health/live
              port: http
            initialDelaySeconds: 10
            periodSeconds: 15
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 3
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 10"]
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - habixo
                topologyKey: kubernetes.io/hostname
---
apiVersion: v1
kind: Service
metadata:
  name: habixo-service
  namespace: rez
  labels:
    app: habixo
spec:
  type: ClusterIP
  ports:
    - name: http
      port: 3007
      targetPort: http
      protocol: TCP
  selector:
    app: habixo
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: habixo-service
  namespace: rez
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: habixo-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: habixo-service
  namespace: rez
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - habixo-api.rez.money
      secretName: habixo-tls
  rules:
    - host: habixo-api.rez.money
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: habixo-service
                port:
                  name: http
```

### Deploy to Kubernetes

```bash
# Create namespace (if not exists)
kubectl create namespace rez

# Apply deployment
kubectl apply -f k8s/habixo-service.yaml

# Check deployment status
kubectl get pods -n rez -l app=habixo

# View logs
kubectl logs -n rez -l app=habixo -f

# Scale deployment
kubectl scale deployment habixo-service -n rez --replicas=5

# Restart deployment
kubectl rollout restart deployment habixo-service -n rez

# Check rollout status
kubectl rollout status deployment habixo-service -n rez
```

---

## Render Deployment

### render.yaml

Create `render.yaml` in the project root:

```yaml
services:
  - type: web
    name: habixo-service
    env: node
    region: singapore
    plan: starter
    buildCommand: npm install && npm run build
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3007
      - key: MONGODB_URI
        sync: false
      - key: REDIS_HOST
        sync: false
      - key: REDIS_PORT
        value: 6379
      - key: JWT_SECRET
        sync: false
      - key: INTERNAL_SERVICE_TOKEN
        sync: false
      - key: REZ_AUTH_SERVICE_URL
        value: https://rez-auth-service.onrender.com
      - key: REZ_WALLET_SERVICE_URL
        value: https://rez-wallet-service.onrender.com
      - key: REZ_KARMA_SERVICE_URL
        value: https://rez-karma-service.onrender.com
      - key: REZ_INTENT_GRAPH_URL
        value: https://rez-intent-graph.onrender.com
      - key: REZ_NOTIFICATIONS_URL
        value: https://rez-notifications-hub.onrender.com
      - key: REZ_GAMIFICATION_URL
        value: https://rez-gamification-service.onrender.com
      - key: REZ_PROFILE_SERVICE_URL
        value: https://rez-profile-service.onrender.com
      - key: REZ_PAYMENT_SERVICE_URL
        value: https://rez-payment-service.onrender.com
```

### Deploy to Render

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Deploy
render deploy

# Or use GitHub integration (recommended)
# Connect repository in Render dashboard
# Set environment variables in dashboard
# Enable auto-deploy on push
```

---

## Health Check Endpoints

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Basic health check |
| `/health/live` | GET | Liveness probe |
| `/health/ready` | GET | Readiness probe |
| `/metrics` | GET | Prometheus metrics |

### Health Check Response

```json
// GET /health
{
  "status": "ok",
  "timestamp": "2026-05-07T12:00:00.000Z",
  "uptime": 12345,
  "version": "1.0.0"
}

// GET /health/live
{
  "status": "ok",
  "timestamp": "2026-05-07T12:00:00.000Z"
}

// GET /health/ready
{
  "status": "ok",
  "timestamp": "2026-05-07T12:00:00.000Z",
  "checks": {
    "mongodb": "connected",
    "redis": "connected",
    "rezAuth": "connected",
    "rezWallet": "connected",
    "rezKarma": "connected"
  }
}
```

### Kubernetes Health Check Configuration

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3007
  initialDelaySeconds: 10
  periodSeconds: 15
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3007
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 3
```

---

## Monitoring Setup

### Prometheus Metrics

The service exposes Prometheus metrics at `/metrics`:

```typescript
// Example metrics available
// - http_requests_total (counter)
// - http_request_duration_seconds (histogram)
// - habixo_bookings_total (counter)
// - habixo_properties_total (gauge)
// - habixo_matching_score (histogram)
// - mongodb_connection_pool_size (gauge)
// - redis_connection_status (gauge)
```

### Prometheus Configuration

Add to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'habixo-service'
    static_configs:
      - targets: ['habixo-service:3007']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Grafana Dashboard

Import the following metrics for monitoring:

| Panel | Query |
|-------|-------|
| Request Rate | `rate(http_requests_total{service="habixo"}[5m])` |
| Error Rate | `rate(http_requests_total{service="habixo",status=~"5.."}[5m])` |
| Latency P99 | `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="habixo"}[5m]))` |
| Booking Rate | `rate(habixo_bookings_total[5m])` |
| Active Properties | `habixo_properties_total{status="active"}` |

### Alerting Rules

```yaml
groups:
  - name: habixo-alerts
    rules:
      - alert: HabixoServiceDown
        expr: up{job="habixo-service"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Habixo service is down"

      - alert: HabixoHighErrorRate
        expr: rate(http_requests_total{service="habixo",status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Habixo error rate is above 5%"

      - alert: HabixoHighLatency
        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="habixo"}[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Habixo P99 latency is above 2s"
```

### Logging

The service uses structured JSON logging:

```json
{
  "level": "info",
  "message": "Booking created",
  "timestamp": "2026-05-07T12:00:00.000Z",
  "service": "habixo",
  "bookingId": "HBK-12345678",
  "userId": "user-123",
  "propertyId": "HAB-12345678",
  "duration_ms": 45
}
```

### Distributed Tracing

The service supports OpenTelemetry tracing:

```yaml
# Environment variables for tracing
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_SERVICE_NAME=habixo-service
OTEL_TRACES_SAMPLER_ARG=0.1
```

---

## Troubleshooting

### Common Issues

#### 1. Service Not Starting

```bash
# Check logs
kubectl logs -n rez deployment/habixo-service

# Common causes:
# - Missing environment variables
# - MongoDB connection failure
# - Redis connection failure
```

#### 2. High Memory Usage

```bash
# Check resource usage
kubectl top pods -n rez -l app=habixo

# Increase memory limits if needed
kubectl patch deployment habixo-service -n rez -p '{"spec":{"template":{"spec":{"containers":[{"name":"habixo","resources":{"limits":{"memory":"1Gi"}}}]}}}}'
```

#### 3. Slow Response Times

```bash
# Check MongoDB performance
kubectl exec -n rez deployment/habixo-service -- mongosh --eval "db.adminCommand('top')"

# Check Redis
kubectl exec -n rez deployment/habixo-service -- redis-cli info stats

# Review slow query logs
kubectl logs -n rez deployment/habixo-service | grep "slow"
```

#### 4. Connection Refused to ReZ Services

```bash
# Check service endpoints
kubectl get svc -n rez

# Test connectivity
kubectl exec -n rez deployment/habixo-service -- curl -v http://rez-auth-service:4002/health

# Check DNS resolution
kubectl exec -n rez deployment/habixo-service -- nslookup rez-auth-service.rez.svc.cluster.local
```

### Debug Mode

Enable debug logging:

```bash
# Set LOG_LEVEL to debug
kubectl set env deployment habixo-service -n rez LOG_LEVEL=debug

# View verbose logs
kubectl logs -n rez -l app=habixo -f --tail=100
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/habixo-service -n rez

# Rollback to specific revision
kubectl rollout undo deployment/habixo-service -n rez --to-revision=2

# Check rollout history
kubectl rollout history deployment/habixo-service -n rez
```

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/imrejaul007/rez-habixo-service/issues
- Documentation: https://docs.rez.money/habixo
- Status Page: https://status.rez.money
