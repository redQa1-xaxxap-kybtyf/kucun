'use strict';
/**
 * 环境变量验证模块
 * 使用 Zod 验证所有环境变量，确保类型安全和配置完整性
 * 作为环境配置的单一真理源（Single Source of Truth）
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.shippingQuerySchedulerConfig =
  exports.monitoringConfig =
  exports.rateLimitConfig =
  exports.logConfig =
  exports.logExtendedConfig =
  exports.storageConfig =
  exports.userPolicyConfig =
  exports.systemConfig =
  exports.supplierConfig =
  exports.financeConfig =
  exports.returnRefundConfig =
  exports.logisticsConfig =
  exports.factoryShipmentConfig =
  exports.dashboardConfig =
  exports.customerConfig =
  exports.salesOrderConfig =
  exports.productConfig =
  exports.paginationConfig =
  exports.inventoryConfig =
  exports.cacheConfig =
  exports.appConfig =
  exports.uploadConfig =
  exports.wsConfig =
  exports.redisConfig =
  exports.authConfig =
  exports.dbConfig =
  exports.isTest =
  exports.isProduction =
  exports.isDevelopment =
  exports.env =
    void 0;
/* eslint-disable max-lines */
const zod_1 = require('zod');
// 环境变量验证 Schema
const envSchema = zod_1.z.object({
  // 数据库配置
  DATABASE_URL: zod_1.z
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
  NEXTAUTH_SECRET: zod_1.z
    .string()
    .min(32, 'NEXTAUTH_SECRET 长度至少为32位')
    .describe('Next-Auth 加密密钥'),
  NEXTAUTH_URL: zod_1.z
    .string()
    .url('NEXTAUTH_URL 必须是有效的URL')
    .optional()
    .describe('Next-Auth 回调URL（生产环境必需）'),
  // bcrypt 配置
  BCRYPT_SALT_ROUNDS: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'BCRYPT_SALT_ROUNDS 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 10 && val <= 15, {
      message: 'BCRYPT_SALT_ROUNDS 必须在 10-15 之间',
    })
    .default(12)
    .describe('bcrypt 加密的 salt rounds，推荐值 10-12'),
  // 应用配置
  NODE_ENV: zod_1.z
    .enum(['development', 'production', 'test'])
    .default('development')
    .describe('应用运行环境'),
  // Redis 配置（缓存层）
  REDIS_URL: zod_1.z
    .string()
    .url('REDIS_URL 必须是有效的URL，形如 redis://localhost:6379')
    .default('redis://127.0.0.1:6379')
    .describe('Redis 连接地址'),
  REDIS_PASSWORD: zod_1.z
    .string()
    .optional()
    .describe('Redis 密码（生产环境强烈推荐配置）'),
  REDIS_POOL_SIZE: zod_1.z
    .string()
    .regex(/^\d+$/, 'REDIS_POOL_SIZE 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 50, {
      message: 'REDIS_POOL_SIZE 必须在 1-50 之间',
    })
    .default(3)
    .describe('Redis 连接池大小（推荐 3-10）'),
  REDIS_NAMESPACE: zod_1.z
    .string()
    .min(1, 'REDIS_NAMESPACE 不能为空')
    .default('kucun')
    .describe('Redis 缓存命名空间前缀'),
  REDIS_DB: zod_1.z
    .string()
    .regex(/^\d+$/, 'REDIS_DB 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 0 && val <= 15, {
      message: 'REDIS_DB 必须在 0-15 之间',
    })
    .default(0)
    .describe('Redis 数据库索引（0-15）'),
  REDIS_TLS_ENABLED: zod_1.z
    .enum(['true', 'false'])
    .default('false')
    .transform(val => val === 'true')
    .describe('是否启用 Redis TLS/SSL 连接'),
  REDIS_CONNECT_TIMEOUT: zod_1.z
    .string()
    .regex(/^\d+$/, 'REDIS_CONNECT_TIMEOUT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10000)
    .describe('Redis 连接超时时间（毫秒）'),
  REDIS_COMMAND_TIMEOUT: zod_1.z
    .string()
    .regex(/^\d+$/, 'REDIS_COMMAND_TIMEOUT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5000)
    .describe('Redis 命令超时时间（毫秒）'),
  REDIS_KEEPALIVE: zod_1.z
    .string()
    .regex(/^\d+$/, 'REDIS_KEEPALIVE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(60000)
    .describe('Redis TCP KeepAlive 时间（毫秒）'),
  REDIS_MAX_RETRIES: zod_1.z
    .string()
    .regex(/^\d+$/, 'REDIS_MAX_RETRIES 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 10, {
      message: 'REDIS_MAX_RETRIES 必须在 1-10 之间',
    })
    .default(5)
    .describe('Redis 最大重试次数'),
  // WebSocket 配置
  WS_PORT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'WS_PORT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(3002)
    .describe('WebSocket 服务器端口'),
  WS_ALLOWED_ORIGINS: zod_1.z
    .string()
    .optional()
    .describe('允许的 WebSocket Origin，逗号分隔'),
  NEXT_PUBLIC_WS_PORT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'NEXT_PUBLIC_WS_PORT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(3002)
    .describe('客户端 WebSocket 端口'),
  // 文件上传配置
  UPLOAD_MAX_SIZE: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'UPLOAD_MAX_SIZE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10485760) // 10MB
    .describe('文件上传最大大小（字节）'),
  UPLOAD_DIR: zod_1.z
    .string()
    .min(1, '上传目录路径不能为空')
    .default('./public/uploads')
    .describe('文件上传目录'),
  UPLOAD_FALLBACK_ENABLED: zod_1.z
    .enum(['true', 'false'])
    .default('false')
    .transform(val => val === 'true')
    .describe('上传失败时是否启用本地存储兜底'),
  // 应用端口配置
  PORT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'PORT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(3000)
    .describe('应用服务器端口'),
  // 缓存配置
  PRODUCT_CACHE_TTL: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'PRODUCT_CACHE_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(60)
    .describe('产品缓存时间（秒）'),
  INVENTORY_CACHE_TTL: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_CACHE_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10)
    .describe('库存缓存时间（秒）'),
  // 库存阈值配置
  INVENTORY_DEFAULT_MIN_QUANTITY: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_DEFAULT_MIN_QUANTITY 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10)
    .describe('默认最小库存阈值'),
  INVENTORY_CRITICAL_MIN_QUANTITY: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_CRITICAL_MIN_QUANTITY 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('紧急库存阈值'),
  INVENTORY_OVERSTOCK_MULTIPLIER: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_OVERSTOCK_MULTIPLIER 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('库存过多倍率'),
  INVENTORY_MAX_STOCK_MULTIPLIER: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_MAX_STOCK_MULTIPLIER 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(50)
    .describe('最大库存为最小库存的倍数'),
  // 库存业务配置
  INVENTORY_AVERAGE_DAILY_SALES: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_AVERAGE_DAILY_SALES 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(2)
    .describe('平均日销量假设值'),
  INVENTORY_ALERT_REFRESH_INTERVAL: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_ALERT_REFRESH_INTERVAL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(300000)
    .describe('库存预警刷新间隔（毫秒）'),
  INVENTORY_ALERT_LIMIT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'INVENTORY_ALERT_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(20)
    .describe('库存预警返回数量限制'),
  // 分页配置
  DEFAULT_PAGE_SIZE: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'DEFAULT_PAGE_SIZE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(20)
    .describe('默认分页大小'),
  MAX_PAGE_SIZE: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'MAX_PAGE_SIZE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(100)
    .describe('最大分页大小'),
  // 产品模块配置
  PRODUCT_LIST_INCLUDE_INVENTORY: zod_1.z
    .enum(['true', 'false'])
    .default('false')
    .transform(val => val === 'true')
    .describe('默认是否包含库存统计'),
  PRODUCT_LIST_INCLUDE_STATISTICS: zod_1.z
    .enum(['true', 'false'])
    .default('false')
    .transform(val => val === 'true')
    .describe('默认是否包含统计信息'),
  PRODUCT_CACHE_WITH_INVENTORY_TTL: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'PRODUCT_CACHE_WITH_INVENTORY_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(60)
    .describe('包含库存的产品缓存TTL（秒）'),
  PRODUCT_CACHE_WITHOUT_INVENTORY_TTL: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'PRODUCT_CACHE_WITHOUT_INVENTORY_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(30)
    .describe('不包含库存的产品缓存TTL（秒）'),
  // 销售订单配置
  ORDER_NUMBER_MAX_RETRY: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'ORDER_NUMBER_MAX_RETRY 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10)
    .describe('订单号生成最大重试次数'),
  ORDER_NUMBER_RECENT_LIMIT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'ORDER_NUMBER_RECENT_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('最近订单查询数量'),
  // 客户模块配置
  CUSTOMER_SEARCH_LIMIT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'CUSTOMER_SEARCH_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('客户搜索结果限制'),
  CUSTOMER_TAG_LIMIT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'CUSTOMER_TAG_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10)
    .describe('客户标签数量上限'),
  // 仪表盘配置
  DASHBOARD_STALE_TIME: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'DASHBOARD_STALE_TIME 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(300000)
    .describe('仪表盘数据过期时间（毫秒）'),
  DASHBOARD_REFETCH_INTERVAL: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'DASHBOARD_REFETCH_INTERVAL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(60000)
    .describe('仪表盘刷新间隔（毫秒）'),
  // 厂家发货模块配置
  FACTORY_SHIPMENT_ORDER_PREFIX: zod_1.z
    .string()
    .min(1, 'FACTORY_SHIPMENT_ORDER_PREFIX 不能为空')
    .max(10, 'FACTORY_SHIPMENT_ORDER_PREFIX 不能超过10个字符')
    .default('FS')
    .describe('厂家发货订单号前缀'),
  FACTORY_SHIPMENT_QUERY_LIMIT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'FACTORY_SHIPMENT_QUERY_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(1000)
    .describe('厂家发货表单查询限制'),
  LOGISTICS_WEBHOOK_SECRET: zod_1.z
    .string()
    .min(16, 'LOGISTICS_WEBHOOK_SECRET 长度至少为16位')
    .optional()
    .describe('物流服务推送的签名密钥'),
  // 退货/退款模块配置
  REFUND_ORDER_PREFIX: zod_1.z
    .string()
    .min(1, 'REFUND_ORDER_PREFIX 不能为空')
    .max(10, 'REFUND_ORDER_PREFIX 不能超过10个字符')
    .default('REF')
    .describe('退款单号前缀'),
  RETURN_ORDER_PREFIX: zod_1.z
    .string()
    .min(1, 'RETURN_ORDER_PREFIX 不能为空')
    .max(10, 'RETURN_ORDER_PREFIX 不能超过10个字符')
    .default('RT')
    .describe('退货单号前缀'),
  RETURN_ORDER_ITEMS_LIMIT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'RETURN_ORDER_ITEMS_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(50)
    .describe('退货明细上限'),
  REFUND_BATCH_LIMIT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'REFUND_BATCH_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(50)
    .describe('退款批量处理上限'),
  FINANCE_CREDIT_LIMIT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'FINANCE_CREDIT_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(100000)
    .describe('财务信用额度限制'),
  FINANCE_CACHE_TTL: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'FINANCE_CACHE_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(300)
    .describe('财务数据缓存时间（秒）'),
  // 销售订单模块配置
  SALES_ORDER_PREFIX: zod_1.z
    .string()
    .min(1, 'SALES_ORDER_PREFIX 不能为空')
    .max(10, 'SALES_ORDER_PREFIX 不能超过10个字符')
    .default('SO')
    .describe('销售订单号前缀'),
  SALES_ORDER_NUMBER_LENGTH: zod_1.z
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
  SUPPLIER_QUERY_LIMIT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'SUPPLIER_QUERY_LIMIT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(100)
    .describe('供应商查询默认限制'),
  SUPPLIER_CACHE_TTL: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'SUPPLIER_CACHE_TTL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(300000)
    .describe('供应商数据缓存时间（毫秒）'),
  SUPPLIER_DEFAULT_STATUS: zod_1.z
    .string()
    .min(1, 'SUPPLIER_DEFAULT_STATUS 不能为空')
    .default('active')
    .describe('供应商默认状态过滤'),
  // 系统基础设置配置
  SYSTEM_DEFAULT_LANGUAGE: zod_1.z
    .string()
    .min(1, 'SYSTEM_DEFAULT_LANGUAGE 不能为空')
    .default('zh')
    .describe('系统默认语言'),
  SYSTEM_COMPANY_NAME: zod_1.z
    .string()
    .min(1, 'SYSTEM_COMPANY_NAME 不能为空')
    .max(100, 'SYSTEM_COMPANY_NAME 不能超过100个字符')
    .default('库存管理系统')
    .describe('默认公司名称'),
  SYSTEM_TIMEZONE: zod_1.z
    .string()
    .min(1, 'SYSTEM_TIMEZONE 不能为空')
    .default('Asia/Shanghai')
    .describe('系统时区'),
  // 用户策略配置
  USER_PASSWORD_MIN_LENGTH: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'USER_PASSWORD_MIN_LENGTH 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(
      val => val >= 6 && val <= 20,
      'USER_PASSWORD_MIN_LENGTH 必须在6-20之间'
    )
    .default(8)
    .describe('密码最小长度'),
  USER_MAX_LOGIN_ATTEMPTS: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'USER_MAX_LOGIN_ATTEMPTS 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('最大登录失败次数'),
  USER_SESSION_TIMEOUT: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'USER_SESSION_TIMEOUT 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(90)
    .describe('会话超时时间（分钟）'),
  // 存储配置
  STORAGE_MAX_FILE_SIZE: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'STORAGE_MAX_FILE_SIZE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10485760)
    .describe('最大文件大小（字节）'),
  STORAGE_ALLOWED_FILE_TYPES: zod_1.z
    .string()
    .min(1, 'STORAGE_ALLOWED_FILE_TYPES 不能为空')
    .default('jpg,jpeg,png,pdf,doc,docx,xls,xlsx')
    .describe('允许的文件类型'),
  STORAGE_ENCRYPTION_KEY: zod_1.z
    .string()
    .min(32, 'STORAGE_ENCRYPTION_KEY 必须至少32个字符')
    .max(64, 'STORAGE_ENCRYPTION_KEY 不能超过64个字符')
    .describe('存储加密密钥（必须配置）'),
  STORAGE_REGION: zod_1.z
    .string()
    .min(1, 'STORAGE_REGION 不能为空')
    .default('z0')
    .describe('存储区域'),
  // 日志配置扩展
  LOG_RETENTION_DAYS: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'LOG_RETENTION_DAYS 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(30)
    .describe('日志保留天数'),
  LOG_CRITICAL_ACTIONS: zod_1.z
    .string()
    .min(1, 'LOG_CRITICAL_ACTIONS 不能为空')
    .default('login,logout,delete,update_settings')
    .describe('关键日志行为'),
  LOG_CRITICAL_TYPES: zod_1.z
    .string()
    .min(1, 'LOG_CRITICAL_TYPES 不能为空')
    .default('security,system,error')
    .describe('关键日志类型'),
  LOG_CRITICAL_LEVELS: zod_1.z
    .string()
    .min(1, 'LOG_CRITICAL_LEVELS 不能为空')
    .default('error,warn,info')
    .describe('关键日志级别'),
  // 日志配置
  LOG_LEVEL: zod_1.z
    .enum(['error', 'warn', 'info', 'debug'])
    .default('info')
    .describe('日志级别'),
  // 速率限制配置
  RATE_LIMIT_ENABLED: zod_1.z
    .enum(['true', 'false'])
    .default('true')
    .transform(val => val === 'true')
    .describe('是否启用速率限制'),
  RATE_LIMIT_GLOBAL: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'RATE_LIMIT_GLOBAL 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(100)
    .describe('全局速率限制（请求数/分钟）'),
  RATE_LIMIT_AUTH: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'RATE_LIMIT_AUTH 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('认证API速率限制（请求数/分钟）'),
  RATE_LIMIT_READ: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'RATE_LIMIT_READ 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(60)
    .describe('读取API速率限制（请求数/分钟）'),
  RATE_LIMIT_WRITE: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'RATE_LIMIT_WRITE 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(30)
    .describe('写入API速率限制（请求数/分钟）'),
  RATE_LIMIT_LOGIN: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'RATE_LIMIT_LOGIN 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(5)
    .describe('登录速率限制（请求数/分钟）'),
  RATE_LIMIT_CAPTCHA: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'RATE_LIMIT_CAPTCHA 必须是数字')
    .transform(val => parseInt(val, 10))
    .default(10)
    .describe('验证码速率限制（请求数/分钟）'),
  // 性能监控配置
  ENABLE_MEMORY_MONITOR: zod_1.z
    .enum(['true', 'false'])
    .default('false')
    .transform(val => val === 'true')
    .describe('是否启用内存监控'),
  MONITORING_TOKEN: zod_1.z
    .string()
    .min(1, 'MONITORING_TOKEN 不能为空')
    .default('dev-token-change-in-production')
    .describe('内存监控API访问令牌'),
  // 运输查询定时任务配置
  SHIPPING_QUERY_INTERVAL_HOURS: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'SHIPPING_QUERY_INTERVAL_HOURS 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 24, {
      message: 'SHIPPING_QUERY_INTERVAL_HOURS 必须在 1-24 之间',
    })
    .default(6)
    .describe('运输查询定时任务执行间隔（小时）'),
  SHIPPING_QUERY_MIN_INTERVAL_HOURS: zod_1.z
    .string()
    .regex(/^[\d]+$/, 'SHIPPING_QUERY_MIN_INTERVAL_HOURS 必须是数字')
    .transform(val => parseInt(val, 10))
    .refine(val => val >= 1 && val <= 12, {
      message: 'SHIPPING_QUERY_MIN_INTERVAL_HOURS 必须在 1-12 之间',
    })
    .default(2)
    .describe('两次运输查询之间的最小间隔（小时）'),
  SHIPPING_QUERY_AUTO_ENABLED: zod_1.z
    .enum(['true', 'false'])
    .default('true')
    .transform(val => val === 'true')
    .describe('是否启用运输查询自动调度'),
});
/**
 * 验证并解析环境变量
 * @returns 验证后的环境变量对象
 * @throws 如果环境变量验证失败
 */
