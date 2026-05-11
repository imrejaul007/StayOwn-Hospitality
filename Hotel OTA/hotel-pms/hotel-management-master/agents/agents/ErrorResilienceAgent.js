import { BaseAgent } from '../core/BaseAgent.js';

/**
 * ErrorResilienceAgent - Checks system resilience, graceful degradation, and recovery mechanisms.
 *
 * PM question: "What happens when Redis is down? When Stripe is unreachable? When MongoDB is slow?"
 * A resilient system degrades gracefully. A fragile system crashes entirely.
 */
export class ErrorResilienceAgent extends BaseAgent {
  constructor() {
    super('ErrorResilienceAgent', 'Checks graceful degradation, circuit breakers, retry logic, fallbacks, and recovery mechanisms');
  }

  async analyze(state, config) {
    const { scanner } = config;
    const allFiles = [
      ...(state.context.files.controllers || []),
      ...(state.context.files.services || []),
      ...(state.context.files.config || []),
      ...(state.context.files.jobs || []),
    ];

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      this._checkRedisFailover(state, content, file);
      this._checkExternalAPIDegradation(state, content, file);
      this._checkDatabaseResilience(state, content, file);
      this._checkQueueResilience(state, content, file);
      this._checkEmailFailover(state, content, file);
      this._checkGracefulShutdown(state, content, file);
      this._checkCircuitBreaker(state, content, file);
      this._checkRetryLogic(state, content, file);
      this._checkTimeouts(state, content, file);
      this._checkHealthCheck(state, content, file);
    }

