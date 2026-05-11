// Lists admin TSX files whose basename is not referenced in App.tsx. Run: node scripts/list-unrouted-admin-pages.cjs
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../frontend');
const appPath = path.join(root, 'src/App.tsx');
const extraRoutesPath = path.join(root, 'src/routes/AdminUnroutedRoutes.tsx');
const adminDir = path.join(root, 'src/pages/admin');

const app = fs.readFileSync(appPath, 'utf8');
const extraRoutes = fs.existsSync(extraRoutesPath) ? fs.readFileSync(extraRoutesPath, 'utf8') : '';
const routedSource = app + extraRoutes;

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const files = walk(adminDir);
const unrouted = files.filter((f) => {
  const base = path.basename(f, '.tsx');
  return !routedSource.includes(base);
});

console.log(JSON.stringify({ total: files.length, unrouted: unrouted.length, files: unrouted.map((f) => path.relative(root, f).replace(/\\/g, '/')) }, null, 2));
