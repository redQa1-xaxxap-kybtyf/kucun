/**
 * 速率限制配置
 * 定义不同API端点的速率限制策略
 */

/**
 * 速率限制类型枚举
 */
export enum RateLimitType {
  /** 全局限制 - 应用于所有API */
  GLOBAL = 'global',
  /** 认证API限制 - 登录、注册、验证码等 */
  AUTH = 'auth',
  /** 读取API限制 - GET 请求 */
  READ = 'read',
  /** 财务读取API限制 - 财务类敏感 GET 请求 */
  FINANCE_READ = 'finance_read',
  /** 写入API限制 - POST/PUT/DELETE/PATCH */
  WRITE = 'write',
  /** 登录限制 - 防暴力破解 */
  LOGIN = 'login',
  /** 验证码限制 - 防验证码滥用 */
  CAPTCHA = 'captcha',
}

/**
 * 速率限制配置接口
 */
export interface RateLimitConfig {
  /** 最大请求数 */
  maxRequests: number;
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 键前缀（用于Redis存储） */
  keyPrefix: string;
  /** 限制类型 */
  type: RateLimitType;
}

/**
 * 默认速率限制配置
 * 可通过环境变量覆盖
 */
export const DEFAULT_RATE_LIMIT_CONFIGS: Record<
  RateLimitType,
  RateLimitConfig
> = {
  [RateLimitType.GLOBAL]: {
    maxRequests: parseInt(process.env.RATE_LIMIT_GLOBAL || '100', 10),
    windowMs: 60 * 1000, // 1分钟
    keyPrefix: 'rate_limit:global',
    type: RateLimitType.GLOBAL,
  },
  [RateLimitType.AUTH]: {
    maxRequests: parseInt(process.env.RATE_LIMIT_AUTH || '5', 10),
    windowMs: 60 * 1000, // 1分钟
    keyPrefix: 'rate_limit:auth',
    type: RateLimitType.AUTH,
  },
  [RateLimitType.READ]: {
    maxRequests: parseInt(process.env.RATE_LIMIT_READ || '60', 10),
    windowMs: 60 * 1000, // 1分钟
    keyPrefix: 'rate_limit:read',
    type: RateLimitType.READ,
  },
  [RateLimitType.FINANCE_READ]: {
    maxRequests: parseInt(process.env.RATE_LIMIT_FINANCE_READ || '30', 10),
    windowMs: 60 * 1000, // 1分钟
    keyPrefix: 'rate_limit:finance_read',
    type: RateLimitType.FINANCE_READ,
  },
  [RateLimitType.WRITE]: {
    maxRequests: parseInt(process.env.RATE_LIMIT_WRITE || '30', 10),
    windowMs: 60 * 1000, // 1分钟
    keyPrefix: 'rate_limit:write',
    type: RateLimitType.WRITE,
  },
  [RateLimitType.LOGIN]: {
    maxRequests: parseInt(process.env.RATE_LIMIT_LOGIN || '5', 10),
    windowMs: 60 * 1000, // 1分钟
    keyPrefix: 'rate_limit:login',
    type: RateLimitType.LOGIN,
  },
  [RateLimitType.CAPTCHA]: {
    maxRequests: parseInt(process.env.RATE_LIMIT_CAPTCHA || '10', 10),
    windowMs: 60 * 1000, // 1分钟
    keyPrefix: 'rate_limit:captcha',
    type: RateLimitType.CAPTCHA,
  },
};

/**
 * 获取速率限制配置
 * @param type 限制类型
 * @returns 速率限制配置
 */
export function getRateLimitConfig(type: RateLimitType): RateLimitConfig {
  return DEFAULT_RATE_LIMIT_CONFIGS[type];
}

/**
 * 速率限制是否启用
 * 可通过环境变量 RATE_LIMIT_ENABLED 控制
 */
export const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';