/* eslint-disable max-lines-per-function */
function validateEnv() {
  const isJestEnvironment =
    typeof process !== 'undefined' && process.env.JEST_WORKER_ID !== undefined;
  // 在客户端环境下，只验证公开的环境变量
  if (typeof window !== 'undefined' && !isJestEnvironment) {
    const clientEnvSchema = zod_1.z.object({
      NEXT_PUBLIC_WS_PORT: zod_1.z
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
        SHIPPING_QUERY_INTERVAL_HOURS: 6,
        SHIPPING_QUERY_MIN_INTERVAL_HOURS: 2,
        SHIPPING_QUERY_AUTO_ENABLED: true,
      };
    } catch (_error) {
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
        SHIPPING_QUERY_INTERVAL_HOURS: 6,
        SHIPPING_QUERY_MIN_INTERVAL_HOURS: 2,
        SHIPPING_QUERY_AUTO_ENABLED: true,
      };
    }
  }
  // 服务器端验证完整的环境变量
  try {
    const parsed = envSchema.parse(process.env);
    return parsed;
  } catch (error) {
    if (error instanceof zod_1.z.ZodError) {
      const errorMessages = error.issues.map(
        err => `${err.path.join('.')}: ${err.message}`
      );
      /* eslint-disable no-console */
      console.error('❌ 环境变量验证失败:');
      errorMessages.forEach(msg => console.error(`  - ${msg}`));
      /* eslint-enable no-console */
      throw new Error(`环境变量验证失败:\n${errorMessages.join('\n')}`);
    }
    throw error;
  }
}
/* eslint-enable max-lines-per-function */
/**
 * 验证后的环境变量对象
 * 作为项目中所有环境配置的单一真理源
 */
