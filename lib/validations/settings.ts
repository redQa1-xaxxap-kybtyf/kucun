/**
 * 系统设置验证规则
 * 使用Zod进行数据验证，确保类型安全
 */

import { z } from 'zod';

// 基础设置验证规则
export const BasicSettingsSchema = z.object({
  companyName: z
    .string()
    .min(1, '公司名称不能为空')
    .max(100, '公司名称不能超过100个字符'),
  systemName: z
    .string()
    .min(1, '系统名称不能为空')
    .max(50, '系统名称不能超过50个字符'),
  logoUrl: z.string().url('Logo URL格式不正确').optional().or(z.literal('')),
  timezone: z.string().min(1, '时区不能为空'),
  language: z.string().min(1, '语言不能为空'),
  currency: z.string().min(1, '货币不能为空'),
  address: z.string().max(200, '地址不能超过200个字符').optional(),
  phone: z
    .string()
    .regex(/^[\d\s\-\+\(\)]+$/, '电话号码格式不正确')
    .optional()
    .or(z.literal('')),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
});

// 用户管理设置验证规则
export const UserManagementSettingsSchema = z.object({
  passwordMinLength: z
    .number()
    .min(6, '密码最小长度不能少于6位')
    .max(32, '密码最小长度不能超过32位'),
  passwordRequireUppercase: z.boolean(),
  passwordRequireLowercase: z.boolean(),
  passwordRequireNumbers: z.boolean(),
  passwordRequireSpecialChars: z.boolean(),
  sessionTimeoutHours: z
    .number()
    .min(1, '会话超时时间不能少于1小时')
    .max(24, '会话超时时间不能超过24小时'),
  maxLoginAttempts: z
    .number()
    .min(3, '最大登录尝试次数不能少于3次')
    .max(10, '最大登录尝试次数不能超过10次'),
  lockoutDurationMinutes: z
    .number()
    .min(5, '锁定时间不能少于5分钟')
    .max(1440, '锁定时间不能超过24小时'),
  enableTwoFactor: z.boolean(),
});

// 业务设置验证规则
export const BusinessSettingsSchema = z.object({
  lowStockThreshold: z
    .number()
    .min(0, '库存预警阈值不能为负数')
    .max(1000, '库存预警阈值不能超过1000'),
  orderNumberFormat: z
    .string()
    .min(1, '订单编号格式不能为空')
    .max(50, '订单编号格式不能超过50个字符'),
  returnPeriodDays: z
    .number()
    .min(0, '退货期限不能为负数')
    .max(365, '退货期限不能超过365天'),
  priceDecimalPlaces: z
    .number()
    .min(0, '价格小数位数不能为负数')
    .max(4, '价格小数位数不能超过4位'),
  defaultTaxRate: z
    .number()
    .min(0, '税率不能为负数')
    .max(1, '税率不能超过100%'),
  paymentMethods: z.array(z.string()).min(1, '至少需要选择一种付款方式'),
  enableInventoryTracking: z.boolean(),
  enableBarcodeScanning: z.boolean(),
  autoGenerateOrderNumbers: z.boolean(),
});

// 通知设置验证规则
export const NotificationSettingsSchema = z.object({
  enableLowStockAlerts: z.boolean(),
  enableOrderNotifications: z.boolean(),
  enableSystemNotifications: z.boolean(),
  enableEmailNotifications: z.boolean(),
  enableSoundAlerts: z.boolean(),
  lowStockThresholdPercent: z
    .number()
    .min(0, '库存预警百分比不能为负数')
    .max(100, '库存预警百分比不能超过100%'),
  emailRecipients: z.array(z.string().email('邮箱格式不正确')).optional(),
});

// 数据管理设置验证规则
export const DataManagementSettingsSchema = z.object({
  // 数据备份设置
  autoBackupEnabled: z.boolean(),
  backupFrequency: z.enum(['daily', 'weekly', 'monthly'], {
    errorMap: () => ({ message: '备份频率必须是每日、每周或每月' }),
  }),
  backupTime: z
    .string()
    .regex(
      /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
      '备份时间格式不正确，请使用HH:mm格式'
    ),
  backupRetentionDays: z
    .number()
    .min(7, '备份保留天数不能少于7天')
    .max(365, '备份保留天数不能超过365天'),
  backupStoragePath: z.string().min(1, '备份存储路径不能为空'),
  backupCompression: z.boolean(),

  // 数据导出设置
  exportFormats: z
    .array(z.enum(['excel', 'csv', 'json']))
    .min(1, '至少需要选择一种导出格式'),
  exportMaxRecords: z
    .number()
    .min(100, '导出最大记录数不能少于100')
    .max(1000000, '导出最大记录数不能超过100万'),
  exportIncludeDeleted: z.boolean(),
  exportScheduleEnabled: z.boolean(),
  exportScheduleFrequency: z.enum(['daily', 'weekly', 'monthly'], {
    errorMap: () => ({ message: '导出计划频率必须是每日、每周或每月' }),
  }),

  // 系统维护设置
  autoCleanupEnabled: z.boolean(),
  logRetentionDays: z
    .number()
    .min(7, '日志保留天数不能少于7天')
    .max(365, '日志保留天数不能超过365天'),
  tempFileCleanupDays: z
    .number()
    .min(1, '临时文件清理天数不能少于1天')
    .max(30, '临时文件清理天数不能超过30天'),
  cacheCleanupFrequency: z.enum(['daily', 'weekly'], {
    errorMap: () => ({ message: '缓存清理频率必须是每日或每周' }),
  }),
  performanceMonitoringEnabled: z.boolean(),
  maxFileUploadSizeMB: z
    .number()
    .min(1, '最大文件上传大小不能少于1MB')
    .max(100, '最大文件上传大小不能超过100MB'),

  // 数据库维护
  dbOptimizationEnabled: z.boolean(),
  dbOptimizationFrequency: z.enum(['weekly', 'monthly'], {
    errorMap: () => ({ message: '数据库优化频率必须是每周或每月' }),
  }),
  dbBackupBeforeOptimization: z.boolean(),
});