    return {
      summary: `Resilience analysis complete across ${allFiles.length} files.`,
      filesAnalyzed: allFiles.length,
    };
  }

  _checkRedisFailover(state, content, file) {
    if (!/redis|cache|Cache/i.test(content)) return;

    // Redis operations without fallback
    const redisOps = /(?:redis|cache)\.(?:get|set|del|hget|hset)\s*\(/g;
    if (redisOps.test(content)) {
      const hasFallback = /catch|fallback|default|null.*\?\?|try[\s\S]*?catch[\s\S]*?(?:null|undefined|false|continue)/i.test(content);

      if (!hasFallback) {
        this.addFinding(state, {
          severity: 'high',
          category: 'resilience',
          title: `Redis operation without fallback in ${file.name}`,
          description: `${file.relativePath} calls Redis without a fallback. When Redis is down (which happens), the entire request fails. Cache misses should fall through to the database, not crash the request.`,
          file: file.relativePath,
          suggestion: 'Wrap Redis calls in try/catch. On failure, fall through to DB: try { cached = await redis.get(key); } catch { /* fall through */ } if (!cached) { result = await Model.find(); }',
          fixable: true,
        });
      }
    }
  }

  _checkExternalAPIDegradation(state, content, file) {
    // External API calls (Stripe, OTA, email) without degradation strategy
    const externalAPIs = [
      { pattern: /stripe\.\w+\.\w+\s*\(/g, name: 'Stripe', impact: 'Payments fail entirely' },
      { pattern: /(?:axios|fetch|http\.request|got)\s*\([^)]*(?:booking\.com|bookingcom|ota)/gi, name: 'OTA/Booking.com', impact: 'Channel sync breaks' },
      { pattern: /cloudinary\.\w+\.\w+\s*\(/gi, name: 'Cloudinary', impact: 'Image uploads fail' },
      { pattern: /transporter\.sendMail\s*\(/gi, name: 'Email (SMTP)', impact: 'Notifications silently lost' },
    ];

    for (const { pattern, name, impact } of externalAPIs) {
      if (pattern.test(content)) {
        const hasCircuitBreaker = /circuitBreaker|circuit.?break|bulkhead|fallback|retry.*limit|maxRetries/i.test(content);
        const hasTimeout = /timeout|Timeout|TIMEOUT|AbortController/i.test(content);

        if (!hasCircuitBreaker && !hasTimeout) {
          this.addFinding(state, {
            severity: 'medium',
            category: 'resilience',
            title: `No degradation strategy for ${name} in ${file.name}`,
            description: `${file.relativePath} calls ${name} without timeout, retry limit, or circuit breaker. If ${name} is slow or down: ${impact}. Without a timeout, requests hang indefinitely, exhausting the connection pool.`,
            file: file.relativePath,
            suggestion: `Add: (1) Timeout: AbortController with 30s limit. (2) Retry with exponential backoff (max 3). (3) Circuit breaker: after 5 failures, skip for 30s. (4) Fallback: queue for later processing.`,
            fixable: true,
          });
          break;
        }
      }
    }
  }

  _checkDatabaseResilience(state, content, file) {
    if (!file.relativePath.includes('config') && !file.name.includes('database')) return;

    // MongoDB connection without reconnection strategy
    if (/mongoose\.connect|MongoClient/i.test(content)) {
      const hasReconnect = /reconnect|retry|serverSelectionTimeout|heartbeat|autoReconnect|maxPoolSize/i.test(content);

      if (!hasReconnect) {
        this.addFinding(state, {
          severity: 'high',
          category: 'resilience',
          title: 'Database connection without reconnection strategy',
          description: `${file.relativePath} connects to MongoDB without explicit reconnection configuration. If the database restarts or network blips, the app may not reconnect automatically, requiring a manual restart.`,
          file: file.relativePath,
          suggestion: 'Configure: { serverSelectionTimeoutMS: 5000, heartbeatFrequencyMS: 10000, retryWrites: true, maxPoolSize: 20 }. Handle "disconnected" and "error" events.',
          fixable: true,
        });
      }
    }
  }

  _checkQueueResilience(state, content, file) {
    if (!/Bull\(|new Queue\(|\.add\(\s*['"]\w+|\.process\(\s*['"]\w+/i.test(content)) return;

    // Job queue without dead letter handling
    const hasDeadLetter = /deadLetter|failed|onFailed|maxRetries|backoff|attempts/i.test(content);
    if (!hasDeadLetter) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'resilience',
        title: `Job queue without failure handling in ${file.name}`,
        description: `${file.relativePath} uses a job queue without dead letter/failure handling. Failed jobs are silently lost. For critical operations (payment processing, OTA sync, email notifications), lost jobs mean lost business.`,
        file: file.relativePath,
        suggestion: 'Configure: { attempts: 3, backoff: { type: "exponential", delay: 5000 } }. Add queue.on("failed") handler to alert and store failed jobs.',
        fixable: true,
      });
    }
  }

  _checkEmailFailover(state, content, file) {
    if (!/email|mail|smtp|nodemailer/i.test(content)) return;

    // Email sending without queue/retry
    const directSend = /transporter\.sendMail|sendMail\s*\(/g;
    if (directSend.test(content)) {
      const isQueued = /queue|bull|job|addJob|schedule/i.test(content);

      if (!isQueued) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'resilience',
          title: `Email sent synchronously without queue in ${file.name}`,
          description: `${file.relativePath} sends emails synchronously in the request path. If the SMTP server is slow/down: (1) the API response is delayed, (2) the email is lost on failure. Critical emails (booking confirmations, payment receipts) must be reliable.`,
          file: file.relativePath,
          suggestion: 'Queue emails through Bull/Redis queue. Process asynchronously with retry logic. Store email status for monitoring.',
          fixable: true,
        });
      }
    }
  }

  _checkGracefulShutdown(state, content, file) {
    if (!file.name.includes('server') && !file.name.includes('app')) return;

    // Check for graceful shutdown handling
    const hasGracefulShutdown = /SIGTERM|SIGINT|graceful|shutdown|process\.on.*signal/i.test(content);

    if (content.includes('listen') && !hasGracefulShutdown) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'resilience',
        title: 'Server lacks graceful shutdown handling',
        description: `${file.relativePath} starts a server without handling SIGTERM/SIGINT. On deployment or restart, active requests are killed mid-flight — including payment processing, booking creation, and file uploads. Data corruption follows.`,
        file: file.relativePath,
        suggestion: 'Handle SIGTERM: close new connections, finish active requests, close DB/Redis connections, then exit. Set a timeout (30s) for forced shutdown.',
        fixable: true,
      });
    }
  }

  _checkCircuitBreaker(state, content, file) {
    // Any file making external calls should consider circuit breaking
    const makesExternalCalls = /axios\.\w+|fetch\s*\(|http\.request|stripe\.\w+/g;
    if (!makesExternalCalls.test(content)) return;

    const hasCircuitBreaker = /circuitBreaker|circuit.?break|opossum|brakes|cockatiel/i.test(content);
    if (!hasCircuitBreaker && content.length > 1000) {
      // Only flag for service files, not every file
      if (file.relativePath.includes('service') && /connector|integration|sync|external|ota|channel/i.test(file.name)) {
        this.addFinding(state, {
          severity: 'low',
          category: 'resilience',
          title: `External integration without circuit breaker: ${file.name}`,
          description: `${file.relativePath} makes external API calls without a circuit breaker. When the external service is down, every request will wait for timeout, creating a cascading failure that brings down your entire system.`,
          file: file.relativePath,
          suggestion: 'Implement a circuit breaker: after N consecutive failures, "open" the circuit (return cached/default value immediately). Reset after a cool-down period.',
          fixable: false,
        });
      }
    }
  }

  _checkRetryLogic(state, content, file) {
    if (/circuitBreaker|CircuitBreaker|withTransaction/.test(content)) return;

    // Critical operations without retry
    const criticalOps = /\.save\(\)|\.create\(\)|\.updateOne|paymentIntent|sendMail|webhook/gi;
    if (criticalOps.test(content)) {
      const hasRetry = /retry|retries|maxAttempts|backoff|exponential/i.test(content);
      if (!hasRetry && /service/i.test(file.name)) {
        // Don't flag every file — only services that handle critical ops
        const isCritical = /payment|booking|settlement|checkout|refund/i.test(file.name);
        if (isCritical) {
          this.addFinding(state, {
            severity: 'medium',
            category: 'resilience',
            title: `Critical service without retry logic: ${file.name}`,
            description: `${file.relativePath} handles critical operations without retry logic. Transient failures (network blip, temporary DB lock) cause permanent failure instead of recovering.`,
            file: file.relativePath,
            suggestion: 'Add retry with exponential backoff for transient failures: retry 3 times with 1s, 2s, 4s delays. Only retry idempotent operations.',
            fixable: true,
          });
        }
      }
    }
  }

  _checkTimeouts(state, content, file) {
    // HTTP requests without timeout
    if (/axios\.\w+\s*\(|fetch\s*\(/g.test(content)) {
      const hasTimeout = /timeout|Timeout|AbortController|signal/i.test(content);
      if (!hasTimeout && /service/i.test(file.name)) {
        this.addFinding(state, {
          severity: 'low',
          category: 'resilience',
          title: `HTTP requests without timeout in ${file.name}`,
          description: `${file.relativePath} makes HTTP requests without explicit timeouts. A hung external service will keep the connection open indefinitely, eventually exhausting the Node.js connection pool.`,
          file: file.relativePath,
          suggestion: 'Set timeout on all HTTP clients: axios.get(url, { timeout: 30000 }) or use AbortController for fetch.',
          fixable: true,
        });
      }
    }
  }

  _checkHealthCheck(state, content, file) {
    if (!file.name.includes('health')) return;

    // Health check should verify all dependencies
    const checks = {
      database: /mongoose|mongodb|database|db/i.test(content),
      redis: /redis|cache/i.test(content),
      stripe: /stripe|payment/i.test(content),
      email: /smtp|email|mail/i.test(content),
    };

    const missing = Object.entries(checks).filter(([, has]) => !has).map(([name]) => name);
    if (missing.length > 1) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'resilience',
        title: `Health check doesn't verify all dependencies: missing ${missing.join(', ')}`,
        description: `${file.relativePath} health check doesn't verify: ${missing.join(', ')}. An "OK" health check while Redis is down gives false confidence. Load balancers route traffic to unhealthy instances.`,
        file: file.relativePath,
        suggestion: 'Health check should verify ALL dependencies: DB connection, Redis ping, Stripe reachability. Return detailed status: { db: "ok", redis: "ok", stripe: "degraded" }.',
        fixable: true,
      });
    }
  }
}
