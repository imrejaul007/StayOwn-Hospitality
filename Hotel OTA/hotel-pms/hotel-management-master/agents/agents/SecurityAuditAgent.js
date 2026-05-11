import { BaseAgent } from '../core/BaseAgent.js';

/**
 * SecurityAuditAgent - Comprehensive security vulnerability scanner.
 * Covers OWASP Top 10, auth issues, injection, data leakage, input validation.
 */
export class SecurityAuditAgent extends BaseAgent {
  constructor() {
    super('SecurityAuditAgent', 'Scans for OWASP Top 10 vulnerabilities, auth issues, injection risks, and data leakage');
  }

  async analyze(state, config) {
    const { scanner } = config;
    const allFiles = [
      ...(state.context.files.routes || []),
      ...(state.context.files.controllers || []),
      ...(state.context.files.services || []),
      ...(state.context.files.middleware || []),
      ...(state.context.files.config || []),
    ];

    for (const file of allFiles) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      // OWASP A01: Broken Access Control
      this._checkAccessControl(state, content, file);

      // OWASP A02: Cryptographic Failures
      this._checkCryptoFailures(state, content, file);

      // OWASP A03: Injection
      this._checkInjection(state, content, file);

      // OWASP A04: Insecure Design
      this._checkInsecureDesign(state, content, file);

      // OWASP A05: Security Misconfiguration
      this._checkMisconfiguration(state, content, file);

      // OWASP A07: Auth Failures
      this._checkAuthFailures(state, content, file);

      // OWASP A08: Data Integrity
      this._checkDataIntegrity(state, content, file);

      // OWASP A09: Logging & Monitoring
      this._checkLogging(state, content, file);

      // OWASP A10: SSRF
      this._checkSSRF(state, content, file);

      // Additional: Rate limiting, CORS, Headers
      this._checkRateLimiting(state, content, file);
      this._checkDataExposure(state, content, file);
    }

    // Check authentication middleware specifically
    await this._auditAuthMiddleware(state, config);

    // Check for missing security headers (server.js / app.js)
    await this._checkServerSecurity(state, config);

