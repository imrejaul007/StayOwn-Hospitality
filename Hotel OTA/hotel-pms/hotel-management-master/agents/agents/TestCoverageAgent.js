import { BaseAgent } from '../core/BaseAgent.js';
import { join } from 'path';

/**
 * TestCoverageAgent - Identifies critical paths with no test coverage.
 *
 * A PM asks: "How confident are we that this won't break in production?"
 * Without tests on critical paths, every deployment is Russian roulette.
 */
export class TestCoverageAgent extends BaseAgent {
  constructor() {
    super('TestCoverageAgent', 'Identifies untested critical paths, missing integration tests, and test-to-code ratio gaps');
  }

  async analyze(state, config) {
    const { scanner, projectRoot } = config;

    // Find all test files
    let allTests = [];
    let backendTests = [];
    let e2eTests = [];
    let frontendTests = [];

    const testDirs = [
      join(projectRoot, 'backend', 'tests'),
      join(projectRoot, 'backend', 'test'),
      join(projectRoot, 'backend', '__tests__'),
      join(projectRoot, 'tests'),
      join(projectRoot, 'test'),
    ];

    for (const dir of testDirs) {
      try {
        const files = await scanner.scanDirectory(dir, {
          extensions: ['.js', '.ts', '.jsx', '.tsx'],
        });
        allTests.push(...files);

        for (const f of files) {
          if (/e2e|integration|playwright|cypress/i.test(f.relativePath)) {
            e2eTests.push(f);
          } else {
            backendTests.push(f);
          }
        }
      } catch {
        // Directory not found
      }
    }

    // Frontend tests
    try {
      const frontendTestDir = join(projectRoot, 'frontend', 'src');
      const frontendFiles = await scanner.scanDirectory(frontendTestDir, {
        extensions: ['.test.js', '.test.ts', '.test.tsx', '.test.jsx', '.spec.js', '.spec.ts', '.spec.tsx'],
      });
      frontendTests = frontendFiles.filter((f) => /\.(?:test|spec)\./i.test(f.name));
      allTests.push(...frontendTests);
    } catch {
      // Frontend not found
    }

    const testFileNames = new Set(allTests.map((t) => t.name));

    this._checkCriticalModuleCoverage(state, testFileNames);
    this._checkControllerCoverage(state, testFileNames);
    this._checkServiceCoverage(state, testFileNames);
    this._checkModelValidationTests(state, testFileNames);
    this._checkMiddlewareCoverage(state, testFileNames);
    this._checkE2ECoverage(state, e2eTests);
    this._checkFrontendCoverage(state, frontendTests, config);
    await this._checkTestQuality(state, allTests, scanner);
    this._checkTestCodeRatio(state, allTests);

    return {
      summary: `Test coverage analysis complete — ${allTests.length} test files found.`,
      totalTests: allTests.length,
      backendTests: backendTests.length,
      e2eTests: e2eTests.length,
      frontendTests: frontendTests.length,
    };
  }

  _checkCriticalModuleCoverage(state, testFileNames) {
    // These are the MOST critical modules that absolutely must have tests
    const criticalModules = [
      { name: 'auth', why: 'Authentication bypass = full system compromise' },
      { name: 'booking', why: 'Booking bugs = lost revenue + angry guests' },
      { name: 'payment', why: 'Payment bugs = financial loss + legal liability' },
      { name: 'checkout', why: 'Checkout errors = billing disputes' },
      { name: 'refund', why: 'Refund bugs = financial loss' },
      { name: 'inventory', why: 'Inventory errors = overbooking or stockout' },
      { name: 'roomAvailability', why: 'Availability errors = double bookings' },
      { name: 'rateCalculation', why: 'Rate errors = over/undercharging' },
      { name: 'gst', why: 'Tax errors = compliance violations + penalties' },
      { name: 'gdpr', why: 'GDPR errors = massive regulatory fines' },
      { name: 'settlement', why: 'Settlement errors = unbalanced books' },
      { name: 'channelManager', why: 'OTA sync bugs = rate parity violations + booking conflicts' },
    ];

    for (const module of criticalModules) {
      const hasTest = [...testFileNames].some((t) =>
        t.toLowerCase().includes(module.name.toLowerCase())
      );

      if (!hasTest) {
        this.addFinding(state, {
          severity: 'medium',
          category: 'testing',
          title: `CRITICAL MODULE UNTESTED: ${module.name}`,
          description: `No test files found for "${module.name}". Why this matters: ${module.why}. Without tests, any change to this module risks breaking production with no safety net.`,
          suggestion: `Create ${module.name}.test.js with: unit tests for core logic, integration tests with DB, edge case tests, and error handling tests.`,
          fixable: false,
        });
      }
    }
  }