exports.env = validateEnv();
/**
 * 开发环境检查
 */
exports.isDevelopment = exports.env.NODE_ENV === 'development';
/**
 * 生产环境检查
 */
exports.isProduction = exports.env.NODE_ENV === 'production';
/**
 * 测试环境检查
 */
exports.isTest = exports.env.NODE_ENV === 'test';
/**
 * 数据库配置
 */
exports.dbConfig = {
  url: exports.env.DATABASE_URL,
};
/**
 * 认证配置
 */
exports.authConfig = {
  secret: exports.env.NEXTAUTH_SECRET,
  url: exports.env.NEXTAUTH_URL,
};
/**
 * Redis 配置
 */
exports.redisConfig = {
  url: exports.env.REDIS_URL,
  password: exports.env.REDIS_PASSWORD,
  poolSize: exports.env.REDIS_POOL_SIZE,
  namespace: exports.env.REDIS_NAMESPACE,
  db: exports.env.REDIS_DB,
  tlsEnabled: exports.env.REDIS_TLS_ENABLED,
  connectTimeout: exports.env.REDIS_CONNECT_TIMEOUT,
  commandTimeout: exports.env.REDIS_COMMAND_TIMEOUT,
  keepAlive: exports.env.REDIS_KEEPALIVE,
  maxRetries: exports.env.REDIS_MAX_RETRIES,
};
/**
 * WebSocket 配置
 */
