import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 端到端测试配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',

  // 测试超时时间
  timeout: 60 * 1000,

  // 每个测试的重试次数
  retries: process.env.CI ? 2 : 0,

  // 并行执行的worker数量
  workers: process.env.CI ? 1 : undefined,

  // 报告配置
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  // 全局配置
  use: {
    // 基础URL
    baseURL: 'http://localhost:3000',

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

  // 开发服务器配置（可选）
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3001',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});
