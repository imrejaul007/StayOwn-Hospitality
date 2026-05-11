import fs from 'fs';
import path from 'path';

const routesDir = path.resolve(process.cwd(), 'src', 'routes');
const outputPath = path.resolve(process.cwd(), '..', 'docs', 'route-inventory.json');

const routeRegex = /router\.(get|post|put|patch|delete|all)\(\s*['"`]([^'"`]+)['"`]/g;

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

function extractRoutes(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const routes = [];

  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      route: match[2]
    });
  }

  return routes;
}

function buildInventory() {
  const files = readRouteFiles(routesDir);
  const inventory = {
    generatedAt: new Date().toISOString(),
    routeFiles: files.length,
    totalRoutes: 0,
    files: []
  };

  for (const file of files) {
    const relative = path.relative(path.resolve(process.cwd(), 'src'), file).replace(/\\/g, '/');
    const routes = extractRoutes(file);
    inventory.totalRoutes += routes.length;
    inventory.files.push({
      file: relative,
      routes
    });
  }

  inventory.files.sort((a, b) => a.file.localeCompare(b.file));
  return inventory;
}

function main() {
  const inventory = buildInventory();
  fs.writeFileSync(outputPath, JSON.stringify(inventory, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Route inventory written to ${outputPath}`);
  // eslint-disable-next-line no-console
  console.log(`Files: ${inventory.routeFiles}, Routes: ${inventory.totalRoutes}`);
}

main();