exports.wsConfig = {
  port: exports.env.WS_PORT,
  clientPort: exports.env.NEXT_PUBLIC_WS_PORT,
  allowedOrigins:
    exports.env.WS_ALLOWED_ORIGINS?.split(',')
      .map(s => s.trim())
      .filter(Boolean) || [],
};
/**
 * 上传配置
 */
exports.uploadConfig = {
  maxSize: exports.env.UPLOAD_MAX_SIZE,
  directory: exports.env.UPLOAD_DIR,
  fallbackEnabled: exports.env.UPLOAD_FALLBACK_ENABLED,
};
/**
 * 应用配置
 */
exports.appConfig = {
  port: exports.env.PORT,
};
/**
 * 缓存配置
 */
exports.cacheConfig = {
  productTtl: exports.env.PRODUCT_CACHE_TTL,
  inventoryTtl: exports.env.INVENTORY_CACHE_TTL,
};
/**
 * 库存配置对象
 */
exports.inventoryConfig = {
  // 阈值配置
  defaultMinQuantity: exports.env.INVENTORY_DEFAULT_MIN_QUANTITY,
  criticalMinQuantity: exports.env.INVENTORY_CRITICAL_MIN_QUANTITY,
  overstockMultiplier: exports.env.INVENTORY_OVERSTOCK_MULTIPLIER,
  maxStockMultiplier: exports.env.INVENTORY_MAX_STOCK_MULTIPLIER,
  // 业务配置
  averageDailySales: exports.env.INVENTORY_AVERAGE_DAILY_SALES,
  alertRefreshInterval: exports.env.INVENTORY_ALERT_REFRESH_INTERVAL,
  alertLimit: exports.env.INVENTORY_ALERT_LIMIT,
  // 兼容性别名
  lowStockThreshold: exports.env.INVENTORY_DEFAULT_MIN_QUANTITY,
  criticalStockThreshold: exports.env.INVENTORY_CRITICAL_MIN_QUANTITY,
};
/**
 * 分页配置对象
 */
