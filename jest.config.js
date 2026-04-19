export default {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  transform: {},
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/scripts/**',
    '!src/docs/**',
    '!src/logs/**',
    '!src/storage/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: '.',
        filename: 'test-report.html',
        pageTitle: 'FitSync Test Report',
        expand: true,
      },
    ],
  ],
  testTimeout: 30000,
};