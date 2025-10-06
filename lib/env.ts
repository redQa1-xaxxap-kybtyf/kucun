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

  // bcrypt 配置
  BCRYPT_SALT_ROUNDS: z
    .string()
    .regex(/^[\d]+$/, 'BCRYPT_SALT_ROUNDS 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 10 && val <= 15, {
      message: 'BCRYPT_SALT_ROUNDS 必须在 10-15 之间',
    })
    .default(12)
    .describe('bcrypt 加密的 salt rounds，推荐值 10-12'),

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
  REDIS_PASSWORD: z
    .string()
    .optional()
    .describe('Redis 密码（生产环境强烈推荐配置）'),
  REDIS_POOL_SIZE: z
    .string()
    .regex(/^\d+$/, 'REDIS_POOL_SIZE 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 50, {
      message: 'REDIS_POOL_SIZE 必须在 1-50 之间',
    })
    .default(3)
    .describe('Redis 连接池大小（推荐 3-10）'),
  REDIS_NAMESPACE: z
    .string()
    .min(1, 'REDIS_NAMESPACE 不能为空')
    .default('kucun')
    .describe('Redis 缓存命名空间前缀'),
  REDIS_DB: z
    .string()
    .regex(/^\d+$/, 'REDIS_DB 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 0 && val <= 15, {
      message: 'REDIS_DB 必须在 0-15 之间',
    })
    .default(0)
    .describe('Redis 数据库索引（0-15）'),
  REDIS_TLS_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default(false)
    .describe('是否启用 Redis TLS/SSL 连接'),
  REDIS_CONNECT_TIMEOUT: z
    .string()
    .regex(/^\d+$/, 'REDIS_CONNECT_TIMEOUT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10000)
    .describe('Redis 连接超时时间（毫秒）'),
  REDIS_COMMAND_TIMEOUT: z
    .string()
    .regex(/^\d+$/, 'REDIS_COMMAND_TIMEOUT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5000)
    .describe('Redis 命令超时时间（毫秒）'),
  REDIS_KEEPALIVE: z
    .string()
    .regex(/^\d+$/, 'REDIS_KEEPALIVE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(60000)
    .describe('Redis TCP KeepAlive 时间（毫秒）'),
  REDIS_MAX_RETRIES: z
    .string()
    .regex(/^\d+$/, 'REDIS_MAX_RETRIES 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 10, {
      message: 'REDIS_MAX_RETRIES 必须在 1-10 之间',
    })
    .default(5)
    .describe('Redis 最大重试次数'),

  // WebSocket 配置
  WS_PORT: z
    .string()
    .regex(/^[\d]+$/, 'WS_PORT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(3002)
    .describe('WebSocket 服务器端口'),
  WS_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .describe('允许的 WebSocket Origin，逗号分隔'),
  NEXT_PUBLIC_WS_PORT: z
    .string()
    .regex(/^[\d]+$/, 'NEXT_PUBLIC_WS_PORT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(3002)
    .describe('客户端 WebSocket 端口'),

  // 文件上传配置
  UPLOAD_MAX_SIZE: z
    .string()
    .regex(/^[\d]+$/, 'UPLOAD_MAX_SIZE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10485760) // 10MB
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
    .default(3000)
    .describe('应用服务器端口'),

  // 缓存配置
  PRODUCT_CACHE_TTL: z
    .string()
    .regex(/^[\d]+$/, 'PRODUCT_CACHE_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(60)
    .describe('产品缓存时间（秒）'),

  INVENTORY_CACHE_TTL: z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_CACHE_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10)
    .describe('库存缓存时间（秒）'),

  // 库存阈值配置
  INVENTORY_DEFAULT_MIN_QUANTITY: z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_DEFAULT_MIN_QUANTITY 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10)
    .describe('默认最小库存阈值'),

  INVENTORY_CRITICAL_MIN_QUANTITY: z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_CRITICAL_MIN_QUANTITY 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('紧急库存阈值'),

  INVENTORY_OVERSTOCK_MULTIPLIER: z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_OVERSTOCK_MULTIPLIER 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('库存过多倍率'),

  INVENTORY_MAX_STOCK_MULTIPLIER: z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_MAX_STOCK_MULTIPLIER 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(50)
    .describe('最大库存为最小库存的倍数'),

  // 库存业务配置
  INVENTORY_AVERAGE_DAILY_SALES: z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_AVERAGE_DAILY_SALES 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(2)
    .describe('平均日销量假设值'),

  INVENTORY_ALERT_REFRESH_INTERVAL: z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_ALERT_REFRESH_INTERVAL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(300000)
    .describe('库存预警刷新间隔（毫秒）'),

  INVENTORY_ALERT_LIMIT: z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_ALERT_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(20)
    .describe('库存预警返回数量限制'),

  // 分页配置
  DEFAULT_PAGE_SIZE: z
    .string()
    .regex(/^[\d]+$/, 'DEFAULT_PAGE_SIZE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(20)
    .describe('默认分页大小'),

  MAX_PAGE_SIZE: z
    .string()
    .regex(/^[\d]+$/, 'MAX_PAGE_SIZE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(100)
    .describe('最大分页大小'),

  // 产品模块配置
  PRODUCT_LIST_INCLUDE_INVENTORY: z
    .string()
    .transform(val => val === 'true')
    .default(false)
    .describe('默认是否包含库存统计'),

  PRODUCT_LIST_INCLUDE_STATISTICS: z
    .string()
    .transform(val => val === 'true')
    .default(false)
    .describe('默认是否包含统计信息'),

  PRODUCT_CACHE_WITH_INVENTORY_TTL: z
    .string()
    .regex(/^[\d]+$/, 'PRODUCT_CACHE_WITH_INVENTORY_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(60)
    .describe('包含库存的产品缓存TTL（秒）'),

  PRODUCT_CACHE_WITHOUT_INVENTORY_TTL: z
    .string()
    .regex(/^[\d]+$/, 'PRODUCT_CACHE_WITHOUT_INVENTORY_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(30)
    .describe('不包含库存的产品缓存TTL（秒）'),

  // 销售订单配置
  ORDER_NUMBER_MAX_RETRY: z
    .string()
    .regex(/^[\d]+$/, 'ORDER_NUMBER_MAX_RETRY 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10)
    .describe('订单号生成最大重试次数'),

  ORDER_NUMBER_RECENT_LIMIT: z
    .string()
    .regex(/^[\d]+$/, 'ORDER_NUMBER_RECENT_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('最近订单查询数量'),

  // 客户模块配置
  CUSTOMER_SEARCH_LIMIT: z
    .string()
    .regex(/^[\d]+$/, 'CUSTOMER_SEARCH_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('客户搜索结果限制'),

  CUSTOMER_TAG_LIMIT: z
    .string()
    .regex(/^[\d]+$/, 'CUSTOMER_TAG_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10)
    .describe('客户标签数量上限'),

  // 仪表盘配置
  DASHBOARD_STALE_TIME: z
    .string()
    .regex(/^[\d]+$/, 'DASHBOARD_STALE_TIME 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(300000)
    .describe('仪表盘数据过期时间（毫秒）'),

  DASHBOARD_REFETCH_INTERVAL: z
    .string()
    .regex(/^[\d]+$/, 'DASHBOARD_REFETCH_INTERVAL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(60000)
    .describe('仪表盘刷新间隔（毫秒）'),

  // 厂家发货模块配置
  FACTORY_SHIPMENT_ORDER_PREFIX: z
    .string()
    .min(1, 'FACTORY_SHIPMENT_ORDER_PREFIX 不能为空')
    .max(10, 'FACTORY_SHIPMENT_ORDER_PREFIX 不能超过10个字符')
    .default('FS')
    .describe('厂家发货订单号前缀'),

  FACTORY_SHIPMENT_QUERY_LIMIT: z
    .string()
    .regex(/^[\d]+$/, 'FACTORY_SHIPMENT_QUERY_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(1000)
    .describe('厂家发货表单查询限制'),

  // 退货/退款模块配置
  REFUND_ORDER_PREFIX: z
    .string()
    .min(1, 'REFUND_ORDER_PREFIX 不能为空')
    .max(10, 'REFUND_ORDER_PREFIX 不能超过10个字符')
    .default('REF')
    .describe('退款单号前缀'),

  RETURN_ORDER_PREFIX: z
    .string()
    .min(1, 'RETURN_ORDER_PREFIX 不能为空')
    .max(10, 'RETURN_ORDER_PREFIX 不能超过10个字符')
    .default('RT')
    .describe('退货单号前缀'),

  RETURN_ORDER_ITEMS_LIMIT: z
    .string()
    .regex(/^[\d]+$/, 'RETURN_ORDER_ITEMS_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(50)
    .describe('退货明细上限'),

  REFUND_BATCH_LIMIT: z
    .string()
    .regex(/^[\d]+$/, 'REFUND_BATCH_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(50)
    .describe('退款批量处理上限'),

  FINANCE_CREDIT_LIMIT: z
    .string()
    .regex(/^[\d]+$/, 'FINANCE_CREDIT_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(100000)
    .describe('财务信用额度限制'),

  FINANCE_CACHE_TTL: z
    .string()
    .regex(/^[\d]+$/, 'FINANCE_CACHE_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(300)
    .describe('财务数据缓存时间（秒）'),

  // 销售订单模块配置
  SALES_ORDER_PREFIX: z
    .string()
    .min(1, 'SALES_ORDER_PREFIX 不能为空')
    .max(10, 'SALES_ORDER_PREFIX 不能超过10个字符')
    .default('SO')
    .describe('销售订单号前缀'),

  SALES_ORDER_NUMBER_LENGTH: z
    .string()
    .regex(/^[\d]+$/, 'SALES_ORDER_NUMBER_LENGTH 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(
      val => val >= 1 && val <= 10,
      'SALES_ORDER_NUMBER_LENGTH 必须在1-10之间'
    )
    .default(4)
    .describe('销售订单号序号位数'),

  // 供应商模块配置
  SUPPLIER_QUERY_LIMIT: z
    .string()
    .regex(/^[\d]+$/, 'SUPPLIER_QUERY_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(100)
    .describe('供应商查询默认限制'),

  SUPPLIER_CACHE_TTL: z
    .string()
    .regex(/^[\d]+$/, 'SUPPLIER_CACHE_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(300000)
    .describe('供应商数据缓存时间（毫秒）'),

  SUPPLIER_DEFAULT_STATUS: z
    .string()
    .min(1, 'SUPPLIER_DEFAULT_STATUS 不能为空')
    .default('active')
    .describe('供应商默认状态过滤'),

  // 系统基础设置配置
  SYSTEM_DEFAULT_LANGUAGE: z
    .string()
    .min(1, 'SYSTEM_DEFAULT_LANGUAGE 不能为空')
    .default('zh')
    .describe('系统默认语言'),

  SYSTEM_COMPANY_NAME: z
    .string()
    .min(1, 'SYSTEM_COMPANY_NAME 不能为空')
    .max(100, 'SYSTEM_COMPANY_NAME 不能超过100个字符')
    .default('库存管理系统')
    .describe('默认公司名称'),

  SYSTEM_TIMEZONE: z
    .string()
    .min(1, 'SYSTEM_TIMEZONE 不能为空')
    .default('Asia/Shanghai')
    .describe('系统时区'),

  // 用户策略配置
  USER_PASSWORD_MIN_LENGTH: z
    .string()
    .regex(/^[\d]+$/, 'USER_PASSWORD_MIN_LENGTH 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(
      val => val >= 6 && val <= 20,
      'USER_PASSWORD_MIN_LENGTH 必须在6-20之间'
    )
    .default(8)
    .describe('密码最小长度'),

  USER_MAX_LOGIN_ATTEMPTS: z
    .string()
    .regex(/^[\d]+$/, 'USER_MAX_LOGIN_ATTEMPTS 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('最大登录失败次数'),

  USER_SESSION_TIMEOUT: z
    .string()
    .regex(/^[\d]+$/, 'USER_SESSION_TIMEOUT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(90)
    .describe('会话超时时间（分钟）'),

  // 存储配置
  STORAGE_MAX_FILE_SIZE: z
    .string()
    .regex(/^[\d]+$/, 'STORAGE_MAX_FILE_SIZE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10485760)
    .describe('最大文件大小（字节）'),

  STORAGE_ALLOWED_FILE_TYPES: z
    .string()
    .min(1, 'STORAGE_ALLOWED_FILE_TYPES 不能为空')
    .default('jpg,jpeg,png,pdf,doc,docx,xls,xlsx')
    .describe('允许的文件类型'),

  STORAGE_ENCRYPTION_KEY: z
    .string()
    .min(32, 'STORAGE_ENCRYPTION_KEY 必须至少32个字符')
    .max(64, 'STORAGE_ENCRYPTION_KEY 不能超过64个字符')
    .describe('存储加密密钥（必须配置）'),

  STORAGE_REGION: z
    .string()
    .min(1, 'STORAGE_REGION 不能为空')
    .default('z0')
    .describe('存储区域'),

  // 日志配置扩展
  LOG_RETENTION_DAYS: z
    .string()
    .regex(/^[\d]+$/, 'LOG_RETENTION_DAYS 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(30)
    .describe('日志保留天数'),

  LOG_CRITICAL_ACTIONS: z
    .string()
    .min(1, 'LOG_CRITICAL_ACTIONS 不能为空')
    .default('login,logout,delete,update_settings')
    .describe('关键日志行为'),

  LOG_CRITICAL_TYPES: z
    .string()
    .min(1, 'LOG_CRITICAL_TYPES 不能为空')
    .default('security,system,error')
    .describe('关键日志类型'),

  LOG_CRITICAL_LEVELS: z
    .string()
    .min(1, 'LOG_CRITICAL_LEVELS 不能为空')
    .default('error,warn,info')
    .describe('关键日志级别'),

  // 日志配置
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'debug'])
    .default('info')
    .describe('日志级别'),

  // 速率限制配置
  RATE_LIMIT_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default(true)
    .describe('是否启用速率限制'),

  RATE_LIMIT_GLOBAL: z
    .string()
    .regex(/^[\d]+$/, 'RATE_LIMIT_GLOBAL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(100)
    .describe('全局速率限制（请求数/分钟）'),

  RATE_LIMIT_AUTH: z
    .string()
    .regex(/^[\d]+$/, 'RATE_LIMIT_AUTH 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('认证API速率限制（请求数/分钟）'),

  RATE_LIMIT_READ: z
    .string()
    .regex(/^[\d]+$/, 'RATE_LIMIT_READ 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(60)
    .describe('读取API速率限制（请求数/分钟）'),

  RATE_LIMIT_WRITE: z
    .string()
    .regex(/^[\d]+$/, 'RATE_LIMIT_WRITE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(30)
    .describe('写入API速率限制（请求数/分钟）'),

  RATE_LIMIT_LOGIN: z
    .string()
    .regex(/^[\d]+$/, 'RATE_LIMIT_LOGIN 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('登录速率限制（请求数/分钟）'),

  RATE_LIMIT_CAPTCHA: z
    .string()
    .regex(/^[\d]+$/, 'RATE_LIMIT_CAPTCHA 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10)
    .describe('验证码速率限制（请求数/分钟）'),

  // 性能监控配置
  ENABLE_MEMORY_MONITOR: z
    .string()
    .transform(val => val === 'true')
    .default(false)
    .describe('是否启用内存监控'),

  MONITORING_TOKEN: z
    .string()
    .min(1, 'MONITORING_TOKEN 不能为空')
    .default('dev-token-change-in-production')
    .describe('内存监控API访问令牌'),
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
        .default(3002)
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
        INVENTORY_CACHE_TTL: 10,
        INVENTORY_DEFAULT_MIN_QUANTITY: 10,
        INVENTORY_CRITICAL_MIN_QUANTITY: 5,
        INVENTORY_OVERSTOCK_MULTIPLIER: 5,
        INVENTORY_MAX_STOCK_MULTIPLIER: 50,
        INVENTORY_AVERAGE_DAILY_SALES: 2,
        INVENTORY_ALERT_REFRESH_INTERVAL: 300000,
        INVENTORY_ALERT_LIMIT: 20,
        DEFAULT_PAGE_SIZE: 20,
        MAX_PAGE_SIZE: 100,
        PRODUCT_LIST_INCLUDE_INVENTORY: false,
        PRODUCT_LIST_INCLUDE_STATISTICS: false,
        PRODUCT_CACHE_WITH_INVENTORY_TTL: 60,
        PRODUCT_CACHE_WITHOUT_INVENTORY_TTL: 30,
        ORDER_NUMBER_MAX_RETRY: 10,
        ORDER_NUMBER_RECENT_LIMIT: 5,
        CUSTOMER_SEARCH_LIMIT: 5,
        CUSTOMER_TAG_LIMIT: 10,
        DASHBOARD_STALE_TIME: 300000,
        DASHBOARD_REFETCH_INTERVAL: 60000,
        FACTORY_SHIPMENT_ORDER_PREFIX: 'FS',
        FACTORY_SHIPMENT_QUERY_LIMIT: 1000,
        LOG_LEVEL: 'info',
        BCRYPT_SALT_ROUNDS: 12,
        REFUND_ORDER_PREFIX: 'REF',
        RETURN_ORDER_PREFIX: 'RT',
        RETURN_ORDER_ITEMS_LIMIT: 50,
        REFUND_BATCH_LIMIT: 50,
        FINANCE_CREDIT_LIMIT: 100000,
        FINANCE_CACHE_TTL: 300,
        SALES_ORDER_PREFIX: 'SO',
        SALES_ORDER_NUMBER_LENGTH: 4,
        SUPPLIER_QUERY_LIMIT: 100,
        SUPPLIER_CACHE_TTL: 300000,
        SUPPLIER_DEFAULT_STATUS: 'active',
        SYSTEM_DEFAULT_LANGUAGE: 'zh',
        SYSTEM_COMPANY_NAME: '库存管理系统',
        SYSTEM_TIMEZONE: 'Asia/Shanghai',
        USER_PASSWORD_MIN_LENGTH: 8,
        USER_MAX_LOGIN_ATTEMPTS: 5,
        USER_SESSION_TIMEOUT: 90,
        STORAGE_MAX_FILE_SIZE: 10485760,
        STORAGE_ALLOWED_FILE_TYPES: 'jpg,jpeg,png,pdf,doc,docx,xls,xlsx',
        STORAGE_ENCRYPTION_KEY: '',
        STORAGE_REGION: 'z0',
        LOG_RETENTION_DAYS: 30,
        LOG_CRITICAL_ACTIONS: 'login,logout,delete,update_settings',
        LOG_CRITICAL_TYPES: 'security,system,error',
        LOG_CRITICAL_LEVELS: 'error,warn,info',
        RATE_LIMIT_ENABLED: true,
        RATE_LIMIT_GLOBAL: 100,
        RATE_LIMIT_AUTH: 5,
        RATE_LIMIT_READ: 60,
        RATE_LIMIT_WRITE: 30,
        RATE_LIMIT_LOGIN: 5,
        RATE_LIMIT_CAPTCHA: 10,
        ENABLE_MEMORY_MONITOR: false,
        MONITORING_TOKEN: 'dev-token',
      } as Env;
    } catch (error) {
      // 客户端环境变量验证失败时使用默认值
      return {
        DATABASE_URL: '',
        NEXTAUTH_SECRET: '',
        NEXTAUTH_URL: '',
        NODE_ENV: 'development',
        REDIS_URL: '',
        REDIS_PASSWORD: undefined,
        REDIS_POOL_SIZE: 3,
        REDIS_NAMESPACE: '',
        REDIS_DB: 0,
        REDIS_TLS_ENABLED: false,
        REDIS_CONNECT_TIMEOUT: 10000,
        REDIS_COMMAND_TIMEOUT: 5000,
        REDIS_KEEPALIVE: 60000,
        REDIS_MAX_RETRIES: 5,
        WS_PORT: 3002,
        WS_ALLOWED_ORIGINS: '',
        NEXT_PUBLIC_WS_PORT: 3002,
        UPLOAD_MAX_SIZE: 10485760,
        UPLOAD_DIR: '',
        PORT: 3000,
        PRODUCT_CACHE_TTL: 60,
        INVENTORY_CACHE_TTL: 10,
        INVENTORY_DEFAULT_MIN_QUANTITY: 10,
        INVENTORY_CRITICAL_MIN_QUANTITY: 5,
        INVENTORY_OVERSTOCK_MULTIPLIER: 5,
        INVENTORY_MAX_STOCK_MULTIPLIER: 50,
        INVENTORY_AVERAGE_DAILY_SALES: 2,
        INVENTORY_ALERT_REFRESH_INTERVAL: 300000,
        INVENTORY_ALERT_LIMIT: 20,
        DEFAULT_PAGE_SIZE: 20,
        MAX_PAGE_SIZE: 100,
        PRODUCT_LIST_INCLUDE_INVENTORY: false,
        PRODUCT_LIST_INCLUDE_STATISTICS: false,
        PRODUCT_CACHE_WITH_INVENTORY_TTL: 60,
        PRODUCT_CACHE_WITHOUT_INVENTORY_TTL: 30,
        ORDER_NUMBER_MAX_RETRY: 10,
        ORDER_NUMBER_RECENT_LIMIT: 5,
        CUSTOMER_SEARCH_LIMIT: 5,
        CUSTOMER_TAG_LIMIT: 10,
        DASHBOARD_STALE_TIME: 300000,
        DASHBOARD_REFETCH_INTERVAL: 60000,
        FACTORY_SHIPMENT_ORDER_PREFIX: 'FS',
        FACTORY_SHIPMENT_QUERY_LIMIT: 1000,
        LOG_LEVEL: 'info',
        BCRYPT_SALT_ROUNDS: 12,
        REFUND_ORDER_PREFIX: 'REF',
        RETURN_ORDER_PREFIX: 'RT',
        RETURN_ORDER_ITEMS_LIMIT: 50,
        REFUND_BATCH_LIMIT: 50,
        FINANCE_CREDIT_LIMIT: 100000,
        FINANCE_CACHE_TTL: 300,
        SALES_ORDER_PREFIX: 'SO',
        SALES_ORDER_NUMBER_LENGTH: 4,
        SUPPLIER_QUERY_LIMIT: 100,
        SUPPLIER_CACHE_TTL: 300000,
        SUPPLIER_DEFAULT_STATUS: 'active',
        SYSTEM_DEFAULT_LANGUAGE: 'zh',
        SYSTEM_COMPANY_NAME: '库存管理系统',
        SYSTEM_TIMEZONE: 'Asia/Shanghai',
        USER_PASSWORD_MIN_LENGTH: 8,
        USER_MAX_LOGIN_ATTEMPTS: 5,
        USER_SESSION_TIMEOUT: 90,
        STORAGE_MAX_FILE_SIZE: 10485760,
        STORAGE_ALLOWED_FILE_TYPES: 'jpg,jpeg,png,pdf,doc,docx,xls,xlsx',
        STORAGE_ENCRYPTION_KEY: '',
        STORAGE_REGION: 'z0',
        LOG_RETENTION_DAYS: 30,
        LOG_CRITICAL_ACTIONS: 'login,logout,delete,update_settings',
        LOG_CRITICAL_TYPES: 'security,system,error',
        LOG_CRITICAL_LEVELS: 'error,warn,info',
        RATE_LIMIT_ENABLED: true,
        RATE_LIMIT_GLOBAL: 100,
        RATE_LIMIT_AUTH: 5,
        RATE_LIMIT_READ: 60,
        RATE_LIMIT_WRITE: 30,
        RATE_LIMIT_LOGIN: 5,
        RATE_LIMIT_CAPTCHA: 10,
        ENABLE_MEMORY_MONITOR: false,
        MONITORING_TOKEN: 'dev-token',
      } as Env;
    }
  }

  // 服务器端验证完整的环境变量
  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.issues.map(
        (err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`
      );

      console.error('❌ 环境变量验证失败:');

      errorMessages.forEach((msg: string) => console.error(`  - ${msg}`));

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
  password: env.REDIS_PASSWORD,
  poolSize: env.REDIS_POOL_SIZE,
  namespace: env.REDIS_NAMESPACE,
  db: env.REDIS_DB,
  tlsEnabled: env.REDIS_TLS_ENABLED,
  connectTimeout: env.REDIS_CONNECT_TIMEOUT,
  commandTimeout: env.REDIS_COMMAND_TIMEOUT,
  keepAlive: env.REDIS_KEEPALIVE,
  maxRetries: env.REDIS_MAX_RETRIES,
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
  inventoryTtl: env.INVENTORY_CACHE_TTL,
} as const;

/**
 * 库存配置对象
 */
export const inventoryConfig = {
  // 阈值配置
  defaultMinQuantity: env.INVENTORY_DEFAULT_MIN_QUANTITY,
  criticalMinQuantity: env.INVENTORY_CRITICAL_MIN_QUANTITY,
  overstockMultiplier: env.INVENTORY_OVERSTOCK_MULTIPLIER,
  maxStockMultiplier: env.INVENTORY_MAX_STOCK_MULTIPLIER,

  // 业务配置
  averageDailySales: env.INVENTORY_AVERAGE_DAILY_SALES,
  alertRefreshInterval: env.INVENTORY_ALERT_REFRESH_INTERVAL,
  alertLimit: env.INVENTORY_ALERT_LIMIT,

  // 兼容性别名
  lowStockThreshold: env.INVENTORY_DEFAULT_MIN_QUANTITY,
  criticalStockThreshold: env.INVENTORY_CRITICAL_MIN_QUANTITY,
} as const;

/**
 * 分页配置对象
 */
export const paginationConfig = {
  defaultPageSize: env.DEFAULT_PAGE_SIZE,
  maxPageSize: env.MAX_PAGE_SIZE,
} as const;

/**
 * 产品模块配置对象
 */
export const productConfig = {
  // 默认查询配置
  defaultIncludeInventory: env.PRODUCT_LIST_INCLUDE_INVENTORY,
  defaultIncludeStatistics: env.PRODUCT_LIST_INCLUDE_STATISTICS,

  // 缓存配置
  cacheWithInventoryTtl: env.PRODUCT_CACHE_WITH_INVENTORY_TTL,
  cacheWithoutInventoryTtl: env.PRODUCT_CACHE_WITHOUT_INVENTORY_TTL,
} as const;

/**
 * 销售订单配置对象
 */
export const salesOrderConfig = {
  orderPrefix: env.SALES_ORDER_PREFIX,
  numberLength: env.SALES_ORDER_NUMBER_LENGTH,
  orderNumberMaxRetry: env.ORDER_NUMBER_MAX_RETRY,
  orderNumberRecentLimit: env.ORDER_NUMBER_RECENT_LIMIT,
} as const;

/**
 * 客户模块配置对象
 */
export const customerConfig = {
  searchLimit: env.CUSTOMER_SEARCH_LIMIT,
  tagLimit: env.CUSTOMER_TAG_LIMIT,
} as const;

/**
 * 仪表盘配置对象
 */
export const dashboardConfig = {
  staleTime: env.DASHBOARD_STALE_TIME,
  refetchInterval: env.DASHBOARD_REFETCH_INTERVAL,
} as const;

/**
 * 厂家发货模块配置对象
 */
export const factoryShipmentConfig = {
  orderPrefix: env.FACTORY_SHIPMENT_ORDER_PREFIX,
  queryLimit: env.FACTORY_SHIPMENT_QUERY_LIMIT,
} as const;

/**
 * 退货/退款模块配置对象
 */
export const returnRefundConfig = {
  refundOrderPrefix: env.REFUND_ORDER_PREFIX,
  returnOrderPrefix: env.RETURN_ORDER_PREFIX,
  returnOrderItemsLimit: env.RETURN_ORDER_ITEMS_LIMIT,
  refundBatchLimit: env.REFUND_BATCH_LIMIT,
} as const;

/**
 * 财务模块配置对象
 */
export const financeConfig = {
  creditLimit: env.FINANCE_CREDIT_LIMIT,
  cacheTtl: env.FINANCE_CACHE_TTL,
} as const;

/**
 * 供应商模块配置对象
 */
export const supplierConfig = {
  queryLimit: env.SUPPLIER_QUERY_LIMIT,
  cacheTtl: env.SUPPLIER_CACHE_TTL,
  defaultStatus: env.SUPPLIER_DEFAULT_STATUS,
} as const;

/**
 * 系统基础设置配置对象
 */
export const systemConfig = {
  defaultLanguage: env.SYSTEM_DEFAULT_LANGUAGE,
  companyName: env.SYSTEM_COMPANY_NAME,
  timezone: env.SYSTEM_TIMEZONE,
} as const;

/**
 * 用户策略配置对象
 */
export const userPolicyConfig = {
  passwordMinLength: env.USER_PASSWORD_MIN_LENGTH,
  maxLoginAttempts: env.USER_MAX_LOGIN_ATTEMPTS,
  sessionTimeout: env.USER_SESSION_TIMEOUT,
} as const;

/**
 * 存储配置对象
 */
export const storageConfig = {
  maxFileSize: env.STORAGE_MAX_FILE_SIZE,
  allowedFileTypes: env.STORAGE_ALLOWED_FILE_TYPES?.split(',') || [],
  encryptionKey: env.STORAGE_ENCRYPTION_KEY,
  region: env.STORAGE_REGION,
} as const;

/**
 * 日志配置扩展对象
 */
export const logExtendedConfig = {
  retentionDays: env.LOG_RETENTION_DAYS,
  criticalActions: env.LOG_CRITICAL_ACTIONS?.split(',') || [],
  criticalTypes: env.LOG_CRITICAL_TYPES?.split(',') || [],
  criticalLevels: env.LOG_CRITICAL_LEVELS?.split(',') || [],
} as const;

/**
 * 日志配置
 */
export const logConfig = {
  level: env.LOG_LEVEL,
} as const;

/**
 * 速率限制配置对象
 */
export const rateLimitConfig = {
  enabled: env.RATE_LIMIT_ENABLED,
  global: env.RATE_LIMIT_GLOBAL,
  auth: env.RATE_LIMIT_AUTH,
  read: env.RATE_LIMIT_READ,
  write: env.RATE_LIMIT_WRITE,
  login: env.RATE_LIMIT_LOGIN,
  captcha: env.RATE_LIMIT_CAPTCHA,
} as const;

/**
 * 性能监控配置对象
 */
export const monitoringConfig = {
  enableMemoryMonitor: env.ENABLE_MEMORY_MONITOR,
  token: env.MONITORING_TOKEN,
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
  console.log(`  - 库存缓存TTL: ${env.INVENTORY_CACHE_TTL}秒`);
  // eslint-disable-next-line no-console
  console.log(
    `  - 库存阈值: 默认${env.INVENTORY_DEFAULT_MIN_QUANTITY}/紧急${env.INVENTORY_CRITICAL_MIN_QUANTITY}/过多倍率${env.INVENTORY_OVERSTOCK_MULTIPLIER}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 分页配置: 默认${env.DEFAULT_PAGE_SIZE}/最大${env.MAX_PAGE_SIZE}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 产品配置: 库存${env.PRODUCT_LIST_INCLUDE_INVENTORY}/统计${env.PRODUCT_LIST_INCLUDE_STATISTICS}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 产品缓存: 含库存${env.PRODUCT_CACHE_WITH_INVENTORY_TTL}s/不含库存${env.PRODUCT_CACHE_WITHOUT_INVENTORY_TTL}s`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 订单配置: 重试${env.ORDER_NUMBER_MAX_RETRY}/最近${env.ORDER_NUMBER_RECENT_LIMIT}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 客户配置: 搜索${env.CUSTOMER_SEARCH_LIMIT}/标签${env.CUSTOMER_TAG_LIMIT}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 仪表盘: 过期${env.DASHBOARD_STALE_TIME}ms/刷新${env.DASHBOARD_REFETCH_INTERVAL}ms`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 厂家发货: 前缀${env.FACTORY_SHIPMENT_ORDER_PREFIX}/查询${env.FACTORY_SHIPMENT_QUERY_LIMIT}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 退货/退款: 退货前缀${env.RETURN_ORDER_PREFIX}/退款前缀${env.REFUND_ORDER_PREFIX}/明细上限${env.RETURN_ORDER_ITEMS_LIMIT}/批量上限${env.REFUND_BATCH_LIMIT}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 财务配置: 信用额度${env.FINANCE_CREDIT_LIMIT}/缓存${env.FINANCE_CACHE_TTL}s`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 销售订单: 前缀${env.SALES_ORDER_PREFIX}/序号位数${env.SALES_ORDER_NUMBER_LENGTH}/重试${env.ORDER_NUMBER_MAX_RETRY}/最近${env.ORDER_NUMBER_RECENT_LIMIT}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 供应商: 查询限制${env.SUPPLIER_QUERY_LIMIT}/缓存${env.SUPPLIER_CACHE_TTL}ms/默认状态${env.SUPPLIER_DEFAULT_STATUS}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 系统设置: 语言${env.SYSTEM_DEFAULT_LANGUAGE}/公司${env.SYSTEM_COMPANY_NAME}/时区${env.SYSTEM_TIMEZONE}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 用户策略: 密码长度${env.USER_PASSWORD_MIN_LENGTH}/登录尝试${env.USER_MAX_LOGIN_ATTEMPTS}/会话${env.USER_SESSION_TIMEOUT}分钟`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 存储配置: 最大${env.STORAGE_MAX_FILE_SIZE}字节/区域${env.STORAGE_REGION}/类型${env.STORAGE_ALLOWED_FILE_TYPES}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 日志扩展: 保留${env.LOG_RETENTION_DAYS}天/关键行为${env.LOG_CRITICAL_ACTIONS}/类型${env.LOG_CRITICAL_TYPES}`
  );
  // eslint-disable-next-line no-console
  console.log(`  - 日志级别: ${env.LOG_LEVEL}`);
  // eslint-disable-next-line no-console
  console.log(`  - Redis: ${env.REDIS_URL} (池大小: ${env.REDIS_POOL_SIZE})`);
  // eslint-disable-next-line no-console
  console.log(
    `  - WS端口: ${env.WS_PORT} (客户端: ${env.NEXT_PUBLIC_WS_PORT})`
  );
}