exports.paginationConfig = {
  defaultPageSize: exports.env.DEFAULT_PAGE_SIZE,
  maxPageSize: exports.env.MAX_PAGE_SIZE,
};
/**
 * 产品模块配置对象
 */
exports.productConfig = {
  // 默认查询配置
  defaultIncludeInventory: exports.env.PRODUCT_LIST_INCLUDE_INVENTORY,
  defaultIncludeStatistics: exports.env.PRODUCT_LIST_INCLUDE_STATISTICS,
  // 缓存配置
  cacheWithInventoryTtl: exports.env.PRODUCT_CACHE_WITH_INVENTORY_TTL,
  cacheWithoutInventoryTtl: exports.env.PRODUCT_CACHE_WITHOUT_INVENTORY_TTL,
};
/**
 * 销售订单配置对象
 */
exports.salesOrderConfig = {
  orderPrefix: exports.env.SALES_ORDER_PREFIX,
  numberLength: exports.env.SALES_ORDER_NUMBER_LENGTH,
  orderNumberMaxRetry: exports.env.ORDER_NUMBER_MAX_RETRY,
  orderNumberRecentLimit: exports.env.ORDER_NUMBER_RECENT_LIMIT,
};
/**
 * 客户模块配置对象
 */
exports.customerConfig = {
  searchLimit: exports.env.CUSTOMER_SEARCH_LIMIT,
  tagLimit: exports.env.CUSTOMER_TAG_LIMIT,
};
/**
 * 仪表盘配置对象
 */
