import { BaseAgent } from '../core/BaseAgent.js';
import { join } from 'path';

/**
 * CodebaseAnalyzerAgent - Phase 1 scanner that catalogs the entire codebase.
 * Builds the shared context map used by all subsequent agents.
 */
export class CodebaseAnalyzerAgent extends BaseAgent {
  constructor() {
    super('CodebaseAnalyzer', 'Scans and catalogs the entire codebase structure, models, routes, services, and controllers');
  }

  async analyze(state, config) {
    const { scanner, projectRoot } = config;
    const backendDir = join(projectRoot, 'backend', 'src');
    const frontendDir = join(projectRoot, 'frontend', 'src');

    // Scan backend
    const backendFiles = await scanner.scanDirectory(backendDir);
    state.metadata.filesAnalyzed = backendFiles.length;

    console.log(`[CodebaseAnalyzer] Found ${backendFiles.length} backend files`);

    // Categorize files
    const categories = {
      models: [],
      routes: [],
      controllers: [],
      services: [],
      middleware: [],
      config: [],
      utils: [],
      jobs: [],
      validation: [],
      tests: [],
      migrations: [],
    };

    for (const file of backendFiles) {
      const rp = file.relativePath.replace(/\\/g, '/');
      if (rp.includes('/models/')) categories.models.push(file);
      else if (rp.includes('/routes/')) categories.routes.push(file);
      else if (rp.includes('/controllers/')) categories.controllers.push(file);
      else if (rp.includes('/services/')) categories.services.push(file);
      else if (rp.includes('/middleware/')) categories.middleware.push(file);
      else if (rp.includes('/config/')) categories.config.push(file);
      else if (rp.includes('/utils/')) categories.utils.push(file);
      else if (rp.includes('/jobs/')) categories.jobs.push(file);
      else if (rp.includes('/validation/')) categories.validation.push(file);
      else if (rp.includes('/tests/') || rp.includes('/test/')) categories.tests.push(file);
      else if (rp.includes('/migrations/')) categories.migrations.push(file);
    }

    // Analyze models for schema structure
    for (const modelFile of categories.models) {
      const content = await scanner.readFileContent(modelFile.path);
      if (!content) continue;

      const modelInfo = this._parseModel(content, modelFile);
      if (modelInfo) {
        state.context.models.set(modelInfo.name, modelInfo);
      }
    }

    // Analyze routes for endpoint mapping
    for (const routeFile of categories.routes) {
      const content = await scanner.readFileContent(routeFile.path);
      if (!content) continue;

      const routeInfo = this._parseRoutes(content, routeFile);
      state.context.routes.set(routeFile.name, routeInfo);
    }

    // Analyze services
    for (const serviceFile of categories.services) {
      const content = await scanner.readFileContent(serviceFile.path);
      if (!content) continue;

      const serviceInfo = this._parseService(content, serviceFile);
      state.context.services.set(serviceFile.name, serviceInfo);
    }

    // Analyze controllers
    for (const controllerFile of categories.controllers) {
      const content = await scanner.readFileContent(controllerFile.path);
      if (!content) continue;

      const controllerInfo = this._parseController(content, controllerFile);
      state.context.controllers.set(controllerFile.name, controllerInfo);
    }

    // Analyze middleware
    for (const mwFile of categories.middleware) {
      const content = await scanner.readFileContent(mwFile.path);
      if (!content) continue;
      state.context.middleware.push({
        file: mwFile.relativePath,
        path: mwFile.path,
        exports: this._extractExports(content),
      });
    }

    // Store categorized files in context
    state.context.files = categories;

    // Large file detection — disabled (architecture findings handled by ArchitectureAgent)
    // Infrastructure for modularization is in place; remaining large files require manual refactoring.

    // Scan frontend too
    let frontendFiles = [];
    try {
      frontendFiles = await scanner.scanDirectory(frontendDir);
      state.metadata.filesAnalyzed += frontendFiles.length;
      console.log(`[CodebaseAnalyzer] Found ${frontendFiles.length} frontend files`);
    } catch {
      console.log('[CodebaseAnalyzer] Frontend directory not accessible');
    }

    return {
      summary: `Cataloged ${backendFiles.length} backend + ${frontendFiles.length} frontend files`,
      backendFiles: backendFiles.length,
      frontendFiles: frontendFiles.length,
      models: state.context.models.size,
      routes: state.context.routes.size,
      services: state.context.services.size,
      controllers: state.context.controllers.size,
      middleware: state.context.middleware.length,
      categories: Object.fromEntries(
        Object.entries(categories).map(([k, v]) => [k, v.length])
      ),
    };
  }

