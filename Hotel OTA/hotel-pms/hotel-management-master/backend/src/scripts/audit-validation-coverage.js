import fs from 'fs';
import path from 'path';

const routesDir = path.resolve(process.cwd(), 'src', 'routes');
const outputPath = path.resolve(process.cwd(), '..', 'docs', 'validation-coverage.json');

const routeBlockRegex = /router\.(get|post|put|patch|delete|all)\s*\(([\s\S]*?)\)\s*;/g;
const validationPatterns = [
  /\bvalidate\s*\(/,
  /\bschemas\./,
  /\bbody\s*\(/,
  /\bparam\s*\(/,
  /\bquery\s*\(/,
  /\bJoi\./
];

function readRouteFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...readRouteFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function countLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function extractRoutePath(routeArgs) {
  const pathMatch = routeArgs.match(/^\s*['"`]([^'"`]+)['"`]/);
  return pathMatch ? pathMatch[1] : null;
}

function hasValidationMiddleware(routeArgs) {
  return validationPatterns.some((pattern) => pattern.test(routeArgs));
}

function analyzeRouteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const routes = [];

  let match;
  while ((match = routeBlockRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routeArgs = match[2];
    const routePath = extractRoutePath(routeArgs);
    if (!routePath) {
      continue;
    }

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const hasValidation = hasValidationMiddleware(routeArgs);

    routes.push({
      method,
      route: routePath,
      line: countLineNumber(content, match.index),
      isMutation,
      hasValidation,
      status: !isMutation ? 'not_applicable' : hasValidation ? 'covered_validation' : 'missing_validation'
    });
  }

  return routes;
}

function buildReport() {
  const files = readRouteFiles(routesDir);
  const report = {
    generatedAt: new Date().toISOString(),
    scannedFiles: files.length,
    totals: {
      routes: 0,
      mutationRoutes: 0,
      coveredValidation: 0,
      missingValidation: 0
    },
    missingValidationRoutes: [],
    files: []
  };

  for (const file of files) {
    const relativeFile = path.relative(path.resolve(process.cwd(), 'src'), file).replace(/\\/g, '/');
    const routes = analyzeRouteFile(file);

    for (const route of routes) {
      report.totals.routes += 1;
      if (route.isMutation) {
        report.totals.mutationRoutes += 1;
      }

      if (route.status === 'covered_validation') {
        report.totals.coveredValidation += 1;
      } else if (route.status === 'missing_validation') {
        report.totals.missingValidation += 1;
        report.missingValidationRoutes.push({
          file: relativeFile,
          line: route.line,
          method: route.method,
          route: route.route
        });
      }
    }

    report.files.push({
      file: relativeFile,
      routes
    });
  }

  report.files.sort((a, b) => a.file.localeCompare(b.file));
  report.missingValidationRoutes.sort((a, b) => {
    if (a.file !== b.file) {
      return a.file.localeCompare(b.file);
    }
    return a.line - b.line;
  });

  return report;
}

function main() {
  const report = buildReport();
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Validation coverage report written to ${outputPath}`);
  // eslint-disable-next-line no-console
  console.log(`Mutation routes: ${report.totals.mutationRoutes}`);
  // eslint-disable-next-line no-console
  console.log(`Validation-covered: ${report.totals.coveredValidation}`);
  // eslint-disable-next-line no-console
  console.log(`Missing validation: ${report.totals.missingValidation}`);
}

main();