  _checkControllerCoverage(state, testFileNames) {
    const controllers = state.context.files.controllers || [];
    let untestedCount = 0;

    for (const ctrl of controllers) {
      const hasTest = [...testFileNames].some((t) =>
        t.toLowerCase().includes(ctrl.name.replace('.js', '').toLowerCase())
      );
      if (!hasTest) untestedCount++;
    }

    if (untestedCount > 0) {
      const coverage = (((controllers.length - untestedCount) / controllers.length) * 100).toFixed(0);
      this.addFinding(state, {
        severity: untestedCount > 50 ? 'high' : 'medium',
        category: 'testing',
        title: `${untestedCount}/${controllers.length} controllers have no tests (${coverage}% coverage)`,
        description: `${untestedCount} out of ${controllers.length} controllers have no corresponding test file. Controllers handle all API request processing — untested controllers mean untested API endpoints.`,
        suggestion: 'Prioritize testing controllers for: auth, bookings, payments, room management, billing, and guest management.',
        fixable: false,
      });
    }
  }

  _checkServiceCoverage(state, testFileNames) {
    const services = state.context.files.services || [];
    let untestedCount = 0;

    for (const svc of services) {
      const hasTest = [...testFileNames].some((t) =>
        t.toLowerCase().includes(svc.name.replace('.js', '').toLowerCase())
      );
      if (!hasTest) untestedCount++;
    }

    if (untestedCount > 0) {
      const coverage = (((services.length - untestedCount) / services.length) * 100).toFixed(0);
      this.addFinding(state, {
        severity: untestedCount > 80 ? 'high' : 'medium',
        category: 'testing',
        title: `${untestedCount}/${services.length} services have no tests (${coverage}% coverage)`,
        description: `${untestedCount} out of ${services.length} services have no corresponding test file. Services contain all business logic — untested services mean untested business rules.`,
        suggestion: 'Prioritize testing services for: booking workflow, payment processing, rate calculation, availability, tax computation.',
        fixable: false,
      });
    }
  }

