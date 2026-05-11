import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const VALIDATION_REPORT = path.join(ROOT, '..', 'docs', 'validation-coverage.json');
const RBAC_REPORT = path.join(ROOT, '..', 'docs', 'rbac-coverage.json');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const assertZeroDrift = () => {
  const validation = readJson(VALIDATION_REPORT);
  const rbac = readJson(RBAC_REPORT);

  const missingValidation = validation.totals?.missingValidation ?? 0;
  const missingPolicy = rbac.totals?.missingPolicy ?? 0;
  const legacyAuthorize = rbac.totals?.legacyAuthorize ?? 0;

  const failures = [];
  if (missingValidation !== 0) failures.push(`missing validation routes: ${missingValidation}`);
  if (missingPolicy !== 0) failures.push(`missing RBAC policies: ${missingPolicy}`);
  if (legacyAuthorize !== 0) failures.push(`legacy authorize usage: ${legacyAuthorize}`);

  if (failures.length > 0) {
    throw new Error(`Program baseline drift detected (${failures.join(', ')})`);
  }

  return {
    validationCovered: validation.totals?.coveredValidation ?? 0,
    mutationRoutes: validation.totals?.mutationRoutes ?? 0,
    rbacCovered: rbac.totals?.coveredPolicy ?? 0,
    protectedMutations: rbac.totals?.protectedMutations ?? 0
  };
};

try {
  const result = assertZeroDrift();
  console.log('Program baseline verification passed.');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Program baseline verification failed.');
  console.error(error.message);
  process.exit(1);
}