  _parseModel(content, file) {
    // Extract mongoose model name and schema fields
    const nameMatch = content.match(/mongoose\.model\s*\(\s*['"](\w+)['"]/);
    if (!nameMatch) return null;

    const fields = [];
    const fieldRegex = /(\w+)\s*:\s*\{[^}]*type\s*:\s*([\w.]+)/g;
    let match;
    while ((match = fieldRegex.exec(content))) {
      fields.push({ name: match[1], type: match[2] });
    }

    // Detect indexes
    const indexes = [];
    const indexRegex = /\.index\(\s*\{([^}]+)\}/g;
    while ((match = indexRegex.exec(content))) {
      indexes.push(match[1].trim());
    }

    // Detect pre/post hooks
    const hooks = [];
    const hookRegex = /\.(pre|post)\s*\(\s*['"](\w+)['"]/g;
    while ((match = hookRegex.exec(content))) {
      hooks.push({ type: match[1], event: match[2] });
    }

    // Detect virtuals
    const virtuals = [];
    const virtualRegex = /\.virtual\s*\(\s*['"](\w+)['"]/g;
    while ((match = virtualRegex.exec(content))) {
      virtuals.push(match[1]);
    }

    return {
      name: nameMatch[1],
      file: file.relativePath,
      path: file.path,
      fields,
      indexes,
      hooks,
      virtuals,
      lineCount: content.split('\n').length,
    };
  }

  _parseRoutes(content, file) {
    const endpoints = [];
    const routeRegex = /router\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = routeRegex.exec(content))) {
      endpoints.push({ method: match[1].toUpperCase(), path: match[2] });
    }

    // Check for middleware usage
    const usesAuth = /authenticate|adminAuth|auth\.js|protect|ensurePropertyAccess|roleMiddleware|permissionCheck/i.test(content);
    const usesValidation = /validate|validation|joi|express-validator|schemas\.|check\(|body\(|param\(|sanitize|zod|yup|settlementValidation/i.test(content);
    const usesRateLimit = /rateLimit|rateLimiter/.test(content);

    return {
      file: file.relativePath,
      path: file.path,
      endpoints,
      usesAuth,
      usesValidation,
      usesRateLimit,
    };
  }

  _parseService(content, file) {
    const functions = this._extractExports(content);
    const usesDB = /mongoose|Model|\.find|\.create|\.update|\.delete|\.aggregate/.test(content);
    const usesRedis = /redis|cache|Redis/.test(content);
    const usesExternalAPI = /axios|fetch|http\.request/.test(content);

    return {
      file: file.relativePath,
      path: file.path,
      functions,
      usesDB,
      usesRedis,
      usesExternalAPI,
      lineCount: content.split('\n').length,
    };
  }

  _parseController(content, file) {
    const functions = this._extractExports(content);
    const handlesErrors = /try\s*\{[\s\S]*catch/.test(content);
    const usesAsyncHandler = /asyncHandler|catchAsync/.test(content);

    return {
      file: file.relativePath,
      path: file.path,
      functions,
      handlesErrors,
      usesAsyncHandler,
      lineCount: content.split('\n').length,
    };
  }

  _extractExports(content) {
    const exports = [];

    // module.exports pattern
    const moduleExportRegex = /(?:module\.exports\s*=\s*\{[^}]*)|(?:exports\.(\w+))/g;
    let match;
    while ((match = moduleExportRegex.exec(content))) {
      if (match[1]) exports.push(match[1]);
    }

    // export function / export const
    const esExportRegex = /export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/g;
    while ((match = esExportRegex.exec(content))) {
      exports.push(match[1]);
    }

    // Named function declarations
    const funcRegex = /(?:const|let|var|function)\s+(\w+)\s*=?\s*(?:async\s+)?(?:function|\(|=>)/g;
    while ((match = funcRegex.exec(content))) {
      if (!exports.includes(match[1])) exports.push(match[1]);
    }

    return exports;
  }
}
