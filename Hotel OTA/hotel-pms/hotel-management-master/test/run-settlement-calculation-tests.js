/**
 * Settlement Calculation Validation Test Runner
 *
 * This script runs all calculation validation tests for the Settlement system
 * and generates comprehensive reports on financial accuracy and validation coverage.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const testConfig = {
  testFiles: [
    'settlement-calculation-validation-e2e-test.js',
    'payment-processing-accuracy-integration-test.js',
    'stripe-integration-calculation-validation-test.js'
  ],
  timeout: 300000, // 5 minutes per test suite
  parallel: false, // Run tests sequentially for financial accuracy
  outputDir: './test-reports',
  reportFormats: ['json', 'html', 'csv']
};

class SettlementTestRunner {
  constructor() {
    this.results = {
      startTime: new Date(),
      endTime: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      testSuites: [],
      financialAccuracyScore: 0,
      validationCoverage: 0,
      errors: [],
      warnings: []
    };

    this.createOutputDirectory();
  }

  async runAllTests() {
    console.log('🧮 Starting Settlement Calculation Validation Test Suite');
    console.log('=' * 60);
    console.log(`📅 Start Time: ${this.results.startTime.toISOString()}`);
    console.log(`📂 Output Directory: ${testConfig.outputDir}`);
    console.log('=' * 60);

    try {
      for (const testFile of testConfig.testFiles) {
        await this.runTestSuite(testFile);
      }

      this.calculateOverallScores();
      await this.generateReports();

      console.log('\n🎯 Settlement Calculation Validation Test Results:');
      console.log(`✅ Passed: ${this.results.passedTests}`);
      console.log(`❌ Failed: ${this.results.failedTests}`);
      console.log(`⏭️  Skipped: ${this.results.skippedTests}`);
      console.log(`📊 Financial Accuracy Score: ${this.results.financialAccuracyScore}%`);
      console.log(`📈 Validation Coverage: ${this.results.validationCoverage}%`);

      if (this.results.failedTests > 0) {
        console.log('\n⚠️  CRITICAL: Financial calculation errors detected!');
        console.log('🔍 Review failed tests immediately to prevent financial discrepancies.');
        process.exit(1);
      } else {
        console.log('\n🎉 All calculation validation tests passed!');
        console.log('💰 Financial integrity maintained across all scenarios.');
      }

    } catch (error) {
      console.error('💥 Test runner failed:', error);
      process.exit(1);
    }
  }

  async runTestSuite(testFile) {
    console.log(`\n📋 Running: ${testFile}`);
    console.log('-' * 40);

    const startTime = new Date();
    const testResult = {
      name: testFile,
      startTime,
      endTime: null,
      duration: 0,
      status: 'running',
      tests: [],
      errors: [],
      warnings: [],
      coverage: {
        calculationScenarios: 0,
        edgeCases: 0,
        businessRules: 0,
        integrationPoints: 0
      }
    };

    try {
      // Run the test file using Mocha
      const mochaProcess = await this.executeMochaTest(testFile);

      testResult.endTime = new Date();
      testResult.duration = testResult.endTime - testResult.startTime;
      testResult.status = mochaProcess.success ? 'passed' : 'failed';

      // Parse test results
      this.parseTestResults(mochaProcess.output, testResult);

      // Update overall results
      this.results.totalTests += testResult.tests.length;
      this.results.passedTests += testResult.tests.filter(t => t.status === 'passed').length;
      this.results.failedTests += testResult.tests.filter(t => t.status === 'failed').length;
      this.results.skippedTests += testResult.tests.filter(t => t.status === 'skipped').length;

      this.results.testSuites.push(testResult);

      console.log(`✅ Completed: ${testFile} (${testResult.duration}ms)`);

    } catch (error) {
      testResult.status = 'error';
      testResult.errors.push(error.message);
      this.results.errors.push(`${testFile}: ${error.message}`);

      console.log(`❌ Failed: ${testFile} - ${error.message}`);
    }
  }

  async executeMochaTest(testFile) {
    return new Promise((resolve, reject) => {
      const testPath = path.join(process.cwd(), 'test', testFile);
      const mocha = spawn('npx', [
        'mocha',
        testPath,
        '--timeout', testConfig.timeout.toString(),
        '--reporter', 'json',
        '--require', '@babel/register'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      mocha.stdout.on('data', (data) => {
        output += data.toString();
      });

      mocha.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      mocha.on('close', (code) => {
        try {
          const results = JSON.parse(output);
          resolve({
            success: code === 0,
            output: results,
            errorOutput
          });
        } catch (parseError) {
          reject(new Error(`Failed to parse test output: ${parseError.message}`));
        }
      });

      mocha.on('error', (error) => {
        reject(error);
      });
    });
  }

  parseTestResults(mochaOutput, testResult) {
    if (!mochaOutput || !mochaOutput.tests) {
      return;
    }

    for (const test of mochaOutput.tests) {
      const parsedTest = {
        title: test.title,
        fullTitle: test.fullTitle,
        duration: test.duration,
        status: test.state || 'unknown',
        error: test.err ? test.err.message : null,
        calculationType: this.identifyCalculationType(test.title),
        financialImpact: this.assessFinancialImpact(test.title)
      };

      testResult.tests.push(parsedTest);

      // Update coverage metrics
      this.updateCoverageMetrics(parsedTest, testResult);
    }
  }

  identifyCalculationType(testTitle) {
    const lowerTitle = testTitle.toLowerCase();

    if (lowerTitle.includes('outstanding') || lowerTitle.includes('balance')) {
      return 'outstanding_balance';
    } else if (lowerTitle.includes('refund')) {
      return 'refund_calculation';
    } else if (lowerTitle.includes('payment') || lowerTitle.includes('total')) {
      return 'payment_total';
    } else if (lowerTitle.includes('adjustment')) {
      return 'adjustment_calculation';
    } else if (lowerTitle.includes('tax')) {
      return 'tax_calculation';
    } else if (lowerTitle.includes('fee')) {
      return 'fee_calculation';
    } else if (lowerTitle.includes('currency') || lowerTitle.includes('conversion')) {
      return 'currency_conversion';
    } else if (lowerTitle.includes('precision') || lowerTitle.includes('decimal')) {
      return 'precision_handling';
    } else {
      return 'general_validation';
    }
  }

  assessFinancialImpact(testTitle) {
    const lowerTitle = testTitle.toLowerCase();

    if (lowerTitle.includes('large') || lowerTitle.includes('million') || lowerTitle.includes('lakh')) {
      return 'high';
    } else if (lowerTitle.includes('refund') || lowerTitle.includes('adjustment')) {
      return 'medium';
    } else if (lowerTitle.includes('precision') || lowerTitle.includes('decimal')) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  updateCoverageMetrics(test, testResult) {
    const calculationTypes = {
      'outstanding_balance': 'calculationScenarios',
      'refund_calculation': 'calculationScenarios',
      'payment_total': 'calculationScenarios',
      'adjustment_calculation': 'calculationScenarios',
      'tax_calculation': 'calculationScenarios',
      'precision_handling': 'edgeCases',
      'currency_conversion': 'edgeCases',
      'fee_calculation': 'integrationPoints'
    };

    const category = calculationTypes[test.calculationType] || 'businessRules';
    testResult.coverage[category]++;
  }

  calculateOverallScores() {
    // Calculate financial accuracy score
    const totalCriticalTests = this.results.testSuites.reduce((sum, suite) => {
      return sum + suite.tests.filter(t =>
        t.financialImpact === 'high' || t.calculationType.includes('calculation')
      ).length;
    }, 0);

    const passedCriticalTests = this.results.testSuites.reduce((sum, suite) => {
      return sum + suite.tests.filter(t =>
        (t.financialImpact === 'high' || t.calculationType.includes('calculation')) &&
        t.status === 'passed'
      ).length;
    }, 0);

    this.results.financialAccuracyScore = totalCriticalTests > 0
      ? Math.round((passedCriticalTests / totalCriticalTests) * 100)
      : 0;

    // Calculate validation coverage
    const totalCoverageAreas = this.results.testSuites.reduce((sum, suite) => {
      const coverage = suite.coverage;
      return sum + Object.values(coverage).reduce((a, b) => a + b, 0);
    }, 0);

    const expectedCoverageAreas = 50; // Expected number of coverage areas
    this.results.validationCoverage = Math.min(100, Math.round((totalCoverageAreas / expectedCoverageAreas) * 100));

    this.results.endTime = new Date();
  }

  async generateReports() {
    console.log('\n📊 Generating test reports...');

    // JSON Report
    await this.generateJSONReport();

    // HTML Report
    await this.generateHTMLReport();

    // CSV Report
    await this.generateCSVReport();

    // Financial Accuracy Report
    await this.generateFinancialAccuracyReport();

    console.log(`📁 Reports generated in: ${testConfig.outputDir}`);
  }

  async generateJSONReport() {
    const reportData = {
      summary: {
        startTime: this.results.startTime,
        endTime: this.results.endTime,
        duration: this.results.endTime - this.results.startTime,
        totalTests: this.results.totalTests,
        passedTests: this.results.passedTests,
        failedTests: this.results.failedTests,
        skippedTests: this.results.skippedTests,
        financialAccuracyScore: this.results.financialAccuracyScore,
        validationCoverage: this.results.validationCoverage
      },
      testSuites: this.results.testSuites,
      errors: this.results.errors,
      warnings: this.results.warnings
    };

    const filePath = path.join(testConfig.outputDir, 'settlement-calculation-validation-report.json');
    await fs.promises.writeFile(filePath, JSON.stringify(reportData, null, 2));
  }

  async generateHTMLReport() {
    const htmlContent = this.generateHTMLContent();
    const filePath = path.join(testConfig.outputDir, 'settlement-calculation-validation-report.html');
    await fs.promises.writeFile(filePath, htmlContent);
  }

  generateHTMLContent() {
    const passRate = this.results.totalTests > 0
      ? Math.round((this.results.passedTests / this.results.totalTests) * 100)
      : 0;

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Settlement Calculation Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .header { background: linear-gradient(135deg, #2c3e50, #3498db); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .metric { background: white; padding: 15px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; color: #2c3e50; }
        .metric-label { color: #7f8c8d; margin-top: 5px; }
        .test-suite { background: white; margin-bottom: 15px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .suite-header { background: #34495e; color: white; padding: 15px; font-weight: bold; }
        .test-item { padding: 10px 15px; border-bottom: 1px solid #ecf0f1; display: flex; justify-content: space-between; align-items: center; }
        .test-item:last-child { border-bottom: none; }
        .test-status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; }
        .status-passed { background: #27ae60; }
        .status-failed { background: #e74c3c; }
        .status-skipped { background: #f39c12; }
        .financial-impact { padding: 2px 6px; border-radius: 3px; font-size: 0.7em; margin-left: 5px; }
        .impact-high { background: #e74c3c; color: white; }
        .impact-medium { background: #f39c12; color: white; }
        .impact-low { background: #95a5a6; color: white; }
        .critical-alert { background: #e74c3c; color: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .success-alert { background: #27ae60; color: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🧮 Settlement Calculation Validation Report</h1>
        <p>Financial Accuracy Testing Results</p>
        <p>Generated: ${new Date().toISOString()}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <div class="metric-value">${this.results.totalTests}</div>
            <div class="metric-label">Total Tests</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #27ae60">${this.results.passedTests}</div>
            <div class="metric-label">Passed</div>
        </div>
        <div class="metric">
            <div class="metric-value" style="color: #e74c3c">${this.results.failedTests}</div>
            <div class="metric-label">Failed</div>
        </div>
        <div class="metric">
            <div class="metric-value">${passRate}%</div>
            <div class="metric-label">Pass Rate</div>
        </div>
        <div class="metric">
            <div class="metric-value">${this.results.financialAccuracyScore}%</div>
            <div class="metric-label">Financial Accuracy</div>
        </div>
        <div class="metric">
            <div class="metric-value">${this.results.validationCoverage}%</div>
            <div class="metric-label">Validation Coverage</div>
        </div>
    </div>

    ${this.results.failedTests > 0 ? `
    <div class="critical-alert">
        <h3>⚠️ CRITICAL: Financial Calculation Errors Detected!</h3>
        <p>Immediate attention required to prevent financial discrepancies in production.</p>
    </div>
    ` : `
    <div class="success-alert">
        <h3>✅ All Financial Calculations Validated</h3>
        <p>Settlement system maintains financial integrity across all test scenarios.</p>
    </div>
    `}

    <h2>Test Suite Details</h2>
    ${this.results.testSuites.map(suite => `
        <div class="test-suite">
            <div class="suite-header">
                ${suite.name} (${suite.duration}ms)
            </div>
            ${suite.tests.map(test => `
                <div class="test-item">
                    <div>
                        <strong>${test.title}</strong>
                        <span class="financial-impact impact-${test.financialImpact}">${test.financialImpact.toUpperCase()}</span>
                        ${test.error ? `<br><small style="color: #e74c3c">${test.error}</small>` : ''}
                    </div>
                    <div>
                        <span class="test-status status-${test.status}">${test.status.toUpperCase()}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('')}

</body>
</html>
    `.trim();
  }

  async generateCSVReport() {
    const csvData = [
      ['Test Suite', 'Test Name', 'Status', 'Duration (ms)', 'Calculation Type', 'Financial Impact', 'Error Message']
    ];

    for (const suite of this.results.testSuites) {
      for (const test of suite.tests) {
        csvData.push([
          suite.name,
          test.title,
          test.status,
          test.duration || 0,
          test.calculationType,
          test.financialImpact,
          test.error || ''
        ]);
      }
    }

    const csvContent = csvData.map(row =>
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const filePath = path.join(testConfig.outputDir, 'settlement-calculation-validation-results.csv');
    await fs.promises.writeFile(filePath, csvContent);
  }

  async generateFinancialAccuracyReport() {
    const accuracyReport = {
      timestamp: new Date().toISOString(),
      overallAccuracy: this.results.financialAccuracyScore,
      criticalFindings: [],
      recommendations: [],
      calculationBreakdown: {},
      riskAssessment: 'LOW'
    };

    // Analyze critical findings
    for (const suite of this.results.testSuites) {
      for (const test of suite.tests) {
        if (test.status === 'failed' && test.financialImpact === 'high') {
          accuracyReport.criticalFindings.push({
            test: test.title,
            suite: suite.name,
            error: test.error,
            impact: 'CRITICAL'
          });
        }
      }
    }

    // Risk assessment
    if (accuracyReport.criticalFindings.length > 0) {
      accuracyReport.riskAssessment = 'CRITICAL';
      accuracyReport.recommendations.push('Immediate review of failed calculation tests required');
      accuracyReport.recommendations.push('Do not deploy to production until all critical issues resolved');
    } else if (this.results.financialAccuracyScore < 95) {
      accuracyReport.riskAssessment = 'MEDIUM';
      accuracyReport.recommendations.push('Review calculation logic for edge cases');
    } else {
      accuracyReport.recommendations.push('Financial calculations validated - system ready for production');
    }

    const filePath = path.join(testConfig.outputDir, 'financial-accuracy-assessment.json');
    await fs.promises.writeFile(filePath, JSON.stringify(accuracyReport, null, 2));
  }

  createOutputDirectory() {
    if (!fs.existsSync(testConfig.outputDir)) {
      fs.mkdirSync(testConfig.outputDir, { recursive: true });
    }
  }
}

// Run the tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new SettlementTestRunner();
  runner.runAllTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { SettlementTestRunner, testConfig };