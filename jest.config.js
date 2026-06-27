/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['./dist'],
  runner: 'groups',
  setupFiles: ['dotenv/config'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/bin/**',
    '!src/mappings/**',
  ],
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
