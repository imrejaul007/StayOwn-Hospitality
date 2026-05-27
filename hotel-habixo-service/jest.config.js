/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/types/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: false,
    }],
  },
  testTimeout: 30000,
  verbose: true,
  // Test patterns for integration tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
  // Coverage for integration tests can be separate
  projects: [
    {
      displayName: 'unit',
      testMatch: ['**/src/__tests__/!(*.integration).test.ts'],
    },
    {
      displayName: 'integration',
      testMatch: ['**/src/__tests__/integration/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: [
        '<rootDir>/src/__tests__/setup.ts',
        '<rootDir>/src/__tests__/integration/setupIntegration.ts',
      ],
    },
  ],
};
