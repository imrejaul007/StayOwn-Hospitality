export default {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/test/**/*.test.js',
    '<rootDir>/test/**/*.test.tsx'
  ],
  collectCoverageFrom: [
    'backend/src/**/*.js',
    'frontend/src/**/*.{js,jsx,ts,tsx}',
    '!backend/src/app.js',
    '!backend/src/server.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/*.d.ts'
  ],
  coverageDirectory: 'test/coverage',
  coverageReporters: [
    'text',
    'html',
    'json-summary',
    'lcov'
  ],
  verbose: true,
  testTimeout: 30000,

  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
    '^@backend/(.*)$': '<rootDir>/backend/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/test/__mocks__/fileMock.js'
  },

  // Transform files
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        '@babel/preset-react',
        '@babel/preset-typescript'
      ]
    }]
  },


  // Test suites
  projects: [
    {
      displayName: 'Backend API Tests',
      testMatch: ['<rootDir>/test/backend/**/*.test.js'],
      testEnvironment: 'node'
    },
    {
      displayName: 'Frontend Component Tests',
      testMatch: ['<rootDir>/test/frontend/**/*.test.tsx'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/test/frontend-setup.js']
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['<rootDir>/test/integration/**/*.test.js'],
      testEnvironment: 'node',
      testTimeout: 60000
    },
    {
      displayName: 'Performance Tests',
      testMatch: ['<rootDir>/test/performance/**/*.test.js'],
      testEnvironment: 'node',
      testTimeout: 120000
    }
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    },
    './backend/src/services/': {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90
    },
    './backend/src/routes/': {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85
    }
  }
};