// 完整系统设置验证规则
export const SystemSettingsSchema = z.object({
  basic: BasicSettingsSchema,
  userManagement: UserManagementSettingsSchema,
  business: BusinessSettingsSchema,
  notifications: NotificationSettingsSchema,
  dataManagement: DataManagementSettingsSchema,
});

// 设置更新请求验证规则
export const SettingsUpdateRequestSchema = z.object({
  category: z.enum([
    'basic',
    'userManagement',
    'business',
    'notifications',
    'dataManagement',
  ]),
  data: z.union([
    BasicSettingsSchema.partial(),
    UserManagementSettingsSchema.partial(),
    BusinessSettingsSchema.partial(),
    NotificationSettingsSchema.partial(),
    DataManagementSettingsSchema.partial(),
  ]),
});

// 导出类型推断
export type BasicSettingsFormData = z.infer<typeof BasicSettingsSchema>;
export type UserManagementSettingsFormData = z.infer<
  typeof UserManagementSettingsSchema
>;
export type BusinessSettingsFormData = z.infer<typeof BusinessSettingsSchema>;
export type NotificationSettingsFormData = z.infer<
  typeof NotificationSettingsSchema
>;
export type DataManagementSettingsFormData = z.infer<
  typeof DataManagementSettingsSchema
>;
export type SystemSettingsFormData = z.infer<typeof SystemSettingsSchema>;
export type SettingsUpdateRequestFormData = z.infer<
  typeof SettingsUpdateRequestSchema
>;

// 表单默认值
export const basicSettingsDefaults: Partial<BasicSettingsFormData> = {
  companyName: '',
  systemName: '',
  logoUrl: '',
  timezone: 'Asia/Shanghai',
  language: 'zh-CN',
  currency: 'CNY',
  address: '',
  phone: '',
  email: '',
};

export const userManagementSettingsDefaults: Partial<UserManagementSettingsFormData> =
  {
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: false,
    sessionTimeoutHours: 8,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    enableTwoFactor: false,
  };

export const businessSettingsDefaults: Partial<BusinessSettingsFormData> = {
  lowStockThreshold: 10,
  orderNumberFormat: 'SO{YYYYMMDD}{序号}',
  returnPeriodDays: 30,
  priceDecimalPlaces: 2,
  defaultTaxRate: 0.13,
  paymentMethods: ['现金', '银行转账'],
  enableInventoryTracking: true,
  enableBarcodeScanning: false,
  autoGenerateOrderNumbers: true,
};

export const notificationSettingsDefaults: Partial<NotificationSettingsFormData> =
  {
    enableLowStockAlerts: true,
    enableOrderNotifications: true,
    enableSystemNotifications: true,
    enableEmailNotifications: false,
    enableSoundAlerts: false,
    lowStockThresholdPercent: 20,
    emailRecipients: [],
  };

export const dataManagementSettingsDefaults: Partial<DataManagementSettingsFormData> =
  {
    // 数据备份设置
    autoBackupEnabled: true,
    backupFrequency: 'daily' as const,
    backupTime: '02:00',
    backupRetentionDays: 30,
    backupStoragePath: '/backups',
    backupCompression: true,

    // 数据导出设置
    exportFormats: ['excel', 'csv'] as const,
    exportMaxRecords: 10000,
    exportIncludeDeleted: false,
    exportScheduleEnabled: false,
    exportScheduleFrequency: 'weekly' as const,

    // 系统维护设置
    autoCleanupEnabled: true,
    logRetentionDays: 90,
    tempFileCleanupDays: 7,
    cacheCleanupFrequency: 'daily' as const,
    performanceMonitoringEnabled: true,
    maxFileUploadSizeMB: 10,

    // 数据库维护
    dbOptimizationEnabled: true,
    dbOptimizationFrequency: 'weekly' as const,
    dbBackupBeforeOptimization: true,
  };
