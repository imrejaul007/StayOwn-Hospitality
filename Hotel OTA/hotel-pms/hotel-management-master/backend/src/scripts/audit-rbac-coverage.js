import fs from 'fs';
import path from 'path';

const routesDir = path.resolve(process.cwd(), 'src', 'routes');
const outputPath = path.resolve(process.cwd(), '..', 'docs', 'rbac-coverage.json');

const routeBlockRegex = /router\.(get|post|put|patch|delete|all)\s*\(([\s\S]*?)\)\s*;/g;

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

function analyzeRouteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const inheritedAuthenticate = /router\.use\(\s*[^)]*\bauthenticate\b/.test(content);
  const inheritedPolicy = /router\.use\(\s*[^)]*\bauthorizePolicy\s*\(/.test(content);

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
    const hasAuthenticate = inheritedAuthenticate || /\bauthenticate\b/.test(routeArgs);
    const hasAuthorizePolicy = inheritedPolicy || /\bauthorizePolicy\s*\(/.test(routeArgs);
    const hasLegacyAuthorize = /\bauthorize\s*\(/.test(routeArgs);

    routes.push({
      method,
      route: routePath,
      line: countLineNumber(content, match.index),
      isMutation,
      hasAuthenticate,
      hasAuthorizePolicy,
      hasLegacyAuthorize,
      status: !isMutation || !hasAuthenticate
        ? 'not_applicable'
        : hasAuthorizePolicy
          ? 'covered_policy'
          : hasLegacyAuthorize
            ? 'legacy_authorize'
            : 'missing_policy'
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
      protectedMutations: 0,
      coveredPolicy: 0,
      legacyAuthorize: 0,
      missingPolicy: 0
    },
    missingPolicyRoutes: [],
    files: []
  };

  for (const file of files) {
    const relativeFile = path.relative(path.resolve(process.cwd(), 'src'), file).replace(/\\/g, '/');
    const routes = analyzeRouteFile(file);

    for (const route of routes) {
      report.totals.routes += 1;
      if (route.isMutation && route.hasAuthenticate) {
        report.totals.protectedMutations += 1;
      }

      if (route.status === 'covered_policy') {
        report.totals.coveredPolicy += 1;
      } else if (route.status === 'legacy_authorize') {
        report.totals.legacyAuthorize += 1;
      } else if (route.status === 'missing_policy') {
        report.totals.missingPolicy += 1;
        report.missingPolicyRoutes.push({
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
  report.missingPolicyRoutes.sort((a, b) => {
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
  console.log(`RBAC coverage report written to ${outputPath}`);
  // eslint-disable-next-line no-console
  console.log(`Protected mutations: ${report.totals.protectedMutations}`);
  // eslint-disable-next-line no-console
  console.log(`Policy-covered: ${report.totals.coveredPolicy}`);
  // eslint-disable-next-line no-console
  console.log(`Legacy authorize: ${report.totals.legacyAuthorize}`);
  // eslint-disable-next-line no-console
  console.log(`Missing policy: ${report.totals.missingPolicy}`);
}

main();
