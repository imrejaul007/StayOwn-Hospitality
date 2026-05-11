import { BaseAgent } from '../core/BaseAgent.js';

/**
 * ArchitectureAgent - Analyzes codebase architecture for structural issues.
 * Detects tight coupling, god files, circular dependencies, missing modularization.
 */
export class ArchitectureAgent extends BaseAgent {
  constructor() {
    super('ArchitectureAgent', 'Analyzes architecture for coupling, god files, circular dependencies, and modularity issues');
  }

  async analyze(state, config) {
    const { scanner } = config;

    this._checkGodFiles(state);
    this._checkModelComplexity(state);
    await this._checkCircularDependencies(state, config);
    await this._checkCodeDuplication(state, config);
    await this._checkErrorHandlingConsistency(state, config);
    await this._checkResponsibilityMixing(state, config);

    return {
      summary: 'Architecture analysis complete.',
    };
  }

  _checkGodFiles(state) {
    // Files with too many responsibilities or excessive size
    const categories = state.context.files;
    const allFiles = [
      ...(categories.controllers || []),
      ...(categories.services || []),
      ...(categories.routes || []),
    ];

    for (const [, info] of state.context.services) {
      if (info.lineCount > 1200) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'architecture',
          title: `God service file: ${info.file} (${info.lineCount} lines)`,
          description: `Service file has ${info.lineCount} lines, far exceeding the recommended 300-line limit. God files are hard to test, maintain, and understand. They often handle multiple unrelated concerns.`,
          file: info.file,
          suggestion: 'Split into focused service modules. Extract related functions into separate files with clear single responsibilities.',
          fixable: false,
        });
      }
    }

    for (const [, info] of state.context.controllers) {
      if (info.lineCount > 1000) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'architecture',
          title: `Large controller: ${info.file} (${info.lineCount} lines)`,
          description: `Controller file has ${info.lineCount} lines. Controllers should be thin, delegating business logic to services. A large controller likely contains business logic that should be extracted.`,
          file: info.file,
          suggestion: 'Move business logic to service layer. Controllers should only handle request parsing and response formatting.',
          fixable: false,
        });
      }
    }
  }

  _checkLayerViolations(state, scanner) {
    // Routes should not directly query the database
    for (const [routeName, routeInfo] of state.context.routes) {
      if (routeInfo.endpoints.length > 0) {
        // Check if route file imports models directly (layer violation)
        // This will be a simplified check based on available context
      }
    }

    // Controllers should not be imported by other controllers
    // Services should not import routes or controllers
  }

  async _checkCircularDependencies(state, config) {
    const { scanner } = config;
    const services = state.context.files.services || [];
    const dependencyGraph = new Map();

    for (const file of services) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      const deps = [];
      const requireRegex = /require\s*\(\s*['"]\.\/([^'"]+)['"]\s*\)/g;
      const importRegex = /from\s+['"]\.\/([^'"]+)['"]/g;

      let match;
      while ((match = requireRegex.exec(content))) deps.push(match[1]);
      while ((match = importRegex.exec(content))) deps.push(match[1]);

      dependencyGraph.set(file.name.replace('.js', ''), deps);
    }

    // Detect cycles using DFS
    const cycles = this._findCycles(dependencyGraph);
    if (cycles.length > 0) {
      for (const cycle of cycles.slice(0, 5)) {
        this.addFinding(state, {
          severity: 'high',
          category: 'architecture',
          title: `Circular dependency detected: ${cycle.join(' → ')}`,
          description: `Circular dependency chain: ${cycle.join(' → ')}. Circular dependencies cause unpredictable initialization order, can lead to undefined imports, and make the code hard to reason about.`,
          suggestion: 'Break the cycle by extracting shared logic into a separate module or using dependency injection.',
          fixable: false,
        });
      }
    }
  }

  _findCycles(graph) {
    const cycles = [];
    const visited = new Set();
    const inStack = new Set();

    const dfs = (node, path) => {
      if (inStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart).concat(node));
        }
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      inStack.add(node);
      path.push(node);

      const deps = graph.get(node) || [];
      for (const dep of deps) {
        const depBase = dep.replace(/\.js$/, '').split('/').pop();
        if (graph.has(depBase)) {
          dfs(depBase, [...path]);
        }
      }

      inStack.delete(node);
    };

    for (const node of graph.keys()) {
      dfs(node, []);
    }

    return cycles;
  }

  async _checkCodeDuplication(state, config) {
    const { scanner } = config;
    const services = state.context.files.services || [];

    // Check for duplicated error handling patterns
    const errorPatterns = new Map();
    for (const file of services) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      // Extract error handling blocks
      const errorBlocks = content.match(/catch\s*\([^)]*\)\s*\{[^}]{50,200}\}/g);
      if (errorBlocks) {
        for (const block of errorBlocks) {
          const normalized = block.replace(/\s+/g, ' ').trim();
          if (!errorPatterns.has(normalized)) {
            errorPatterns.set(normalized, []);
          }
          errorPatterns.get(normalized).push(file.name);
        }
      }
    }

    // Report heavily duplicated patterns
    let duplicatedPatterns = 0;
    for (const [, files] of errorPatterns) {
      if (files.length >= 5) {
        duplicatedPatterns++;
      }
    }

    if (duplicatedPatterns > 0) {
      this.addFinding(state, {
        severity: 'low',
        category: 'architecture',
        title: `${duplicatedPatterns} heavily duplicated error handling patterns`,
        description: `Found ${duplicatedPatterns} identical error handling blocks repeated across 5+ files. This violates DRY and makes changing error handling behavior require edits in many places.`,
        suggestion: 'Extract common error handling into a shared middleware or utility function.',
        fixable: true,
      });
    }
  }

  _checkModelComplexity(state) {
    for (const [modelName, modelInfo] of state.context.models) {
      // Models with too many fields
      if (modelInfo.fields.length > 30) {
        this.addFinding(state, {
          severity: 'low',
          category: 'architecture',
          title: `Complex model: "${modelName}" has ${modelInfo.fields.length} fields`,
          description: `The "${modelName}" model has ${modelInfo.fields.length} fields. Very wide schemas can indicate that the model handles multiple concerns and should be decomposed using sub-documents or separate collections.`,
          file: modelInfo.file,
          suggestion: 'Consider breaking into sub-documents, embedded schemas, or separate related models.',
          fixable: false,
        });
      }

      // Models with many hooks (complexity indicator)
      if (modelInfo.hooks.length > 5) {
        this.addFinding(state, {
          severity: 'low',
          category: 'architecture',
          title: `Model "${modelName}" has ${modelInfo.hooks.length} hooks`,
          description: `Excessive pre/post hooks make the model's behavior hard to predict. Side effects hidden in hooks can cause unexpected behavior and make debugging difficult.`,
          file: modelInfo.file,
          suggestion: 'Move complex logic from hooks to explicit service methods for better visibility.',
          fixable: false,
        });
      }
    }
  }

  async _checkErrorHandlingConsistency(state, config) {
    const { scanner } = config;
    const controllers = state.context.files.controllers || [];

    let usesAsyncHandler = 0;
    let usesTryCatch = 0;
    let usesNeither = 0;

    for (const file of controllers) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      if (/asyncHandler|catchAsync/.test(content)) usesAsyncHandler++;
      else if (/try\s*\{[\s\S]*catch/.test(content)) usesTryCatch++;
      else usesNeither++;
    }

    if (usesAsyncHandler > 0 && usesTryCatch > 0) {
      this.addFinding(state, {
        severity: 'low',
        category: 'architecture',
        title: 'Inconsistent error handling patterns across controllers',
        description: `Controllers use mixed error handling: ${usesAsyncHandler} use asyncHandler/catchAsync, ${usesTryCatch} use manual try/catch, ${usesNeither} have neither. Inconsistency makes error behavior unpredictable across the API.`,
        suggestion: 'Standardize on one pattern — preferably asyncHandler/catchAsync for cleaner code.',
        fixable: true,
      });
    }
  }

  async _checkResponsibilityMixing(state, config) {
    const { scanner } = config;
    const routes = state.context.files.routes || [];

    for (const file of routes) {
      const content = await scanner.readFileContent(file.path);
      if (!content) continue;

      // Routes that contain business logic (should be in controllers/services)
      const hasBusinessLogic =
        (content.match(/\.find|\.create|\.update|\.delete|\.aggregate/g) || []).length > 3;
      const hasDirectDBAccess = /mongoose|Model\.|\.save\(\)/.test(content);

      const importsController = /Controller|controller|import.*Controller/i.test(content);
      if (hasBusinessLogic && hasDirectDBAccess && !importsController) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'architecture',
          title: `Route file contains business logic: ${file.name}`,
          description: `${file.relativePath} directly accesses the database and contains business logic. Routes should only define endpoint mappings and delegate to controllers/services.`,
          file: file.relativePath,
          suggestion: 'Extract business logic to a controller, and database operations to a service layer.',
          fixable: false,
        });
      }
    }
  }
}
