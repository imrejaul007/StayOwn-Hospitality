import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const bookingTotal = new client.Counter({
  name: 'habixo_bookings_total',
  help: 'Total number of bookings',
  labelNames: ['status'],
  registers: [register],
});

export const propertyCount = new client.Gauge({
  name: 'habixo_properties_total',
  help: 'Total number of properties',
  registers: [register],
});

export const activeConnections = new client.Gauge({
  name: 'habixo_active_connections',
  help: 'Number of active connections',
  registers: [register],
});

export { register };
