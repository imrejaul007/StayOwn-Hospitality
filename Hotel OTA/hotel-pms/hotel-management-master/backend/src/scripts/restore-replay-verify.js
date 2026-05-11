#!/usr/bin/env node
/**
 * Expanded Restore Replay Verification
 * Performs mongodump → mongorestore to an isolated test database, then validates key collections.
 * 
 * Usage: npm run drill:restore-replay
 * Requires: MONGO_URI in .env, MongoDB Database Tools on PATH
 */
import 'dotenv/config';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVIDENCE_DIR = path.resolve(__dirname, '../../../docs/evidence');
const BACKUP_DIR = process.env.BACKUP_DIR || './backups/drill';

if (process.platform === 'win32') {
  const mongoToolsPath = 'C:\\Program Files\\MongoDB\\Tools\\100\\bin';
  if (!process.env.PATH.includes(mongoToolsPath)) {
    process.env.PATH = mongoToolsPath + ';' + process.env.PATH;
  }
}

const results = {
  startedAt: new Date().toISOString(),
  mongoUri: process.env.MONGO_URI ? '***configured***' : 'MISSING',
  steps: [],
  status: 'running'
};

function step(name, fn) {
  const s = { name, startedAt: new Date().toISOString(), passed: false };
  try {
    const detail = fn();
    s.passed = true;
    s.detail = detail || 'ok';
  } catch (err) {
    s.passed = false;
    s.detail = err.message;
  }
  s.completedAt = new Date().toISOString();
  results.steps.push(s);
  console.log(`  [${s.passed ? 'PASS' : 'FAIL'}] ${name}: ${s.detail}`);
  return s.passed;
}

function runBin(bin, args, timeout = 600000) {
  try {
    return execFileSync(bin, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
      windowsHide: true
    });
  } catch (err) {
    const stderr = err?.stderr?.toString()?.trim();
    const stdout = err?.stdout?.toString()?.trim();
    throw new Error(stderr || stdout || err.message);
  }
}

async function main() {
  console.log('\n=== Restore Replay Verification ===\n');

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }

  const uri = process.env.MONGO_URI;
  const dbMatch = uri.match(/\/([^/?]+)(\?|$)/);
  const sourceDb = dbMatch ? dbMatch[1] : 'hotel_management';
  // Atlas limits DB names to 38 chars. Keep replay DB short.
  const replayDb = `hm_rr_${Date.now().toString().slice(-8)}`;
  const criticalCollections = ['users', 'bookings', 'rooms', 'invoices', 'payments'];
  const criticalNs = criticalCollections.map((c) => `${sourceDb}.${c}`);

  console.log(`Source DB: ${sourceDb}`);
  console.log(`Replay DB: ${replayDb} (isolated)\n`);

  // Step 1: Verify tools
  step('Verify mongodump available', () => {
    runBin('mongodump', ['--version'], 30000);
    return 'found';
  });

  step('Verify mongorestore available', () => {
    runBin('mongorestore', ['--version'], 30000);
    return 'found';
  });

  // Step 2: Create focused dump for critical collections only
  const dumpDir = path.join(BACKUP_DIR, `replay-${Date.now()}`);
  const dumpDbDir = path.join(dumpDir, sourceDb);
  step('Create fresh mongodump from source', () => {
    fs.mkdirSync(dumpDir, { recursive: true });
    criticalCollections.forEach((collection) => {
      runBin('mongodump', [
        '--uri', uri,
        '--db', sourceDb,
        '--collection', collection,
        '--out', dumpDir,
        '--numParallelCollections', '1'
      ]);
    });
    const dumpedFiles = fs.existsSync(dumpDbDir) ? fs.readdirSync(dumpDbDir).filter((f) => f.endsWith('.bson')).length : 0;
    if (dumpedFiles === 0) throw new Error('No BSON files were dumped');
    return `dumped ${dumpedFiles} collections to ${dumpDbDir}`;
  });

  // Step 3: Restore to isolated database
  step('Restore to isolated replay database', () => {
    const restoreUri = uri.replace(`/${sourceDb}`, `/${replayDb}`);
    runBin('mongorestore', [
      '--uri', restoreUri,
      '--db', replayDb,
      dumpDbDir,
      '--drop',
      '--numParallelCollections', '1'
    ]);
    return `restored to ${replayDb}`;
  });

  // Step 4: Validate restored collections exist
  step('Validate restored collections', () => {
    const restoreUri = uri.replace(`/${sourceDb}`, `/${replayDb}`);
    const scriptFile = path.join(dumpDir, '_validate.mjs');
    fs.writeFileSync(scriptFile, `
import { MongoClient } from 'mongodb';
const client = await MongoClient.connect('${restoreUri}');
const db = client.db('${replayDb}');
const collections = await db.listCollections().toArray();
const names = collections.map(c => c.name);
const required = ['bookings', 'users', 'rooms', 'invoices', 'payments'];
const found = required.filter(r => names.includes(r));
const missing = required.filter(r => !names.includes(r));
if (missing.length) {
  throw new Error('Missing required collections: ' + missing.join(', '));
}
console.log(JSON.stringify({ totalCollections: names.length, found, missing }));
await client.close();
`);
    const out = runBin('node', [scriptFile], 60000).toString().trim();
    return out || 'validated';
  });

  // Step 5: Drop replay database (cleanup)
  step('Cleanup replay database', () => {
    const restoreUri = uri.replace(`/${sourceDb}`, `/${replayDb}`);
    const scriptFile = path.join(dumpDir, '_drop.mjs');
    fs.writeFileSync(scriptFile, `
import { MongoClient } from 'mongodb';
const client = await MongoClient.connect('${restoreUri}');
await client.db('${replayDb}').dropDatabase();
await client.close();
console.log('dropped');
`);
    const out = runBin('node', [scriptFile], 60000).toString().trim();
    return out || 'cleaned up';
  });

  results.completedAt = new Date().toISOString();
  const allPassed = results.steps.every(s => s.passed);
  results.status = allPassed ? 'passed' : 'failed';

  console.log(`\n=== Summary: ${results.status.toUpperCase()} ===`);
  console.log(`Steps: ${results.steps.length} | Passed: ${results.steps.filter(s => s.passed).length} | Failed: ${results.steps.filter(s => !s.passed).length}`);

  if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const outPath = path.join(EVIDENCE_DIR, 'restore-replay-results.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Evidence: ${outPath}`);

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
