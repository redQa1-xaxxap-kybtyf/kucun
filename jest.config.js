/**
 * Jest配置文件
 * 为Next.js项目配置单元测试环境
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // 提供Next.js应用的路径,用于加载next.config.js和.env文件
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  // 测试环境
  testEnvironment: 'jest-environment-jsdom',

  // 设置文件
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // 模块路径映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  // 测试文件匹配模式
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],

  // 覆盖率收集
  collectCoverageFrom: [
    'lib/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'app/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/coverage/**',
    '!**/dist/**',
  ],

  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 95,
      lines: 90,
      statements: 90,
    },
  },

  // 覆盖率报告格式
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // 忽略的路径
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/tests/cache-behavior-test.spec.ts',
  ],

  // Transform忽略模式 - 需要转换faker-js和其他ES模块
  transformIgnorePatterns: ['/node_modules/(?!@faker-js)'],

  // 转换配置
  transform: {
    '^.+\\.(js|jsx|ts|tsx|mjs)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },

  // 最大并发worker数
  maxWorkers: '50%',

  // 详细输出
  verbose: true,

  // 测试超时时间(ms)
  testTimeout: 10000,
};

// 导出配置
module.exports = createJestConfig(customJestConfig);
