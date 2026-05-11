import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const outputDir = path.join(process.cwd(), '..', 'docs', 'evidence');
const outputFile = path.join(outputDir, 'backup-drill-precheck.json');

const ensureMongoToolsOnPath = () => {
  if (process.platform !== 'win32') return;

  const mongoToolsPath = 'C:\\Program Files\\MongoDB\\Tools\\100\\bin';
  const pathEntries = (process.env.PATH || '').split(';').map((entry) => entry.trim().toLowerCase());

  if (!pathEntries.includes(mongoToolsPath.toLowerCase())) {
    process.env.PATH = `${mongoToolsPath};${process.env.PATH || ''}`;
  }
};

const checkBinary = (name, args = ['--version']) => {
  const result = spawnSync(name, args, { encoding: 'utf8' });
  return {
    name,
    ok: result.status === 0,
    status: result.status ?? -1,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  };
};

const main = async () => {
  ensureMongoToolsOnPath();
  await fs.mkdir(outputDir, { recursive: true });

  const envChecks = {
    MONGO_URI: !!process.env.MONGO_URI,
    BACKUP_DIR: !!process.env.BACKUP_DIR,
    AWS_S3_BACKUP_ENABLED: process.env.AWS_S3_BACKUP_ENABLED || 'false'
  };

  const binaryChecks = [
    checkBinary('mongodump'),
    checkBinary('mongorestore'),
    checkBinary('tar', ['--version'])
  ];

  const hasBinaryFailure = binaryChecks.some((check) => !check.ok);
  const hasEnvFailure = !envChecks.MONGO_URI;
  const status = hasBinaryFailure || hasEnvFailure ? 'failed' : 'passed';

  const summary = {
    startedAt: new Date().toISOString(),
    status,
    envChecks,
    binaryChecks
  };

  await fs.writeFile(outputFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`Backup drill precheck ${status}. Evidence written to ${outputFile}`);

  if (status !== 'passed') {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('Backup drill precheck failed unexpectedly:', error.message);
  process.exit(1);
});
