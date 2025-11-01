/**
 * Puppeteer 反检测配置
 * 目标：模拟真实用户浏览器，避免被识别为机器人
 *
 * SOLID-S: 单一职责 - 只负责 Puppeteer 配置
 * KISS: 保持配置简单直观
 */

/**
 * Puppeteer 启动选项
 * 🔒 反检测配置：隐藏自动化特征，模拟真实浏览器
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PUPPETEER_LAUNCH_OPTIONS: any = {
  // 使用系统安装的Chrome
  executablePath:
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',

  // 使用新的 headless 模式（Chrome 109+）
  headless: process.env.PUPPETEER_DEBUG !== 'true',

  // 调试模式下减慢操作速度
  ...(process.env.PUPPETEER_DEBUG === 'true' && { slowMo: 100 }),

  args: [
    // 基础配置
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',

    // 🔒 反检测配置
    '--disable-blink-features=AutomationControlled', // 隐藏自动化特征
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-web-security', // 允许跨域（仅开发环境）

    // 性能优化
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-component-extensions-with-background-pages',
    '--disable-extensions',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-renderer-backgrounding',
    '--enable-features=NetworkService,NetworkServiceInProcess',
    '--force-color-profile=srgb',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',

    // 窗口大小（模拟真实桌面浏览器）
    '--window-size=1920,1080',

    // 语言设置
    '--lang=zh-CN',
  ],

  // 视口配置
  defaultViewport: {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    hasTouch: false,
    isLandscape: true,
    isMobile: false,
  },

  // 忽略 HTTPS 错误（仅开发环境）
  ignoreHTTPSErrors: process.env.NODE_ENV === 'development',
};

/**
 * 真实的 User-Agent 列表
 * 定期更新以匹配最新的浏览器版本
 *
 * 🔒 使用真实的 User-Agent 避免被识别为机器人
 */
export const USER_AGENTS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',

  // Chrome on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',

  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
];

/**
 * 获取随机 User-Agent
 * 🔒 每次请求使用不同的 User-Agent，避免被识别
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * 通用的 HTTP Headers（模拟真实浏览器）
 * 🔒 使用真实浏览器的 Headers，避免被识别为机器人
 */
export const COMMON_HEADERS = {
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

/**
 * 随机延迟配置
 * 🔒 模拟人类行为的延迟范围
 */
export const DELAY_CONFIG = {
  /** 页面加载后的延迟（模拟用户浏览页面） */
  afterPageLoad: { min: 1000, max: 2000 },

  /** 点击前的延迟（模拟鼠标移动） */
  beforeClick: { min: 300, max: 800 },

  /** 输入后的延迟（模拟用户检查输入） */
  afterInput: { min: 500, max: 1500 },

  /** 滚动延迟（模拟用户浏览） */
  afterScroll: { min: 500, max: 1000 },

  /** 结果加载后的延迟（模拟用户阅读） */
  afterResultLoad: { min: 1000, max: 2000 },

  /** 人类打字速度（每个字符的延迟） */
  typingSpeed: { min: 50, max: 150 },
};

/**
 * 生成随机延迟时间（毫秒）
 * 🔒 模拟人类行为的随机性
 */
export function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成随机滚动距离（像素）
 * 🔒 模拟用户浏览页面的滚动行为
 */
export function getRandomScrollDistance(): number {
  return Math.floor(Math.random() * 300);
}

/**
 * 生成随机视口偏移（像素）
 * 🔒 为视口大小添加随机偏移，避免固定尺寸被识别
 */
export function getRandomViewportOffset(): { width: number; height: number } {
  return {
    width: Math.floor(Math.random() * 100),
    height: Math.floor(Math.random() * 100),
  };
}

/**
 * Rate Limiting 配置
 * 限制对运输查询网站的访问频率，避免被封禁
 */
export const RATE_LIMIT_CONFIG = {
  /** 默认配置：每分钟最多 10 次查询 */
  default: {
    windowSeconds: 60, // 时间窗口：60秒
    maxRequests: 10, // 最大请求数：10次
    waitStrategy: 'wait' as const, // 超限时等待
    maxWaitMs: 30000, // 最大等待时间：30秒
  },

  /** 严格配置：每分钟最多 5 次查询（用于敏感站点） */
  strict: {
    windowSeconds: 60,
    maxRequests: 5,
    waitStrategy: 'wait' as const,
    maxWaitMs: 60000, // 最大等待时间：60秒
  },

  /** 宽松配置：每分钟最多 20 次查询（用于稳定站点） */
  relaxed: {
    windowSeconds: 60,
    maxRequests: 20,
    waitStrategy: 'wait' as const,
    maxWaitMs: 15000, // 最大等待时间：15秒
  },
} as const;

/**
 * 缓存配置
 * 缓存查询结果，减少重复查询
 */
export const CACHE_CONFIG = {
  /** 默认缓存时间：1小时 */
  defaultTTL: 3600, // 秒

  /** 短期缓存：15分钟（用于频繁变化的数据） */
  shortTTL: 900,

  /** 长期缓存：24小时（用于稳定的数据） */
  longTTL: 86400,

  /** 缓存键前缀 */
  keyPrefix: 'shipping-query',
} as const;
