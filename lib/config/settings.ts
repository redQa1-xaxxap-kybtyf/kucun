/**
 * 系统设置统一配置文件
 * 遵循唯一真理源原则：所有设置相关的配置常量都在此文件中定义
 * @version 1.0.0
 */

// 支付方式配置 - 唯一真理源
export const PAYMENT_METHODS = [
  '现金',
  '银行转账',
  '支付宝',
  '微信支付',
  '信用卡',
  '支票',
  '承兑汇票',
] as const;

// 导出格式配置 - 唯一真理源
export const EXPORT_FORMATS = [
  { value: 'excel', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'json', label: 'JSON (.json)' },
] as const;

// 时区选项配置 - 唯一真理源
export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Shanghai', label: '中国标准时间 (UTC+8)' },
  { value: 'Asia/Hong_Kong', label: '香港时间 (UTC+8)' },
  { value: 'Asia/Taipei', label: '台北时间 (UTC+8)' },
  { value: 'UTC', label: '协调世界时 (UTC)' },
] as const;

// 语言选项配置
export const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁体中文' },
  { value: 'en-US', label: 'English' },
] as const;

// 货币选项配置
export const CURRENCY_OPTIONS = [
  { value: 'CNY', label: '人民币 (¥)' },
  { value: 'HKD', label: '港币 (HK$)' },
  { value: 'TWD', label: '新台币 (NT$)' },
  { value: 'USD', label: '美元 ($)' },
] as const;

// 用户角色选项配置
export const USER_ROLE_OPTIONS = [
  { value: 'admin', label: '管理员' },
  { value: 'sales', label: '销售员' },
  { value: 'viewer', label: '查看者' },
] as const;

// 通知类型配置
export const NOTIFICATION_TYPES = [
  { value: 'email', label: '邮件通知' },
  { value: 'sms', label: '短信通知' },
  { value: 'system', label: '系统通知' },
  { value: 'wechat', label: '微信通知' },
] as const;

// 数据备份频率配置
export const BACKUP_FREQUENCY_OPTIONS = [
  { value: 'daily', label: '每日备份' },
  { value: 'weekly', label: '每周备份' },
  { value: 'monthly', label: '每月备份' },
  { value: 'manual', label: '手动备份' },
] as const;

// 系统设置默认值 - 唯一真理源
export const SETTINGS_DEFAULTS = {
  basic: {
    companyName: '瓷砖库存管理系统',
    systemName: '库存管理工具',
    logoUrl: null,
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    currency: 'CNY',
    address: null,
    phone: null,
    email: null,
  },
  userManagement: {
    defaultRole: 'sales',
    passwordMinLength: 8,
    sessionTimeout: 24, // 小时
    maxLoginAttempts: 5,
    enableTwoFactor: false,
    allowSelfRegistration: false,
  },
  business: {
    paymentMethods: ['现金', '银行转账', '支付宝', '微信支付'],
    taxRate: 0.13,
    enableInventoryWarning: true,
    lowStockThreshold: 10,
    enablePriceHistory: true,
    autoGenerateOrderNumber: true,
    orderNumberPrefix: 'SO',
  },
  notifications: {
    enableEmailNotifications: true,
    enableSmsNotifications: false,
    enableSystemNotifications: true,
    lowStockAlert: true,
    orderStatusUpdate: true,
    paymentReminder: true,
    dailyReport: false,
    weeklyReport: true,
    monthlyReport: true,
  },
  dataManagement: {
    enableAutoBackup: true,
    backupFrequency: 'weekly',
    retentionPeriod: 90, // 天
    exportFormats: ['excel', 'csv'],
    enableDataEncryption: true,
    enableAuditLog: true,
    maxFileSize: 10, // MB
  },
} as const;

// 系统设置配置对象 - 统一导出
export const SETTINGS_CONFIG = {
  PAYMENT_METHODS,
  EXPORT_FORMATS,
  TIMEZONE_OPTIONS,
  LANGUAGE_OPTIONS,
  CURRENCY_OPTIONS,
  USER_ROLE_OPTIONS,
  NOTIFICATION_TYPES,
  BACKUP_FREQUENCY_OPTIONS,
  DEFAULTS: SETTINGS_DEFAULTS,
} as const;

// 类型定义
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type ExportFormat = (typeof EXPORT_FORMATS)[number]['value'];
export type TimezoneOption = (typeof TIMEZONE_OPTIONS)[number]['value'];
export type LanguageOption = (typeof LANGUAGE_OPTIONS)[number]['value'];
export type CurrencyOption = (typeof CURRENCY_OPTIONS)[number]['value'];
export type UserRoleOption = (typeof USER_ROLE_OPTIONS)[number]['value'];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]['value'];
export type BackupFrequency =
  (typeof BACKUP_FREQUENCY_OPTIONS)[number]['value'];

// 默认设置类型
export type SettingsDefaults = typeof SETTINGS_DEFAULTS;
export type BasicSettingsDefaults = typeof SETTINGS_DEFAULTS.basic;
export type UserManagementDefaults = typeof SETTINGS_DEFAULTS.userManagement;
export type BusinessSettingsDefaults = typeof SETTINGS_DEFAULTS.business;
export type NotificationDefaults = typeof SETTINGS_DEFAULTS.notifications;
export type DataManagementDefaults = typeof SETTINGS_DEFAULTS.dataManagement;
