import fs from 'fs/promises';
import path from 'path';
import 'dotenv/config';

const baseUrl = process.env.PILOT_BASE_URL || 'http://localhost:4000';
const token = process.env.PILOT_TOKEN || '';
const outputDir = path.join(process.cwd(), '..', 'docs', 'evidence');
const outputFile = path.join(outputDir, 'pilot-precheck.json');

const requestJson = async (url, requireAuth = false) => {
  const headers = {};
  if (requireAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  const bodyText = await response.text();

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    body = bodyText;
  }

  return {
    url,
    status: response.status,
    ok: response.ok,
    requiresAuth: requireAuth,
    body
  };
};

const main = async () => {
  await fs.mkdir(outputDir, { recursive: true });

  const checks = [];
  const startedAt = new Date().toISOString();

  const endpoints = [
    { path: '/health', auth: false },
    { path: '/api/versions', auth: false },
    { path: '/health/detailed', auth: true },
    { path: '/health/metrics', auth: true },
    { path: '/health/queue', auth: true }
  ];

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint.path}`;
    try {
      const result = await requestJson(url, endpoint.auth);
      if (endpoint.auth && !token && result.status === 401) {
        result.ok = true;
        result.note = 'Auth endpoint returned 401 as expected without PILOT_TOKEN';
      }
      checks.push(result);
    } catch (error) {
      checks.push({
        url,
        ok: false,
        status: 0,
        error: error.message
      });
    }
  }

  const hasFailure = checks.some((check) => !check.ok);
  const summary = {
    startedAt,
    completedAt: new Date().toISOString(),
    baseUrl,
    hasPilotToken: !!token,
    status: hasFailure ? 'failed' : 'passed',
    checks
  };

  await fs.writeFile(outputFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(`Pilot precheck ${summary.status}. Evidence written to ${outputFile}`);

  if (hasFailure) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('Pilot precheck failed unexpectedly:', error.message);
  process.exit(1);
});