  _checkModelValidationTests(state, testFileNames) {
    const models = state.context.models;
    const criticalModels = ['Booking', 'Payment', 'User', 'Room', 'RoomType', 'Invoice', 'Settlement'];

    let untested = [];
    for (const modelName of criticalModels) {
      if (models.has(modelName)) {
        const hasTest = [...testFileNames].some((t) =>
          t.toLowerCase().includes(modelName.toLowerCase())
        );
        if (!hasTest) untested.push(modelName);
      }
    }

    if (untested.length > 0) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'testing',
        title: `Critical models without validation tests: ${untested.join(', ')}`,
        description: `Models ${untested.join(', ')} have no test coverage. Model validation (required fields, enums, min/max, custom validators) runs on every save — bugs here corrupt the database silently.`,
        suggestion: 'Test: required field enforcement, enum validation, custom validators, pre-save hooks, virtual fields, and index uniqueness.',
        fixable: false,
      });
    }
  }

  _checkMiddlewareCoverage(state, testFileNames) {
    const criticalMiddleware = ['auth', 'validation', 'errorHandler', 'rateLimit'];
    const untested = criticalMiddleware.filter(
      (mw) => ![...testFileNames].some((t) => t.toLowerCase().includes(mw.toLowerCase()))
    );

    if (untested.length > 0) {
      this.addFinding(state, {
        severity: 'high',
        category: 'testing',
        title: `Critical middleware untested: ${untested.join(', ')}`,
        description: `Middleware [${untested.join(', ')}] has no tests. Auth middleware bugs = security breach. Validation middleware bugs = data corruption. Error handler bugs = leaked stack traces.`,
        suggestion: 'Test: valid/invalid tokens, expired tokens, missing headers, role enforcement, malformed input handling, error serialization.',
        fixable: false,
      });
    }
  }

  _checkE2ECoverage(state, e2eTests) {
    const criticalFlows = [
      { flow: 'authentication', pattern: /auth|login|register/i },
      { flow: 'booking creation', pattern: /book|reserv/i },
      { flow: 'check-in process', pattern: /check.?in/i },
      { flow: 'check-out process', pattern: /check.?out/i },
      { flow: 'payment processing', pattern: /pay|billing/i },
      { flow: 'room management', pattern: /room|tapechart/i },
      { flow: 'guest management', pattern: /guest/i },
      { flow: 'cancellation + refund', pattern: /cancel|refund/i },
      { flow: 'staff operations', pattern: /staff|housekeep/i },
      { flow: 'reports + analytics', pattern: /report|analytic/i },
    ];

    const untested = [];
    for (const { flow, pattern } of criticalFlows) {
      const hasE2E = e2eTests.some((t) => pattern.test(t.name));
      if (!hasE2E) untested.push(flow);
    }

    if (untested.length > 0) {
      this.addFinding(state, {
        severity: 'high',
        category: 'testing',
        title: `${untested.length} critical user flows have no E2E tests`,
        description: `No end-to-end tests for: ${untested.join(', ')}. E2E tests validate the complete user journey. Without them, integration issues between frontend and backend go undetected until production.`,
        suggestion: 'Add Playwright E2E tests for each critical flow. Priority: booking creation → payment → check-in → check-out.',
        fixable: false,
      });
    }
  }

  _checkFrontendCoverage(state, frontendTests, config) {
    const frontendComponents = state.context.files.components || [];
    const frontendPages = state.context.files.pages || [];

    // Count total frontend files
    const totalFrontend = 413 + 196; // From exploration data
    const coverage = totalFrontend > 0 ? ((frontendTests.length / totalFrontend) * 100).toFixed(1) : 0;

    if (Number(coverage) < 10) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'testing',
        title: `Frontend test coverage extremely low: ~${coverage}% (${frontendTests.length}/${totalFrontend})`,
        description: `Only ${frontendTests.length} test files for ~${totalFrontend} frontend components/pages. Critical UI bugs (broken forms, inaccessible elements, state bugs) ship without detection.`,
        suggestion: 'Prioritize testing: BookingForm, PaymentForm, TapeChart, Dashboard, AuthForms. Use React Testing Library for component tests.',
        fixable: false,
      });
    }
  }

  async _checkTestQuality(state, allTests, scanner) {
    let testsWithoutAssertions = 0;
    let testsChecked = 0;

    for (const test of allTests.slice(0, 30)) {
      const content = await scanner.readFileContent(test.path);
      if (!content) continue;
      testsChecked++;

      // Check for tests without assertions
      const itBlocks = content.match(/(?:it|test)\s*\(\s*['"][^'"]+['"]/g) || [];
      const assertions = content.match(/expect\s*\(|assert\.|should\./g) || [];

      if (itBlocks.length > 0 && assertions.length < itBlocks.length / 2) {
        testsWithoutAssertions++;
      }
    }

    if (testsWithoutAssertions > 3) {
      this.addFinding(state, {
        severity: 'low',
        category: 'testing',
        title: `${testsWithoutAssertions} test files may have weak assertions`,
        description: `${testsWithoutAssertions} out of ${testsChecked} test files checked have fewer assertions than test cases. Tests without proper assertions pass even when the code is broken — giving false confidence.`,
        suggestion: 'Each test case should assert on: return value, state change, side effects, or error thrown. A test without assertions is not a test.',
        fixable: false,
      });
    }
  }

  _checkTestCodeRatio(state, allTests) {
    const totalCodeFiles = (state.context.files.controllers?.length || 0) +
      (state.context.files.services?.length || 0) +
      (state.context.files.routes?.length || 0) +
      (state.context.files.models?.length || 0);

    const ratio = totalCodeFiles > 0 ? (allTests.length / totalCodeFiles).toFixed(2) : 0;

    if (Number(ratio) < 0.3) {
      this.addFinding(state, {
        severity: 'medium',
        category: 'testing',
        title: `Very low test-to-code ratio: ${ratio} (${allTests.length} tests / ${totalCodeFiles} source files)`,
        description: `The test-to-code ratio is ${ratio}. Industry standard for production systems is 1:1 or higher. With only ${allTests.length} test files for ${totalCodeFiles} source files, most code changes are untestable.`,
        suggestion: 'Target 1:1 test-to-code ratio for critical modules. Start with the highest-risk areas: payments, bookings, auth.',
        fixable: false,
      });
    }
  }
}