exports.dashboardConfig = {
  staleTime: exports.env.DASHBOARD_STALE_TIME,
  refetchInterval: exports.env.DASHBOARD_REFETCH_INTERVAL,
};
/**
 * 厂家发货模块配置对象
 */
exports.factoryShipmentConfig = {
  orderPrefix: exports.env.FACTORY_SHIPMENT_ORDER_PREFIX,
  queryLimit: exports.env.FACTORY_SHIPMENT_QUERY_LIMIT,
};
exports.logisticsConfig = {
  webhookSecret: exports.env.LOGISTICS_WEBHOOK_SECRET,
};
/**
 * 退货/退款模块配置对象
 */
exports.returnRefundConfig = {
  refundOrderPrefix: exports.env.REFUND_ORDER_PREFIX,
  returnOrderPrefix: exports.env.RETURN_ORDER_PREFIX,
  returnOrderItemsLimit: exports.env.RETURN_ORDER_ITEMS_LIMIT,
  refundBatchLimit: exports.env.REFUND_BATCH_LIMIT,
};
/**
 * 财务模块配置对象
 */
exports.financeConfig = {
  creditLimit: exports.env.FINANCE_CREDIT_LIMIT,
  cacheTtl: exports.env.FINANCE_CACHE_TTL,
};
/**
 * 供应商模块配置对象
 */
