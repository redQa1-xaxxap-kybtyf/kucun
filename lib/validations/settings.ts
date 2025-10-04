/**
 * 系统设置相关Zod验证规则
 * 严格遵循全栈项目统一约定规范
 */

import { z } from 'zod';

import {
  inventoryConfig,
  logExtendedConfig,
  paginationConfig,
  returnRefundConfig,
  salesOrderConfig,
  storageConfig,
  systemConfig,
  userPolicyConfig,
} from '@/lib/env';

// 设置数据类型验证
export const SettingDataTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'json',
]);

// 设置分类验证
export const SettingCategorySchema = z.enum([
  'basic',
  'user',
  'storage',
  'log',
]);

// 系统设置基础验证
export const SystemSettingSchema = z.object({
  id: z.string().uuid('ID格式不正确'),
  key: z.string().min(1, '设置键不能为空').max(100, '设置键不能超过100个字符'),
  value: z.string(),
  category: SettingCategorySchema.default('basic'),
  description: z.string().max(500, '描述不能超过500个字符').optional(),
  dataType: SettingDataTypeSchema.default('string'),
  isPublic: z.boolean().default(false),
  createdAt: z.string().datetime('创建时间格式不正确'),
  updatedAt: z.string().datetime('更新时间格式不正确'),
});

// 基本设置验证规则
export const BasicSettingsSchema = z.object({
  // 公司信息
  companyName: z
    .string()
    .min(1, '公司名称不能为空')
    .max(100, '公司名称不能超过100个字符'),
  companyAddress: z.string().max(200, '公司地址不能超过200个字符').optional(),
  companyPhone: z
    .string()
    .regex(/^[\d\s\-\+\(\)]+$/, '电话号码格式不正确')
    .optional()
    .or(z.literal('')),
  companyEmail: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  companyWebsite: z
    .string()
    .url('网站地址格式不正确')
    .optional()
    .or(z.literal('')),

  // 系统配置
  systemName: z
    .string()
    .min(1, '系统名称不能为空')
    .max(50, '系统名称不能超过50个字符'),
  systemVersion: z.string().max(20, '系统版本不能超过20个字符').optional(),
  systemDescription: z
    .string()
    .max(500, '系统描述不能超过500个字符')
    .optional(),

  // 业务配置
  defaultLanguage: z
    .string()
    .length(2, '语言代码必须为2位')
    .default(systemConfig.defaultLanguage),

  // 库存配置
  lowStockThreshold: z
    .number()
    .int('库存阈值必须为整数')
    .min(1, '库存阈值必须大于0')
    .max(9999, '库存阈值不能超过9999')
    .default(inventoryConfig.defaultMinQuantity),
  enableStockAlerts: z.boolean().default(true),

  // 订单配置
  orderNumberPrefix: z
    .string()
    .max(10, '订单号前缀不能超过10个字符')
    .default(salesOrderConfig.orderPrefix),
  enableOrderApproval: z.boolean().default(false),
});

// 用户管理设置验证规则
export const UserSettingsSchema = z.object({
  // 密码策略
  minPasswordLength: z
    .number()
    .int()
    .min(6, '密码最小长度不能小于6位')
    .max(50, '密码最大长度不能超过50位')
    .default(userPolicyConfig.passwordMinLength),
  requireSpecialChars: z.boolean().default(true),
  passwordExpiryDays: z
    .number()
    .int()
    .min(0, '密码过期天数不能小于0')
    .default(90),

  // 会话配置
  sessionTimeoutMinutes: z
    .number()
    .int()
    .min(5, '会话超时时间不能小于5分钟')
    .max(1440, '会话超时时间不能超过24小时')
    .default(userPolicyConfig.sessionTimeout),
  maxLoginAttempts: z
    .number()
    .int()
    .min(1, '最大登录尝试次数不能小于1')
    .max(10, '最大登录尝试次数不能超过10')
    .default(userPolicyConfig.maxLoginAttempts),
  lockoutDurationMinutes: z
    .number()
    .int()
    .min(1, '锁定时长不能小于1分钟')
    .default(15),

  // 权限配置
  defaultUserRole: z.enum(['admin', 'sales']).default('sales'),
  enableUserRegistration: z.boolean().default(false),
});