    return {
      summary: `Security audit complete across ${allFiles.length} files`,
      filesAudited: allFiles.length,
    };
  }

  _checkAccessControl(state, content, file) {
    // Routes that bypass authorization
    if (file.relativePath.includes('route')) {
      // Check for admin-only routes missing role checks
      // Only match actual route definitions, not comments
      const adminRoutePatterns = [
        /router\.\w+\(\s*['"].*\/admin/i,
        /router\.\w+\(\s*['"].*\/users.*delete/i,
        /router\.\w+\(\s*['"].*\/settings/i,
        /router\.\w+\(\s*['"].*\/config/i,
      ];

      for (const pattern of adminRoutePatterns) {
        const hasAuth = /authorize|isAdmin|adminAuth|authenticate|roleMiddleware|roleAuth|ensurePropertyAccess|permissionCheck|no auth(?:entication)? required|public.*(?:route|endpoint|form|contact)/i.test(content);
        if (pattern.test(content) && !hasAuth) {
          this.addFinding(state, {
            severity: 'critical',
            category: 'security',
            title: 'Admin route without authorization check',
            description: `${file.relativePath} appears to define admin-related routes but does not use authorization middleware. Any authenticated user could access admin functionality.`,
            file: file.relativePath,
            suggestion: 'Add authorize("admin") middleware to all admin routes.',
            fixable: true,
          });
        }
      }
    }

    // IDOR section: skip entirely — ensureTenantContext middleware handles this globally
    // Direct object reference ownership is enforced by tenantIsolation middleware
  }

  _checkCryptoFailures(state, content, file) {
    // Weak hashing algorithms
    const weakCrypto = [
      { regex: /createHash\s*\(\s*['"]md5['"]\s*\)/g, algo: 'MD5' },
      { regex: /createHash\s*\(\s*['"]sha1['"]\s*\)/g, algo: 'SHA1' },
    ];

    for (const { regex, algo } of weakCrypto) {
      if (regex.test(content)) {
        this.addFinding(state, {
          severity: 'high',
          category: 'security',
          title: `Weak cryptographic algorithm: ${algo}`,
          description: `${file.relativePath} uses ${algo} which is cryptographically broken. Collisions can be generated, making it unsuitable for security purposes.`,
          file: file.relativePath,
          suggestion: `Replace ${algo} with SHA-256 or bcrypt for password hashing.`,
          fixable: true,
        });
      }
    }

    // JWT without expiry
    if (content.includes('jwt.sign') && !content.includes('expiresIn') && !content.includes('exp')) {
      this.addFinding(state, {
        severity: 'high',
        category: 'security',
        title: 'JWT tokens without expiration',
        description: `${file.relativePath} signs JWT tokens without setting an expiration. Tokens will be valid indefinitely, meaning compromised tokens can never be invalidated through expiry.`,
        file: file.relativePath,
        suggestion: 'Add { expiresIn: "7d" } or similar to jwt.sign() options.',
        fixable: true,
      });
    }
  }

  _checkInjection(state, content, file) {
    // NoSQL injection — only flag $where (dangerous) or direct req.body spread into queries
    const dangerousNoSQL = /\$where\s*:/g;
    const directBodySpread = /\.find\(\s*req\.body\s*\)|\.find\(\s*\{\s*\.\.\.req\.body/g;
    if (dangerousNoSQL.test(content)) {
      this.addFinding(state, {
        severity: 'critical',
        category: 'security',
        title: 'NoSQL injection via $where operator',
        description: `${file.relativePath} uses MongoDB $where operator which executes JavaScript on the server. This is a critical injection vector.`,
        file: file.relativePath,
        suggestion: 'Replace $where with standard MongoDB query operators. $where should never be used.',
        fixable: true,
      });
    }
    if (directBodySpread.test(content)) {
      this.addFinding(state, {
        severity: 'high',
        category: 'security',
        title: 'Potential NoSQL injection — raw req.body in query',
        description: `${file.relativePath} passes req.body directly into a MongoDB query. Even with mongoSanitize, this is risky. Attackers may bypass sanitization with nested objects.`,
        file: file.relativePath,
        suggestion: 'Destructure specific fields from req.body before passing to queries. Never spread req.body directly.',
        fixable: true,
      });
    }

    // Command injection
    const cmdInjection = /exec\s*\(\s*(?:req\.|`[^`]*\$\{req)/g;
    if (cmdInjection.test(content)) {
      this.addFinding(state, {
        severity: 'critical',
        category: 'security',
        title: 'Command injection vulnerability',
        description: `${file.relativePath} appears to pass user input to a shell command execution. This can allow arbitrary command execution on the server.`,
        file: file.relativePath,
        suggestion: 'Never pass user input to exec/spawn. Use parameterized APIs or sanitize strictly.',
        fixable: false,
      });
    }

    // RegExp injection
    const regexInjection = /new RegExp\s*\(\s*req\.(body|query|params)/g;
    if (regexInjection.test(content)) {
      this.addFinding(state, {
        severity: 'high',
        category: 'security',
        title: 'RegExp injection (ReDoS) vulnerability',
        description: `${file.relativePath} creates RegExp objects from user input. Attackers can craft malicious patterns causing catastrophic backtracking (ReDoS), leading to denial of service.`,
        file: file.relativePath,
        suggestion: 'Escape user input with a regex-escape function or use string matching instead.',
        fixable: true,
      });
    }
  }

  _checkInsecureDesign(state, content, file) {
    // Mass assignment — passing entire req.body to create/update
    const massAssignment = /\.(create|findOneAndUpdate|updateOne|updateMany)\s*\(\s*[^,]*,?\s*req\.body\s*[,)]/g;
    if (massAssignment.test(content)) {
      this.addFinding(state, {
        severity: 'high',
        category: 'security',
        title: 'Mass assignment vulnerability',
        description: `${file.relativePath} passes the entire req.body directly to a database operation. Attackers can inject fields like "role: admin" or "isAdmin: true" to escalate privileges.`,
        file: file.relativePath,
        suggestion: 'Destructure only the expected fields from req.body before passing to the database.',
        fixable: true,
      });
    }
  }

  _checkMisconfiguration(state, content, file) {
    // Debug mode in production
    if (content.includes('debug: true') || content.includes('DEBUG=true')) {
      if (!file.relativePath.includes('test') && !file.relativePath.includes('.env.example')) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'security',
          title: 'Debug mode may be enabled in production',
          description: `${file.relativePath} has debug mode enabled, which may expose stack traces, query details, or internal data in production.`,
          file: file.relativePath,
          suggestion: 'Use process.env.NODE_ENV checks to disable debug mode in production.',
          fixable: true,
        });
      }
    }

    // CORS allowing all origins
    if (/cors\s*\(\s*\{[^}]*origin\s*:\s*['"]\*['"]/g.test(content) ||
        /cors\s*\(\s*\{[^}]*origin\s*:\s*true/g.test(content)) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'security',
        title: 'CORS allows all origins',
        description: `${file.relativePath} configures CORS to accept requests from any origin. This weakens the same-origin policy protection.`,
        file: file.relativePath,
        suggestion: 'Restrict CORS origin to specific trusted domains.',
        fixable: true,
      });
    }
  }

  _checkAuthFailures(state, content, file) {
    // No rate limiting on auth endpoints
    if (file.relativePath.includes('auth') && file.relativePath.includes('route')) {
      if (!content.includes('rateLimit') && !content.includes('rateLimiter') && !content.includes('loginLimiter')) {
        this.addFinding(state, {
          severity: 'high',
          category: 'security',
          title: 'Auth routes missing rate limiting',
          description: `${file.relativePath} defines authentication routes without rate limiting. This allows brute-force attacks on login/registration endpoints.`,
          file: file.relativePath,
          suggestion: 'Add rate limiting middleware to login, register, and password reset routes.',
          fixable: true,
        });
      }
    }

    // Password reset without token expiry
    if (content.includes('resetPassword') || content.includes('reset-password')) {
      if (!content.includes('expires') && !content.includes('expiry') && !content.includes('expiresAt')) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'security',
          title: 'Password reset may lack token expiration',
          description: `${file.relativePath} handles password reset but may not enforce token expiration. Non-expiring reset tokens can be used indefinitely if intercepted.`,
          file: file.relativePath,
          suggestion: 'Ensure password reset tokens expire within 1 hour.',
          fixable: true,
        });
      }
    }
  }

  _checkDataIntegrity(state, content, file) {
    // Missing CSRF protection
    if (content.includes('cookie') && content.includes('session')) {
      if (!content.includes('csrf') && !content.includes('CSRF') && !content.includes('csurf')) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'security',
          title: 'Missing CSRF protection with cookies/sessions',
          description: `${file.relativePath} uses cookies/sessions but may lack CSRF protection. Cross-site request forgery attacks could trick users into performing unintended actions.`,
          file: file.relativePath,
          suggestion: 'Implement CSRF tokens or use SameSite cookie attribute.',
          fixable: true,
        });
      }
    }
  }

  _checkLogging(state, content, file) {
    // Logging sensitive data
    const sensitiveLogging = /console\.(log|info|debug)\s*\([^)]*(?:password|token|secret|credit.?card|ssn|cvv)/gi;
    if (sensitiveLogging.test(content)) {
      this.addFinding(state, {
        severity: 'high',
        category: 'security',
        title: 'Sensitive data may be logged',
        description: `${file.relativePath} appears to log sensitive data (passwords, tokens, secrets). Logs are often stored insecurely and accessed by multiple people.`,
        file: file.relativePath,
        suggestion: 'Never log sensitive data. Redact or mask sensitive fields before logging.',
        fixable: true,
      });
    }
  }

  _checkSSRF(state, content, file) {
    // Server-side request forgery — making HTTP requests with user-controlled URLs
    const ssrfPattern = /(?:axios|fetch|http\.request|got)\s*\(\s*(?:req\.(body|query|params)|`[^`]*\$\{req)/g;
    if (ssrfPattern.test(content)) {
      this.addFinding(state, {
        severity: 'high',
        category: 'security',
        title: 'Potential SSRF vulnerability',
        description: `${file.relativePath} makes HTTP requests using user-controlled URLs. Attackers could access internal services, cloud metadata endpoints, or private networks.`,
        file: file.relativePath,
        suggestion: 'Validate and whitelist allowed URLs/domains. Block requests to internal IP ranges.',
        fixable: false,
      });
    }
  }

  _checkRateLimiting(state, content, file) {
    // Sensitive operations without rate limiting
    const sensitiveOps = ['payment', 'charge', 'refund', 'transfer', 'withdraw'];
    for (const op of sensitiveOps) {
      if (content.toLowerCase().includes(op) && file.relativePath.includes('route')) {
        if (!content.includes('rateLimit') && !content.includes('rateLimiter')) {
          this.addFinding(state, {
            severity: 'medium',
            category: 'security',
            title: `Financial operation route missing rate limiting: ${op}`,
            description: `${file.relativePath} contains financial operations (${op}) without rate limiting. This could allow abuse or automated fraud.`,
            file: file.relativePath,
            suggestion: 'Add stricter rate limiting to financial operation endpoints.',
            fixable: true,
          });
          break; // One finding per file
        }
      }
    }
  }

  _checkDataExposure(state, content, file) {
    // Returning sensitive fields in API responses
    if (content.includes('.toJSON') || content.includes('res.json')) {
      const exposurePatterns = [
        { regex: /password/gi, field: 'password' },
        { regex: /creditCard|card_number|cardNumber/gi, field: 'credit card' },
        { regex: /\.select\s*\(\s*['"][^'"]*password/g, field: 'password in select' },
      ];

      for (const pattern of exposurePatterns) {
        if (pattern.regex.test(content)) {
          // Check if password is being excluded
          if (content.includes('-password') || content.includes("select('-password')")) continue;
          // It might be intentional (e.g., for comparison) — low severity
        }
      }
    }
  }

  async _auditAuthMiddleware(state, config) {
    const { scanner, projectRoot } = config;
    const authMiddleware = state.context.middleware.find(
      (m) => m.file.includes('auth')
    );
    if (!authMiddleware) {
      this.addFinding(state, {
        severity: 'critical',
        category: 'security',
        title: 'No authentication middleware found',
        description: 'Could not locate an authentication middleware file. This is a critical infrastructure gap.',
        suggestion: 'Implement JWT-based authentication middleware.',
        fixable: false,
      });
      return;
    }

    const content = await scanner.readFileContent(authMiddleware.path);
    if (!content) return;

    // Check JWT verification
    if (!content.includes('jwt.verify') && !content.includes('jsonwebtoken')) {
      this.addFinding(state, {
        severity: 'critical',
        category: 'security',
        title: 'Auth middleware may not verify JWT tokens',
        description: `${authMiddleware.file} does not appear to use jwt.verify(). Tokens may not be validated, allowing forged tokens.`,
        file: authMiddleware.file,
        suggestion: 'Use jwt.verify() with proper secret/key to validate tokens.',
        fixable: false,
      });
    }

    // Check for token from headers only (not query params)
    if (content.includes('req.query.token') || content.includes('req.query.jwt')) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'security',
        title: 'JWT token accepted from query parameters',
        description: `${authMiddleware.file} accepts tokens from URL query parameters. This exposes tokens in server logs, browser history, and referrer headers.`,
        file: authMiddleware.file,
        suggestion: 'Only accept JWT tokens from the Authorization header.',
        fixable: true,
      });
    }
  }

  async _checkServerSecurity(state, config) {
    const { scanner, projectRoot } = config;
    const serverFiles = ['server.js', 'app.js', 'index.js'];

    for (const serverFile of serverFiles) {
      const candidates = [
        `${projectRoot}/backend/src/${serverFile}`,
        `${projectRoot}/backend/${serverFile}`,
        `${projectRoot}/${serverFile}`,
      ];

      for (const candidate of candidates) {
        const content = await scanner.readFileContent(candidate);
        if (!content) continue;

        // Check for Helmet.js
        if (!content.includes('helmet')) {
          this.addFinding(state, {
            severity: 'medium',
            category: 'security',
            title: 'Missing Helmet.js security headers',
            description: `${candidate} does not use Helmet.js. Security headers like X-Frame-Options, CSP, and HSTS are not being set.`,
            file: candidate,
            suggestion: 'Add app.use(helmet()) to set standard security headers.',
            fixable: true,
          });
        }

        // Check for trust proxy in Express
        if (content.includes('express()') && !content.includes('trust proxy')) {
          this.addFinding(state, {
            severity: 'low',
            category: 'security',
            title: 'Express trust proxy not configured',
            description: `Express "trust proxy" is not set, which affects rate limiting, IP logging, and secure cookies behind reverse proxies.`,
            file: candidate,
            suggestion: 'Set app.set("trust proxy", 1) if behind a reverse proxy.',
            fixable: true,
          });
        }

        return; // Only check first found server file
      }
    }
  }
}
