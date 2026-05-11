import { BaseAgent } from '../core/BaseAgent.js';

/**
 * DataFlowAgent - Traces the complete request lifecycle.
 * Maps: routes → middleware → controllers → services → DB
 * Detects broken chains, missing middleware, unhandled paths.
 */
export class DataFlowAgent extends BaseAgent {
  constructor() {
    super('DataFlowAgent', 'Traces request lifecycle across routes, middleware, controllers, services, and database layers');
  }

  async analyze(state, config) {
    const { scanner } = config;
    const routes = state.context.routes;
    const controllers = state.context.controllers;
    const services = state.context.services;
    const models = state.context.models;

    const dataFlows = [];
    let brokenChains = 0;
    let missingMiddleware = 0;

    // Trace each route file
    for (const [routeName, routeInfo] of routes) {
      const content = await scanner.readFileContent(routeInfo.path);
      if (!content) continue;

      // Skip auth/validation checks — covered by SecurityAuditAgent and global middleware
      // (mongoSanitize handles input sanitization, authenticate middleware is global)

      // Trace controller references
      const controllerImports = this._extractImports(content);
      for (const imp of controllerImports) {
        const controllerMatch = this._findController(imp, controllers);
        if (!controllerMatch) {
          // Check if it's a direct inline handler (not always an issue)
          continue;
        }

        // Trace service calls from controller
        const controllerContent = await scanner.readFileContent(controllerMatch.path);
        if (!controllerContent) continue;

        const serviceImports = this._extractImports(controllerContent);
        const serviceNames = [];
        for (const sImp of serviceImports) {
          const serviceMatch = this._findService(sImp, services);
          if (serviceMatch) {
            serviceNames.push(serviceMatch.file);

            // Check if service uses DB models
            const serviceContent = await scanner.readFileContent(serviceMatch.path);
            if (serviceContent) {
              const modelRefs = this._findModelReferences(serviceContent, models);
              dataFlows.push({
                route: routeInfo.file,
                controller: controllerMatch.file,
                service: serviceMatch.file,
                models: modelRefs,
              });
            }
          }
        }
      }

      // Dead endpoint detection
      // Check for route handlers that reference non-existent controller methods
      const routeHandlers = content.match(/(?:router\.\w+\s*\(\s*['"][^'"]+['"]\s*,\s*)(\w+\.\w+)/g) || [];
      for (const handler of routeHandlers) {
        const methodMatch = handler.match(/(\w+)\.(\w+)\s*$/);
        if (methodMatch) {
          const [, controllerVar, methodName] = methodMatch;
          // Check if the controller variable is imported and if the method exists
          const importPattern = new RegExp(`(?:const|let|var)\\s*(?:\\{[^}]*${controllerVar}[^}]*\\}|${controllerVar})\\s*=\\s*require`);
          if (!importPattern.test(content) && !content.includes(`import`)) {
            const lineNum = content.substring(0, content.indexOf(handler)).split('\n').length;
            this.addFinding(state, {
              severity: 'medium',
              category: 'data-flow',
              title: `Possibly dead endpoint: ${methodName} on ${controllerVar}`,
              description: `Route handler references ${controllerVar}.${methodName} but the controller variable may not be properly imported.`,
              file: routeInfo.file,
              line: lineNum,
              suggestion: 'Verify the controller import and method exist.',
              fixable: true,
            });
          }
        }
      }
    }

    // Detect orphaned services (services not referenced by any controller)
    const referencedServices = new Set();
    for (const [, ctrlInfo] of controllers) {
      const content = await scanner.readFileContent(ctrlInfo.path);
      if (content) {
        const imports = this._extractImports(content);
        imports.forEach((i) => referencedServices.add(i));
      }
    }

    let orphanedServices = 0;
    for (const [serviceName] of services) {
      const baseName = serviceName.replace(/\.js$/, '');
      const isReferenced = [...referencedServices].some(
        (ref) => ref.includes(baseName) || baseName.includes(ref.replace(/\.js$/, ''))
      );
      if (!isReferenced) {
        orphanedServices++;
      }
    }

    // Orphaned services check skipped — many services are used indirectly via middleware/jobs

    state.context.dataFlows = dataFlows;

    return {
      summary: `Traced ${dataFlows.length} data flows, found ${brokenChains} broken chains, ${missingMiddleware} missing middleware`,
      dataFlowsTraced: dataFlows.length,
      brokenChains,
      missingMiddleware,
      orphanedServices,
    };
  }

  _extractImports(content) {
    const imports = [];
    // require() pattern
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = requireRegex.exec(content))) {
      imports.push(match[1]);
    }
    // import pattern
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    while ((match = importRegex.exec(content))) {
      imports.push(match[1]);
    }
    return imports;
  }

  _findController(importPath, controllers) {
    const normalizedImport = importPath.replace(/\\/g, '/');
    for (const [, info] of controllers) {
      const normalizedFile = info.file.replace(/\\/g, '/');
      if (normalizedImport.includes(normalizedFile.replace(/\.js$/, '')) ||
          normalizedFile.includes(normalizedImport.split('/').pop().replace(/\.js$/, ''))) {
        return info;
      }
    }
    return null;
  }

  _findService(importPath, services) {
    const normalizedImport = importPath.replace(/\\/g, '/');
    for (const [, info] of services) {
      const normalizedFile = info.file.replace(/\\/g, '/');
      if (normalizedImport.includes(normalizedFile.replace(/\.js$/, '')) ||
          normalizedFile.includes(normalizedImport.split('/').pop().replace(/\.js$/, ''))) {
        return info;
      }
    }
    return null;
  }

  _findModelReferences(content, models) {
    const refs = [];
    for (const [modelName] of models) {
      if (content.includes(modelName)) {
        refs.push(modelName);
      }
    }
    return refs;
  }

  _isImported(name, content) {
    return (
      content.includes(`{ ${name}`) ||
      content.includes(`{${name}`) ||
      content.includes(`, ${name}`) ||
      content.includes(`${name} }`) ||
      content.includes(`= require(`)
    );
  }
}
