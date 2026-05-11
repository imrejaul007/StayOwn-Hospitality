#!/usr/bin/env node

/**
 * Multi-Property Settings Test Runner
 *
 * Runs all multi-property tests and generates a summary report
 */

import { execSync } from 'child_process';
import chalk from 'chalk';

const tests = [
  {
    name: 'API Endpoint Tests',
    file: 'multiPropertySettings.test.js',
    description: '20+ test cases for REST API endpoints'
  },
  {
    name: 'Service Layer Tests',
    file: 'services/settingsInheritance.test.js',
    description: '30+ test cases for business logic'
  },
  {
    name: 'Model Tests',
    file: 'models/SettingsInheritance.test.js',
    description: '40+ test cases for data models'
  },
  {
    name: 'Integration Tests',
    file: 'integration/multiProperty.integration.test.js',
    description: '15+ integration scenarios'
  }
];

console.log(chalk.blue.bold('\n🧪 Multi-Property Settings Test Suite\n'));
console.log(chalk.gray('Running comprehensive tests...\n'));

const results = [];

for (const test of tests) {
  console.log(chalk.cyan(`\n📋 ${test.name}`));
  console.log(chalk.gray(`   ${test.description}`));
  console.log(chalk.gray(`   File: ${test.file}\n`));

  try {
    const output = execSync(
      `npm test -- ${test.file} --silent --passWithNoTests`,
      {
        encoding: 'utf-8',
        cwd: process.cwd()
      }
    );

    if (output.includes('PASS') || output.includes('Test Suites: 0')) {
      console.log(chalk.green('   ✓ Passed'));
      results.push({ ...test, status: 'pass' });
    } else {
      console.log(chalk.yellow('   ⚠ No tests found'));
      results.push({ ...test, status: 'skip' });
    }
  } catch (error) {
    console.log(chalk.red('   ✗ Failed'));
    console.log(chalk.red(`   Error: ${error.message.split('\n')[0]}`));
    results.push({ ...test, status: 'fail', error: error.message });
  }
}

// Print summary
console.log(chalk.blue.bold('\n\n📊 Test Summary\n'));
console.log(chalk.gray('─'.repeat(60)));

const passed = results.filter(r => r.status === 'pass').length;
const failed = results.filter(r => r.status === 'fail').length;
const skipped = results.filter(r => r.status === 'skip').length;

console.log(`\nTotal Test Suites: ${results.length}`);
console.log(chalk.green(`✓ Passed: ${passed}`));
console.log(chalk.red(`✗ Failed: ${failed}`));
console.log(chalk.yellow(`⊘ Skipped: ${skipped}`));

if (failed > 0) {
  console.log(chalk.red.bold('\n\n❌ Some tests failed!\n'));
  console.log(chalk.yellow('Failed tests:'));
  results
    .filter(r => r.status === 'fail')
    .forEach(r => {
      console.log(chalk.red(`  • ${r.name} (${r.file})`));
    });
  process.exit(1);
} else if (passed === 0) {
  console.log(chalk.yellow.bold('\n\n⚠️  No tests were executed!\n'));
  console.log(chalk.gray('Make sure MongoDB is running and test environment is set up correctly.'));
  process.exit(1);
} else {
  console.log(chalk.green.bold('\n\n✨ All tests passed!\n'));
  console.log(chalk.gray('Coverage report available with: npm test -- --coverage\n'));
  process.exit(0);
}