exports.supplierConfig = {
  queryLimit: exports.env.SUPPLIER_QUERY_LIMIT,
  cacheTtl: exports.env.SUPPLIER_CACHE_TTL,
  defaultStatus: exports.env.SUPPLIER_DEFAULT_STATUS,
};
/**
 * 系统基础设置配置对象
 */
exports.systemConfig = {
  defaultLanguage: exports.env.SYSTEM_DEFAULT_LANGUAGE,
  companyName: exports.env.SYSTEM_COMPANY_NAME,
  timezone: exports.env.SYSTEM_TIMEZONE,
};
/**
 * 用户策略配置对象
 */
exports.userPolicyConfig = {
  passwordMinLength: exports.env.USER_PASSWORD_MIN_LENGTH,
  maxLoginAttempts: exports.env.USER_MAX_LOGIN_ATTEMPTS,
  sessionTimeout: exports.env.USER_SESSION_TIMEOUT,
};
/**
 * 存储配置对象
 */
exports.storageConfig = {
  maxFileSize: exports.env.STORAGE_MAX_FILE_SIZE,
  allowedFileTypes: exports.env.STORAGE_ALLOWED_FILE_TYPES?.split(',') || [],
  encryptionKey: exports.env.STORAGE_ENCRYPTION_KEY,
  region: exports.env.STORAGE_REGION,
};
/**
 * 日志配置扩展对象
 */
exports.logExtendedConfig = {
  retentionDays: exports.env.LOG_RETENTION_DAYS,
  criticalActions: exports.env.LOG_CRITICAL_ACTIONS?.split(',') || [],
  criticalTypes: exports.env.LOG_CRITICAL_TYPES?.split(',') || [],
  criticalLevels: exports.env.LOG_CRITICAL_LEVELS?.split(',') || [],
};
/**
 * 日志配置
 */
exports.logConfig = {
  level: exports.env.LOG_LEVEL,
};
/**
 * 速率限制配置对象
 */
exports.rateLimitConfig = {
  enabled: exports.env.RATE_LIMIT_ENABLED,
  global: exports.env.RATE_LIMIT_GLOBAL,
  auth: exports.env.RATE_LIMIT_AUTH,
  read: exports.env.RATE_LIMIT_READ,
  write: exports.env.RATE_LIMIT_WRITE,
  login: exports.env.RATE_LIMIT_LOGIN,
  captcha: exports.env.RATE_LIMIT_CAPTCHA,
};
/**
 * 性能监控配置对象
 */
exports.monitoringConfig = {
  enableMemoryMonitor: exports.env.ENABLE_MEMORY_MONITOR,
  token: exports.env.MONITORING_TOKEN,
};
/**
 * 运输查询调度器配置对象
 */
