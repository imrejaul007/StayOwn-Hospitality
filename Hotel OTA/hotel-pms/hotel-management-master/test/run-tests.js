#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class TestRunner {
  constructor() {
    this.results = {
      backend: null,
      frontend: null,
      integration: null,
      performance: null,
      coverage: null
    };
    this.startTime = Date.now();
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (options.verbose) {
          process.stdout.write(data);
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        if (options.verbose) {
          process.stderr.write(data);
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ code, stdout, stderr });
        } else {
          reject({ code, stdout, stderr });
        }
      });

      child.on('error', (error) => {
        reject({ code: -1, stdout, stderr, error });
      });
    });
  }

  async checkPrerequisites() {
    this.log('\n🔍 Checking Prerequisites...', 'cyan');

    try {
      // Check Node.js version
      const { stdout: nodeVersion } = await this.runCommand('node', ['--version']);
      this.log(`✅ Node.js version: ${nodeVersion.trim()}`, 'green');

      // Check if MongoDB is running
      try {
        const { stdout: mongoStatus } = await this.runCommand('mongo', ['--eval', 'db.runCommand("ping")', '--quiet']);
        if (mongoStatus.includes('ok')) {
          this.log('✅ MongoDB is running', 'green');
        }
      } catch (error) {
        this.log('⚠️  MongoDB may not be running - some tests may fail', 'yellow');
      }

      // Check if Redis is available (optional)
      try {
        await this.runCommand('redis-cli', ['ping']);
        this.log('✅ Redis is available', 'green');
      } catch (error) {
        this.log('⚠️  Redis not available - caching tests will use mocks', 'yellow');
      }

      return true;
    } catch (error) {
      this.log(`❌ Prerequisites check failed: ${error.message}`, 'red');
      return false;
    }
  }

  async runTestSuite(suiteName, command, args = []) {
    this.log(`\n🧪 Running ${suiteName}...`, 'blue');
    const startTime = Date.now();

    try {
      const result = await this.runCommand(command, args, { verbose: true });
      const duration = Date.now() - startTime;

      // Parse Jest output for test results
      const testResults = this.parseJestOutput(result.stdout);

      this.results[suiteName.toLowerCase()] = {
        success: true,
        duration,
        ...testResults
      };

      this.log(`✅ ${suiteName} completed in ${duration}ms`, 'green');
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Parse error output for partial results
      const testResults = this.parseJestOutput(error.stdout + error.stderr);

      this.results[suiteName.toLowerCase()] = {
        success: false,
        duration,
        error: error.stderr || error.stdout,
        ...testResults
      };

      this.log(`❌ ${suiteName} failed after ${duration}ms`, 'red');
      return false;
    }
  }

  parseJestOutput(output) {
    const results = {
      tests: 0,
      passing: 0,
      failing: 0,
      skipped: 0,
      coverage: null
    };

    try {
      // Parse test counts
      const testMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
      if (testMatch) {
        results.failing = parseInt(testMatch[1]);
        results.passing = parseInt(testMatch[2]);
        results.tests = parseInt(testMatch[3]);
      } else {
        const passedMatch = output.match(/(\d+)\s+passed/);
        const failedMatch = output.match(/(\d+)\s+failed/);

        if (passedMatch) results.passing = parseInt(passedMatch[1]);
        if (failedMatch) results.failing = parseInt(failedMatch[1]);
        results.tests = results.passing + results.failing;
      }

      // Parse coverage
      const coverageMatch = output.match(/All files\s*\|\s*(\d+\.?\d*)/);
      if (coverageMatch) {
        results.coverage = parseFloat(coverageMatch[1]);
      }
    } catch (error) {
      // Ignore parsing errors
    }

    return results;
  }

  async generateReport() {
    this.log('\n📊 Generating Test Report...', 'magenta');

    const totalDuration = Date.now() - this.startTime;
    const report = {
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      results: this.results,
      summary: {
        totalTests: 0,
        totalPassing: 0,
        totalFailing: 0,
        overallSuccess: true,
        averageCoverage: 0
      }
    };

    // Calculate summary
    let coverageSum = 0;
    let coverageCount = 0;

    Object.values(this.results).forEach(result => {
      if (result) {
        report.summary.totalTests += result.tests || 0;
        report.summary.totalPassing += result.passing || 0;
        report.summary.totalFailing += result.failing || 0;

        if (!result.success) {
          report.summary.overallSuccess = false;
        }

        if (result.coverage) {
          coverageSum += result.coverage;
          coverageCount++;
        }
      }
    });

    if (coverageCount > 0) {
      report.summary.averageCoverage = coverageSum / coverageCount;
    }

    // Write report to file
    const reportPath = path.join(__dirname, 'test-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    // Display summary
    this.displaySummary(report);

    return report;
  }

  displaySummary(report) {
    this.log('\n' + '='.repeat(60), 'bright');
    this.log('📋 TEST SUMMARY REPORT', 'bright');
    this.log('='.repeat(60), 'bright');

    this.log(`⏱️  Total Duration: ${Math.round(report.duration / 1000)}s`, 'cyan');
    this.log(`🧪 Total Tests: ${report.summary.totalTests}`, 'blue');
    this.log(`✅ Passing: ${report.summary.totalPassing}`, 'green');
    this.log(`❌ Failing: ${report.summary.totalFailing}`, 'red');

    if (report.summary.averageCoverage > 0) {
      const coverageColor = report.summary.averageCoverage >= 80 ? 'green' :
                           report.summary.averageCoverage >= 70 ? 'yellow' : 'red';
      this.log(`📈 Average Coverage: ${report.summary.averageCoverage.toFixed(2)}%`, coverageColor);
    }

    this.log('\n📂 Test Suite Results:', 'bright');
    Object.entries(this.results).forEach(([suite, result]) => {
      if (result) {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        const statusColor = result.success ? 'green' : 'red';
        const duration = Math.round(result.duration / 1000);

        this.log(`  ${status} ${suite.toUpperCase()} (${result.tests || 0} tests, ${duration}s)`, statusColor);

        if (result.coverage) {
          const coverageColor = result.coverage >= 80 ? 'green' :
                               result.coverage >= 70 ? 'yellow' : 'red';
          this.log(`    📈 Coverage: ${result.coverage}%`, coverageColor);
        }
      }
    });

    const overallStatus = report.summary.overallSuccess ? '🎉 ALL TESTS PASSED' : '💥 SOME TESTS FAILED';
    const overallColor = report.summary.overallSuccess ? 'green' : 'red';

    this.log('\n' + '='.repeat(60), 'bright');
    this.log(overallStatus, overallColor);
    this.log('='.repeat(60), 'bright');

    if (!report.summary.overallSuccess) {
      this.log('\n❗ Check individual test outputs above for failure details', 'yellow');
    }
  }

  async run(args = []) {
    this.log('🚀 THE PENTOUZ Notification System - Test Runner', 'bright');
    this.log('=' .repeat(60), 'bright');

    const suiteOptions = {
      backend: args.includes('--backend') || args.includes('--all'),
      frontend: args.includes('--frontend') || args.includes('--all'),
      integration: args.includes('--integration') || args.includes('--all'),
      performance: args.includes('--performance') || args.includes('--all'),
      coverage: args.includes('--coverage') || args.includes('--all')
    };

    // If no specific suite is selected, run all
    if (!Object.values(suiteOptions).some(Boolean)) {
      Object.keys(suiteOptions).forEach(key => {
        suiteOptions[key] = true;
      });
    }

    // Check prerequisites
    const prerequisitesOk = await this.checkPrerequisites();
    if (!prerequisitesOk && !args.includes('--skip-prereq')) {
      this.log('\n❌ Prerequisites check failed. Use --skip-prereq to continue anyway.', 'red');
      process.exit(1);
    }

    // Run selected test suites
    let allPassed = true;

    if (suiteOptions.backend) {
      const success = await this.runTestSuite('Backend', 'npm', ['run', 'test:backend']);
      allPassed = allPassed && success;
    }

    if (suiteOptions.frontend) {
      const success = await this.runTestSuite('Frontend', 'npm', ['run', 'test:frontend']);
      allPassed = allPassed && success;
    }

    if (suiteOptions.integration) {
      const success = await this.runTestSuite('Integration', 'npm', ['run', 'test:integration']);
      allPassed = allPassed && success;
    }

    if (suiteOptions.performance) {
      const success = await this.runTestSuite('Performance', 'npm', ['run', 'test:performance']);
      allPassed = allPassed && success;
    }

    // Generate and display report
    const report = await this.generateReport();

    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
  }
}

// Handle command line execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new TestRunner();
  const args = process.argv.slice(2);

  // Handle help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🧪 THE PENTOUZ Notification System Test Runner

Usage: node run-tests.js [options]

Options:
  --all           Run all test suites (default if no specific suite selected)
  --backend       Run backend API tests only
  --frontend      Run frontend component tests only
  --integration   Run integration tests only
  --performance   Run performance tests only
  --coverage      Include coverage analysis
  --skip-prereq   Skip prerequisites check
  --help, -h      Show this help message

Examples:
  node run-tests.js --all
  node run-tests.js --backend --frontend
  node run-tests.js --integration --performance
  node run-tests.js --coverage
    `);
    process.exit(0);
  }

  runner.run(args).catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export default TestRunner;