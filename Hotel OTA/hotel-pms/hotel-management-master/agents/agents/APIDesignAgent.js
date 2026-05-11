import { BaseAgent } from '../core/BaseAgent.js';

/**
 * APIDesignAgent - Validates REST API design quality, consistency, and developer experience.
 *
 * A PM cares about: Can frontend devs and third-party integrators easily use this API?
 * Are error messages clear? Is pagination consistent? Is the API versioned?
 */
export class APIDesignAgent extends BaseAgent {
  constructor() {
    super('APIDesignAgent', 'Validates REST conventions, response consistency, pagination, error format, versioning, and API documentation');
  }

  async analyze(state, config) {
    const { scanner } = config;
    const routeFiles = state.context.files.routes || [];
    const controllerFiles = state.context.files.controllers || [];

    await this._checkVersioning(state, config);
    await this._checkResponseConsistency(state, controllerFiles, scanner);
    await this._checkErrorFormat(state, controllerFiles, scanner);
    await this._checkPagination(state, routeFiles, controllerFiles, scanner);
    await this._checkHTTPSemantics(state, routeFiles, scanner);
    await this._checkNamingConventions(state, routeFiles, scanner);
    await this._checkDocumentation(state, routeFiles, scanner);
    await this._checkSizeLimits(state, config);
    await this._checkPartialUpdates(state, routeFiles, scanner);
    await this._checkStatusCodes(state, controllerFiles, scanner);

    return {
      summary: `API design audit complete — ${routeFiles.length} routes, ${controllerFiles.length} controllers analyzed.`,
    };
  }

