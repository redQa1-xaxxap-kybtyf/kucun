import path from 'path';

import { defineConfig, devices } from '@playwright/test';

const PLAYWRIGHT_ARTIFACTS_ROOT = path.resolve(
  process.cwd(),
  '..',
  'kucun-playwright-artifacts'
);
const PLAYWRIGHT_BASE_URL =
  process.env.BASE_URL || 'http://127.0.0.1:3000';
const MANAGED_SERVER_ENABLED = process.env.PLAYWRIGHT_MANAGED_SERVER === '1';
const MANAGED_SERVER_COMMAND =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ||
  'cross-env PORT=3001 npm run build && cross-env PORT=3001 npm run start';

/**
 * Playwright 端到端测试配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  outputDir: path.join(PLAYWRIGHT_ARTIFACTS_ROOT, 'test-results'),

  // 测试超时时间
  timeout: 60 * 1000,

  // 每个测试的重试次数
  retries: process.env.CI ? 2 : 0,

  // 并行执行的worker数量
  workers: process.env.CI ? 1 : undefined,

  // 报告配置
  reporter: [
    [
      'html',
      {
        outputFolder: path.join(PLAYWRIGHT_ARTIFACTS_ROOT, 'playwright-report'),
      },
    ],
    ['list'],
  ],

  // 全局配置
  use: {
    // 基础URL
    baseURL: PLAYWRIGHT_BASE_URL,

    // 截图配置
    screenshot: 'only-on-failure',

    // 视频录制
    video: 'retain-on-failure',

    // 追踪
    trace: 'on-first-retry',

    // 浏览器上下文选项
    viewport: { width: 1280, height: 720 },

    // 忽略HTTPS错误
    ignoreHTTPSErrors: true,
  },

  // 测试项目配置
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // 可选：添加其他浏览器
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  webServer: MANAGED_SERVER_ENABLED
    ? {
        command: MANAGED_SERVER_COMMAND,
        url: `${PLAYWRIGHT_BASE_URL}/auth/signin`,
        reuseExistingServer: false,
        timeout: 15 * 60 * 1000,
      }
    : undefined,
});
