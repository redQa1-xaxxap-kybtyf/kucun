/**
 * 环境变量验证模块
 * 使用 Zod 验证所有环境变量，确保类型安全和配置完整性
 * 作为环境配置的单一真理源（Single Source of Truth）
 */

import { z } from 'zod';

// 环境变量验证 Schema
const envSchema = z.object({
  // 数据库配置
  DATABASE_URL: z
    .string()
    .min(1, '数据库连接字符串不能为空')
    .refine(
      val =>
        val.startsWith('file:') ||
        val.startsWith('mysql:') ||
        val.startsWith('postgresql:') ||
        val.startsWith('sqlite:'),
      '数据库连接字符串格式不正确，应以 file:、mysql:、postgresql: 或 sqlite: 开头'
    ),

  // Next-Auth 配置
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET 长度至少为32位')
    .describe('Next-Auth 加密密钥'),

  NEXTAUTH_URL: z
    .string()
    .url('NEXTAUTH_URL 必须是有效的URL')
    .optional()
    .describe('Next-Auth 回调URL（生产环境必需）'),

  // 应用配置
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development')
    .describe('应用运行环境'),

  // Redis 配置（缓存层）
  REDIS_URL: z
    .string()
    .url('REDIS_URL 必须是有效的URL，形如 redis://localhost:6379')
    .default('redis://127.0.0.1:6379')
    .describe('Redis 连接地址'),
  REDIS_POOL_SIZE: z
    .string()
    .regex(/^\d+$/, 'REDIS_POOL_SIZE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default('3')
    .describe('Redis 连接池大小'),
  REDIS_NAMESPACE: z
    .string()
    .default('kucun')
    .describe('Redis 缓存命名空间前缀'),

  // WebSocket 配置
  WS_PORT: z
    .string()
    .regex(/^[\d]+$/, 'WS_PORT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default('3002')
    .describe('WebSocket 服务器端口'),
  WS_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .describe('允许的 WebSocket Origin，逗号分隔'),
  NEXT_PUBLIC_WS_PORT: z
    .string()
    .regex(/^[\d]+$/, 'NEXT_PUBLIC_WS_PORT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default('3002')
    .describe('客户端 WebSocket 端口'),

  // 文件上传配置
  UPLOAD_MAX_SIZE: z
    .string()
    .regex(/^[\d]+$/, 'UPLOAD_MAX_SIZE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default('10485760') // 10MB
    .describe('文件上传最大大小（字节）'),

  UPLOAD_DIR: z
    .string()
    .min(1, '上传目录路径不能为空')
    .default('./public/uploads')
    .describe('文件上传目录'),

  // 应用端口配置
  PORT: z
    .string()
    .regex(/^[\d]+$/, 'PORT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default('3000')
    .describe('应用服务器端口'),

  // 缓存配置
  PRODUCT_CACHE_TTL: z
    .string()
    .regex(/^[\d]+$/, 'PRODUCT_CACHE_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default('60')
    .describe('产品缓存时间（秒）'),

  // 日志配置
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug'])
    .default('info')
    .describe('日志级别'),
});

// 环境变量类型推断
export type Env = z.infer<typeof envSchema>;

/**
 * 验证并解析环境变量
 * @returns 验证后的环境变量对象
 * @throws 如果环境变量验证失败
 */
function validateEnv(): Env {
  // 在客户端环境下，只验证公开的环境变量
  if (typeof window !== 'undefined') {
    const clientEnvSchema = z.object({
      NEXT_PUBLIC_WS_PORT: z
        .string()
        .regex(/^[\d]+$/, 'NEXT_PUBLIC_WS_PORT 必须是数字')
        .transform(val => parseInt(val, 10))
        .default('3002')
        .describe('客户端 WebSocket 端口'),
    });

    try {
      const parsed = clientEnvSchema.parse(process.env);
      // 为客户端返回一个安全的环境对象
      return {
        ...parsed,
        // 客户端不需要的字段使用默认值
        DATABASE_URL: '',
        NEXTAUTH_SECRET: '',
        NEXTAUTH_URL: '',
        NODE_ENV: 'development',
        REDIS_URL: '',
        REDIS_POOL_SIZE: 3,
        REDIS_NAMESPACE: '',
        WS_PORT: 3002,
        WS_ALLOWED_ORIGINS: '',
        UPLOAD_MAX_SIZE: 10485760,
        UPLOAD_DIR: '',
        PORT: 3000,
        PRODUCT_CACHE_TTL: 60,
        LOG_LEVEL: 'info',
      } as Env;
    } catch (error) {
      // 客户端环境变量验证失败时使用默认值
      return {
        DATABASE_URL: '',
        NEXTAUTH_SECRET: '',
        NEXTAUTH_URL: '',
        NODE_ENV: 'development',
        REDIS_URL: '',
        REDIS_POOL_SIZE: 3,
        REDIS_NAMESPACE: '',
        WS_PORT: 3002,
        WS_ALLOWED_ORIGINS: '',
        NEXT_PUBLIC_WS_PORT: 3002,
        UPLOAD_MAX_SIZE: 10485760,
        UPLOAD_DIR: '',
        PORT: 3000,
        PRODUCT_CACHE_TTL: 60,
        LOG_LEVEL: 'info',
      } as Env;
    }
  }

  // 服务器端验证完整的环境变量
  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        err => `${err.path.join('.')}: ${err.message}`
      );

      // eslint-disable-next-line no-console
      console.error('❌ 环境变量验证失败:');
      // eslint-disable-next-line no-console
      errorMessages.forEach(msg => console.error(`  - ${msg}`));

      throw new Error(`环境变量验证失败:\n${errorMessages.join('\n')}`);
    }
    throw error;
  }
}

/**
 * 验证后的环境变量对象
 * 作为项目中所有环境配置的单一真理源
 */
export const env = validateEnv();

/**
 * 开发环境检查
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * 生产环境检查
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * 测试环境检查
 */
export const isTest = env.NODE_ENV === 'test';

/**
 * 数据库配置
 */
export const dbConfig = {
  url: env.DATABASE_URL,
} as const;

/**
 * 认证配置
 */
export const authConfig = {
  secret: env.NEXTAUTH_SECRET,
  url: env.NEXTAUTH_URL,
} as const;

/**
 * Redis 配置
 */
export const redisConfig = {
  url: env.REDIS_URL,
  poolSize: env.REDIS_POOL_SIZE,
  namespace: env.REDIS_NAMESPACE,
} as const;

/**
 * WebSocket 配置
 */
export const wsConfig = {
  port: env.WS_PORT,
  clientPort: env.NEXT_PUBLIC_WS_PORT,
  allowedOrigins:
    env.WS_ALLOWED_ORIGINS?.split(',')
      .map(s => s.trim())
      .filter(Boolean) || [],
} as const;

/**
 * 上传配置
 */
export const uploadConfig = {
  maxSize: env.UPLOAD_MAX_SIZE,
  directory: env.UPLOAD_DIR,
} as const;

/**
 * 应用配置
 */
export const appConfig = {
  port: env.PORT,
} as const;

/**
 * 缓存配置
 */
export const cacheConfig = {
  productTtl: env.PRODUCT_CACHE_TTL,
} as const;

/**
 * 日志配置
 */
export const logConfig = {
  level: env.LOG_LEVEL,
} as const;

// 在开发环境下打印配置信息（不包含敏感信息）
if (isDevelopment) {
  // eslint-disable-next-line no-console
  console.log('🔧 环境配置已加载:');
  // eslint-disable-next-line no-console
  console.log(`  - 环境: ${env.NODE_ENV}`);
  // eslint-disable-next-line no-console
  console.log(`  - 应用端口: ${env.PORT}`);
  // eslint-disable-next-line no-console
  console.log(
    `  - 数据库: ${env.DATABASE_URL.includes('sqlite') ? 'SQLite (开发)' : 'MySQL (生产)'}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 上传目录: ${env.UPLOAD_DIR} (最大: ${env.UPLOAD_MAX_SIZE} bytes)`
  );
  // eslint-disable-next-line no-console
  console.log(`  - 产品缓存TTL: ${env.PRODUCT_CACHE_TTL}秒`);
  // eslint-disable-next-line no-console
  console.log(`  - 日志级别: ${env.LOG_LEVEL}`);
  // eslint-disable-next-line no-console
  console.log(`  - Redis: ${env.REDIS_URL} (池大小: ${env.REDIS_POOL_SIZE})`);
  // eslint-disable-next-line no-console
  console.log(
    `  - WS端口: ${env.WS_PORT} (客户端: ${env.NEXT_PUBLIC_WS_PORT})`
  );
}