// 七牛云存储设置验证规则
export const StorageSettingsSchema = z.object({
  // 七牛云配置
  qiniuAccessKey: z.string().min(1, 'Access Key不能为空'),
  qiniuSecretKey: z.string().min(1, 'Secret Key不能为空'),
  qiniuBucket: z.string().min(1, 'Bucket名称不能为空'),
  qiniuDomain: z.string().url('域名格式不正确'),
  qiniuRegion: z.string().min(1, '区域不能为空'),

  // 上传配置
  maxFileSize: z
    .number()
    .int()
    .min(1, '最大文件大小不能小于1MB')
    .max(100, '最大文件大小不能超过100MB')
    .default(Math.floor(storageConfig.maxFileSize / 1024 / 1024)), // 转换为MB
  allowedFileTypes: z
    .array(z.string())
    .min(1, '至少需要允许一种文件类型')
    .default(storageConfig.allowedFileTypes),
  enableImageCompression: z.boolean().default(true),
  imageQuality: z
    .number()
    .int()
    .min(10, '图片质量不能小于10%')
    .max(100, '图片质量不能超过100%')
    .default(80),
});

// 系统日志设置验证规则
export const LogSettingsSchema = z.object({
  // 日志级别
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // 日志保留
  logRetentionDays: z
    .number()
    .int()
    .min(1, '日志保留天数不能小于1天')
    .max(365, '日志保留天数不能超过365天')
    .default(logExtendedConfig.retentionDays),
  enableLogRotation: z.boolean().default(true),
  maxLogFileSize: z
    .number()
    .int()
    .min(1, '最大日志文件大小不能小于1MB')
    .max(1000, '最大日志文件大小不能超过1000MB')
    .default(100),

  // 审计日志
  enableAuditLog: z.boolean().default(true),
  auditLogEvents: z
    .array(z.string())
    .default(logExtendedConfig.criticalActions),
});

// 设置更新请求验证
export const SettingUpdateRequestSchema = z.object({
  key: z.string().min(1, '设置键不能为空').max(100, '设置键不能超过100个字符'),
  value: z.string(),
  category: SettingCategorySchema.optional(),
  description: z.string().max(500, '描述不能超过500个字符').optional(),
  dataType: SettingDataTypeSchema.optional(),
  isPublic: z.boolean().optional(),
});

// 批量设置更新请求验证
export const BatchSettingUpdateRequestSchema = z.object({
  settings: z
    .array(SettingUpdateRequestSchema)
    .min(1, '至少需要更新一个设置项')
    .max(
      returnRefundConfig.refundBatchLimit,
      `批量更新最多支持${returnRefundConfig.refundBatchLimit}个设置项`
    ),
});

// 设置查询参数验证
export const SettingsQuerySchema = z.object({
  category: SettingCategorySchema.optional(),
  isPublic: z.boolean().optional(),
  keys: z.array(z.string()).optional(),
});

// 基本设置表单验证（用于前端表单）
export const BasicSettingsFormSchema = BasicSettingsSchema.partial();

// 用户设置表单验证（用于前端表单）
export const UserSettingsFormSchema = UserSettingsSchema.partial();

// 存储设置表单验证（用于前端表单）
export const StorageSettingsFormSchema = StorageSettingsSchema.partial();

// 日志设置表单验证（用于前端表单）
export const LogSettingsFormSchema = LogSettingsSchema.partial();

// 用户管理相关验证规则
export const CreateUserSchema = z.object({
  username: z
    .string()
    .min(3, '用户名至少需要3个字符')
    .max(20, '用户名不能超过20个字符')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
  email: z.string().email('邮箱格式不正确'),
  name: z.string().min(1, '姓名不能为空').max(50, '姓名不能超过50个字符'),
  password: z
    .string()
    .min(6, '密码至少需要6个字符')
    .max(50, '密码不能超过50个字符'),
  role: z.enum(['admin', 'sales'], {
    error: '角色必须是管理员或销售员',
  }),
});

export const UpdateUserSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
  username: z
    .string()
    .min(3, '用户名至少需要3个字符')
    .max(20, '用户名不能超过20个字符')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线')
    .optional(),
  email: z.string().email('邮箱格式不正确').optional(),
  name: z
    .string()
    .min(1, '姓名不能为空')
    .max(50, '姓名不能超过50个字符')
    .optional(),
  role: z
    .enum(['admin', 'sales'], {
      error: '角色必须是管理员或销售员',
    })
    .optional(),
  status: z
    .enum(['active', 'inactive'], {
      error: '状态必须是启用或禁用',
    })
    .optional(),
});