exports.shippingQuerySchedulerConfig = {
  intervalHours: exports.env.SHIPPING_QUERY_INTERVAL_HOURS,
  minQueryIntervalHours: exports.env.SHIPPING_QUERY_MIN_INTERVAL_HOURS,
  enabled: exports.env.SHIPPING_QUERY_AUTO_ENABLED,
};
// 在开发环境下打印配置信息（不包含敏感信息）
if (exports.isDevelopment) {
  // eslint-disable-next-line no-console
  console.log('🔧 环境配置已加载:');
  // eslint-disable-next-line no-console
  console.log(`  - 环境: ${exports.env.NODE_ENV}`);
  // eslint-disable-next-line no-console
  console.log(`  - 应用端口: ${exports.env.PORT}`);
  // eslint-disable-next-line no-console
  console.log(
    `  - 数据库: ${exports.env.DATABASE_URL.includes('sqlite') ? 'SQLite (开发)' : 'MySQL (生产)'}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 上传目录: ${exports.env.UPLOAD_DIR} (最大: ${exports.env.UPLOAD_MAX_SIZE} bytes)`
  );
  // eslint-disable-next-line no-console
  console.log(`  - 产品缓存TTL: ${exports.env.PRODUCT_CACHE_TTL}秒`);
  // eslint-disable-next-line no-console
  console.log(`  - 库存缓存TTL: ${exports.env.INVENTORY_CACHE_TTL}秒`);
  // eslint-disable-next-line no-console
  console.log(
    `  - 库存阈值: 默认${exports.env.INVENTORY_DEFAULT_MIN_QUANTITY}/紧急${exports.env.INVENTORY_CRITICAL_MIN_QUANTITY}/过多倍率${exports.env.INVENTORY_OVERSTOCK_MULTIPLIER}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 分页配置: 默认${exports.env.DEFAULT_PAGE_SIZE}/最大${exports.env.MAX_PAGE_SIZE}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 产品配置: 库存${exports.env.PRODUCT_LIST_INCLUDE_INVENTORY}/统计${exports.env.PRODUCT_LIST_INCLUDE_STATISTICS}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 产品缓存: 含库存${exports.env.PRODUCT_CACHE_WITH_INVENTORY_TTL}s/不含库存${exports.env.PRODUCT_CACHE_WITHOUT_INVENTORY_TTL}s`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 订单配置: 重试${exports.env.ORDER_NUMBER_MAX_RETRY}/最近${exports.env.ORDER_NUMBER_RECENT_LIMIT}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 客户配置: 搜索${exports.env.CUSTOMER_SEARCH_LIMIT}/标签${exports.env.CUSTOMER_TAG_LIMIT}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 仪表盘: 过期${exports.env.DASHBOARD_STALE_TIME}ms/刷新${exports.env.DASHBOARD_REFETCH_INTERVAL}ms`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 厂家发货: 前缀${exports.env.FACTORY_SHIPMENT_ORDER_PREFIX}/查询${exports.env.FACTORY_SHIPMENT_QUERY_LIMIT}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 退货/退款: 退货前缀${exports.env.RETURN_ORDER_PREFIX}/退款前缀${exports.env.REFUND_ORDER_PREFIX}/明细上限${exports.env.RETURN_ORDER_ITEMS_LIMIT}/批量上限${exports.env.REFUND_BATCH_LIMIT}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 财务配置: 信用额度${exports.env.FINANCE_CREDIT_LIMIT}/缓存${exports.env.FINANCE_CACHE_TTL}s`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 销售订单: 前缀${exports.env.SALES_ORDER_PREFIX}/序号位数${exports.env.SALES_ORDER_NUMBER_LENGTH}/重试${exports.env.ORDER_NUMBER_MAX_RETRY}/最近${exports.env.ORDER_NUMBER_RECENT_LIMIT}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 供应商: 查询限制${exports.env.SUPPLIER_QUERY_LIMIT}/缓存${exports.env.SUPPLIER_CACHE_TTL}ms/默认状态${exports.env.SUPPLIER_DEFAULT_STATUS}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 系统设置: 语言${exports.env.SYSTEM_DEFAULT_LANGUAGE}/公司${exports.env.SYSTEM_COMPANY_NAME}/时区${exports.env.SYSTEM_TIMEZONE}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 用户策略: 密码长度${exports.env.USER_PASSWORD_MIN_LENGTH}/登录尝试${exports.env.USER_MAX_LOGIN_ATTEMPTS}/会话${exports.env.USER_SESSION_TIMEOUT}分钟`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 存储配置: 最大${exports.env.STORAGE_MAX_FILE_SIZE}字节/区域${exports.env.STORAGE_REGION}/类型${exports.env.STORAGE_ALLOWED_FILE_TYPES}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 日志扩展: 保留${exports.env.LOG_RETENTION_DAYS}天/关键行为${exports.env.LOG_CRITICAL_ACTIONS}/类型${exports.env.LOG_CRITICAL_TYPES}`
  );
  // eslint-disable-next-line no-console
  console.log(`  - 日志级别: ${exports.env.LOG_LEVEL}`);
  // eslint-disable-next-line no-console
  console.log(
    `  - Redis: ${exports.env.REDIS_URL} (池大小: ${exports.env.REDIS_POOL_SIZE})`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - WS端口: ${exports.env.WS_PORT} (客户端: ${exports.env.NEXT_PUBLIC_WS_PORT})`
  );
  // eslint-disable-next-line no-console
  console.log(
    `  - 运输查询调度: 间隔${exports.env.SHIPPING_QUERY_INTERVAL_HOURS}小时/最小间隔${exports.env.SHIPPING_QUERY_MIN_INTERVAL_HOURS}小时/启用${exports.env.SHIPPING_QUERY_AUTO_ENABLED}`
  );
}
/* eslint-enable max-lines */