  async _checkVersioning(state, config) {
    const { scanner, projectRoot } = config;
    const serverFiles = ['server.js', 'app.js'];

    for (const sf of serverFiles) {
      const content = await scanner.readFileContent(`${projectRoot}/backend/src/${sf}`);
      if (!content) continue;

      const hasVersioning = /\/api\/v\d|\/v\d\/|apiVersion|API_VERSION/.test(content);
      if (!hasVersioning) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'api-design',
          title: 'API may lack version prefix',
          description: `Server does not appear to use API versioning (e.g., /api/v1/). Without versioning, breaking changes affect all consumers simultaneously. Adding versioning later requires all clients to update.`,
          file: `backend/src/${sf}`,
          suggestion: 'Prefix all routes with /api/v1/. Plan for /api/v2/ migration path.',
          fixable: true,
        });
      }
      break;
    }
  }

  async _checkResponseConsistency(state, controllers, scanner) {
    let jsonPatterns = new Map();

    for (const file of controllers.slice(0, 50)) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      // Check response envelope consistency
      const resJsonCalls = content.match(/res\.(?:status\(\d+\)\.)?json\s*\(\s*\{[^}]{0,200}\}/g) || [];

      for (const call of resJsonCalls) {
        if (call.includes('success')) jsonPatterns.set('success-envelope', (jsonPatterns.get('success-envelope') || 0) + 1);
        else if (call.includes('data')) jsonPatterns.set('data-envelope', (jsonPatterns.get('data-envelope') || 0) + 1);
        else if (call.includes('message')) jsonPatterns.set('message-only', (jsonPatterns.get('message-only') || 0) + 1);
        else if (call.includes('error')) jsonPatterns.set('error-envelope', (jsonPatterns.get('error-envelope') || 0) + 1);
        else jsonPatterns.set('raw-data', (jsonPatterns.get('raw-data') || 0) + 1);
      }
    }

    if (jsonPatterns.size > 3) {
      const patterns = [...jsonPatterns.entries()].map(([k, v]) => `${k}: ${v}`).join(', ');
      this.addFinding(state, {
        severity: 'medium',
        category: 'api-design',
        title: `Inconsistent API response envelopes (${jsonPatterns.size} patterns)`,
        description: `API responses use ${jsonPatterns.size} different envelope patterns: ${patterns}. Inconsistent response formats force frontend developers to handle each endpoint differently, increasing bugs and development time.`,
        suggestion: 'Standardize on one envelope: { success: Boolean, data: Object|Array, message: String, pagination?: Object }. Use a response helper function.',
        fixable: true,
      });
    }
  }

  async _checkErrorFormat(state, controllers, scanner) {
    let errorFormats = 0;
    let inconsistentErrors = 0;

    for (const file of controllers.slice(0, 40)) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      const errorResponses = content.match(/res\.status\(4\d\d\)\.json\s*\(\s*\{[^}]{0,300}\}/g) || [];

      for (const err of errorResponses) {
        errorFormats++;
        // Check if error includes a structured format
        const hasCode = /code\s*:|errorCode|error\s*:|status\s*:/i.test(err);
        const hasMessage = /message\s*:/i.test(err);
        if (!hasCode || !hasMessage) inconsistentErrors++;
      }
    }

    if (inconsistentErrors > 10) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'api-design',
        title: `${inconsistentErrors}/${errorFormats} error responses lack structured format`,
        description: `Many error responses don't include both an error code and message. Without structured errors, frontend can't show meaningful messages to users or implement error-specific handling (retry vs. show error vs. redirect).`,
        suggestion: 'Standardize errors: { success: false, error: { code: "BOOKING_CONFLICT", message: "Room already booked for these dates", details: [...] } }',
        fixable: true,
      });
    }
  }

  async _checkPagination(state, routes, controllers, scanner) {
    let listEndpoints = 0;
    let unpaginatedEndpoints = 0;

    for (const file of routes) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      // Find GET endpoints that likely return lists
      const getEndpoints = content.match(/router\.get\s*\(\s*['"]\/['"](?!\s*['"]:\w+['"]\s*,)/g) || [];
      listEndpoints += getEndpoints.length;
    }

    for (const file of controllers) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      // .find() without pagination
      const findCalls = (content.match(/\.find\s*\([^)]*\)/g) || []).length;
      const paginatedCalls = (content.match(/\.skip\s*\(|\.limit\s*\(|\.paginate\s*\(|page|pageSize|perPage/g) || []).length;

      if (findCalls > paginatedCalls && findCalls > 0) {
        unpaginatedEndpoints += findCalls - paginatedCalls;
      }
    }

    if (unpaginatedEndpoints > 20) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'api-design',
        title: `~${unpaginatedEndpoints} list queries without pagination`,
        description: `Approximately ${unpaginatedEndpoints} database queries return full result sets without pagination. This causes: (1) slow response times with growing data, (2) high memory usage, (3) poor UX as the system scales. A hotel with 10,000+ bookings will choke on unpaginated list endpoints.`,
        suggestion: 'Implement cursor-based or offset pagination on ALL list endpoints. Return: { data: [...], pagination: { page, pageSize, total, totalPages } }.',
        fixable: true,
      });
    }
  }

  async _checkHTTPSemantics(state, routes, scanner) {
    for (const file of routes) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      // POST for what should be GET (reading data)
      const postForRead = /router\.post\s*\(\s*['"][^'"]*(?:search|list|get|fetch|report|analytics|stats)/gi;
      if (postForRead.test(content)) {
        this.addFinding(state, {
          severity: 'low',
          category: 'api-design',
          title: `POST used for read operations in ${file.name}`,
          description: `${file.relativePath} uses POST for read operations (search/list/get). POST requests aren't cacheable, can't be bookmarked, and violate REST semantics. This hurts CDN caching and browser behavior.`,
          file: file.relativePath,
          suggestion: 'Use GET with query params for reads. For complex search filters, GET with JSON-encoded query param or POST /search is acceptable.',
          fixable: true,
        });
      }

      // DELETE without ID (dangerous mass delete)
      const massDelete = /router\.delete\s*\(\s*['"]\/['"]/g;
      if (massDelete.test(content)) {
        this.addFinding(state, {
          severity: 'high',
          category: 'api-design',
          title: `DELETE endpoint without resource ID in ${file.name}`,
          description: `${file.relativePath} has a DELETE route on the collection root (no :id). This could accidentally delete all resources.`,
          file: file.relativePath,
          suggestion: 'DELETE should always target a specific resource: DELETE /resource/:id. For bulk delete, use POST /resource/batch-delete with IDs in the body.',
          fixable: true,
        });
      }
    }
  }

  async _checkNamingConventions(state, routes, scanner) {
    let camelCaseRoutes = 0;
    let kebabCaseRoutes = 0;
    let snakeCaseRoutes = 0;

    for (const file of routes) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      const paths = content.match(/router\.\w+\s*\(\s*['"]([^'"]+)['"]/g) || [];
      for (const path of paths) {
        const routePath = path.match(/['"]([^'"]+)['"]/)?.[1] || '';
        if (/[a-z][A-Z]/.test(routePath)) camelCaseRoutes++;
        else if (/[a-z]-[a-z]/.test(routePath)) kebabCaseRoutes++;
        else if (/[a-z]_[a-z]/.test(routePath)) snakeCaseRoutes++;
      }
    }

    const styles = [];
    if (camelCaseRoutes > 5) styles.push(`camelCase: ${camelCaseRoutes}`);
    if (kebabCaseRoutes > 5) styles.push(`kebab-case: ${kebabCaseRoutes}`);
    if (snakeCaseRoutes > 5) styles.push(`snake_case: ${snakeCaseRoutes}`);

    if (styles.length > 1) {
      this.addFinding(state, {
        severity: 'low',
        category: 'api-design',
        title: `Inconsistent URL naming conventions (${styles.join(', ')})`,
        description: `API routes mix naming conventions: ${styles.join(', ')}. Inconsistency makes the API harder to learn and use. REST convention recommends kebab-case for URLs.`,
        suggestion: 'Standardize on kebab-case for URLs: /room-types, /booking-engine, /daily-routine-check.',
        fixable: true,
      });
    }
  }

  async _checkDocumentation(state, routes, scanner) {
    let totalEndpoints = 0;
    let documentedEndpoints = 0;

    for (const file of routes) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      const endpoints = (content.match(/router\.(get|post|put|patch|delete)\s*\(/g) || []).length;
      totalEndpoints += endpoints;

      // Check for JSDoc or Swagger annotations
      const docComments = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
      const swaggerAnnotations = (content.match(/@swagger|@api|@openapi/g) || []).length;
      documentedEndpoints += Math.min(endpoints, docComments + swaggerAnnotations);
    }

    const coverage = totalEndpoints > 0 ? ((documentedEndpoints / totalEndpoints) * 100).toFixed(0) : 0;
    if (Number(coverage) < 30) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'api-design',
        title: `Low API documentation coverage: ~${coverage}%`,
        description: `Only ~${coverage}% of ${totalEndpoints} API endpoints have documentation comments. Without documentation, frontend teams and third-party integrators must read source code to understand the API. This slows development and causes integration bugs.`,
        suggestion: 'Add Swagger/OpenAPI annotations or JSDoc to all endpoints. Use swagger-jsdoc for auto-generation.',
        fixable: true,
      });
    }
  }

  async _checkSizeLimits(state, config) {
    const { scanner, projectRoot } = config;
    const serverFile = await scanner.readFileContent(`${projectRoot}/backend/src/server.js`);
    if (!serverFile) return;

    // Check JSON body size limit
    const hasBodyLimit = /limit\s*:\s*['"]?\d+['"kmb]?/i.test(serverFile);
    if (!hasBodyLimit) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'api-design',
        title: 'No request body size limit configured',
        description: 'Express JSON body parser has no explicit size limit. Attackers can send huge payloads to exhaust server memory (JSON bomb attack). Default is 100kb but should be explicitly set.',
        file: 'backend/src/server.js',
        suggestion: 'Set explicit limit: app.use(express.json({ limit: "10mb" })). Use smaller limits for most routes, larger for file uploads.',
        fixable: true,
      });
    }
  }

  async _checkPartialUpdates(state, routes, scanner) {
    let putCount = 0;
    let patchCount = 0;

    for (const file of routes) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      putCount += (content.match(/router\.put\s*\(/g) || []).length;
      patchCount += (content.match(/router\.patch\s*\(/g) || []).length;
    }

    if (putCount > 20 && patchCount < 5) {
      this.addFinding(state, {
        severity: 'low',
        category: 'api-design',
        title: `${putCount} PUT endpoints but only ${patchCount} PATCH — no partial updates`,
        description: `API heavily uses PUT (full replacement) over PATCH (partial update). This forces clients to send ALL fields even when updating one, wasting bandwidth and risking accidental overwrites of unchanged fields.`,
        suggestion: 'Add PATCH endpoints for partial updates. PUT should replace the entire resource, PATCH should merge only provided fields.',
        fixable: true,
      });
    }
  }

  async _checkStatusCodes(state, controllers, scanner) {
    let generic200 = 0;
    let proper201 = 0;
    let proper204 = 0;

    for (const file of controllers.slice(0, 40)) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      // POST handlers returning 200 instead of 201
      const postWith200 = /create|register|add|new[\s\S]{0,300}res\.(?:status\(200\)\.)?json/gi;
      generic200 += (content.match(postWith200) || []).length;
      proper201 += (content.match(/res\.status\(201\)/g) || []).length;
      proper204 += (content.match(/res\.status\(204\)/g) || []).length;
    }

    if (generic200 > 10 && proper201 < 5) {
      this.addFinding(state, {
        severity: 'low',
        category: 'api-design',
        title: 'Create operations return 200 instead of 201 Created',
        description: `Many resource creation endpoints return HTTP 200 instead of 201 Created. While functional, proper status codes enable client-side caching, middleware decisions, and follow REST standards.`,
        suggestion: 'Return 201 for resource creation, 204 for deletion, 200 for reads and updates.',
        fixable: true,
      });
    }
  }
}