export const UserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(paginationConfig.maxPageSize)
    .default(paginationConfig.defaultPageSize)
    .optional(),
  search: z.string().optional().nullable(),
  role: z.enum(['admin', 'sales']).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().nullable(),
});

export const ResetPasswordSchema = z.object({
  userId: z.string().uuid('用户ID格式不正确'),
  newPassword: z
    .string()
    .min(6, '密码至少需要6个字符')
    .max(50, '密码不能超过50个字符'),
});

// 七牛云存储配置验证规则
export const QiniuStorageConfigSchema = z.object({
  accessKey: z
    .string()
    .min(1, 'Access Key不能为空')
    .max(100, 'Access Key不能超过100个字符')
    .regex(/^[A-Za-z0-9_-]+$/, 'Access Key格式不正确'),
  secretKey: z
    .string()
    .min(1, 'Secret Key不能为空')
    .max(100, 'Secret Key不能超过100个字符')
    .regex(/^[A-Za-z0-9_-]+$/, 'Secret Key格式不正确'),
  bucket: z
    .string()
    .min(1, '存储空间名称不能为空')
    .max(50, '存储空间名称不能超过50个字符')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, '存储空间名称格式不正确'),
  domain: z
    .string()
    .min(1, '访问域名不能为空')
    .max(200, '访问域名不能超过200个字符')
    .regex(
      /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*(:[1-9][0-9]{0,4})?(\/.*)?$/,
      '访问域名格式不正确，请输入完整的HTTP/HTTPS地址（例如: https://cdn.example.com）'
    )
    .refine(
      value => {
        // 提取端口号并验证范围 (1-65535)
        const portMatch = value.match(/:(\d+)/);
        if (portMatch) {
          const port = parseInt(portMatch[1], 10);
          return port >= 1 && port <= 65535;
        }
        return true;
      },
      { message: '端口号必须在 1-65535 范围内' }
    ),
  region: z.string().max(20, '存储区域不能超过20个字符').optional().nullable(),
  pathFormat: z
    .string()
    .max(200, '存储目录格式不能超过200个字符')
    .optional()
    .nullable()
    .refine(
      value => {
        if (!value) {
          return true;
        }
        // 只允许字母、数字、斜杠、大括号、下划线、连字符
        const validPattern = /^[a-zA-Z0-9/{}\-_]+$/;
        if (!validPattern.test(value)) {
          return false;
        }
        // 检查变量是否有效
        const validVars = ['{y}', '{m}', '{d}'];
        const vars = value.match(/\{[^}]+\}/g) || [];
        return vars.every(v => validVars.includes(v));
      },
      {
        message:
          '存储目录格式只能包含字母、数字、斜杠(/)、变量{y}(年)、{m}(月)、{d}(日)，不支持其他特殊符号',
      }
    ),
});

export const QiniuStorageTestSchema = z.object({
  accessKey: z
    .string()
    .min(1, 'Access Key不能为空')
    .regex(/^[A-Za-z0-9_-]+$/, 'Access Key格式不正确'),
  secretKey: z
    .string()
    .min(1, 'Secret Key不能为空')
    .regex(/^[A-Za-z0-9_-]+$/, 'Secret Key格式不正确'),
  bucket: z
    .string()
    .min(1, '存储空间名称不能为空')
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, '存储空间名称格式不正确'),
  region: z.string().max(20, '存储区域不能超过20个字符').optional().nullable(),
});

// 系统日志相关验证规则
export const SystemLogFiltersSchema = z.object({
  type: z
    .enum([
      'user_action',
      'business_operation',
      'system_event',
      'error',
      'security',
    ])
    .optional()
    .nullable(),
  level: z.enum(['info', 'warning', 'error', 'critical']).optional().nullable(),
  userId: z.string().optional().nullable(),
  action: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  search: z.string().optional().nullable(),
});

export const SystemLogListRequestSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z
    .number()
    .int()
    .min(1)
    .max(paginationConfig.maxPageSize)
    .default(paginationConfig.defaultPageSize),
  filters: SystemLogFiltersSchema.optional(),
});

export const SystemLogExportRequestSchema = z.object({
  format: z.enum(['csv', 'json']),
  filters: SystemLogFiltersSchema.optional(),
});

export const SystemLogCleanupRequestSchema = z.object({
  beforeDate: z
    .string()
    .refine(date => !isNaN(Date.parse(date)), '日期格式不正确'),
  types: z
    .array(
      z.enum([
        'user_action',
        'business_operation',
        'system_event',
        'error',
        'security',
      ])
    )
    .optional(),
});
