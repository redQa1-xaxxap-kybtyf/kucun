/**
 * 系统设置相关类型定义
 * 遵循项目TypeScript严格模式规范
 */

// 基础设置类型
export interface BasicSettings {
  companyName: string;
  systemName: string;
  logoUrl?: string;
  timezone: string;
  language: string;
  currency: string;
  address?: string;
  phone?: string;
  email?: string;
}

// 用户管理设置类型
export interface UserManagementSettings {
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  sessionTimeoutHours: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  enableTwoFactor: boolean;
}

// 业务设置类型
export interface BusinessSettings {
  lowStockThreshold: number;
  orderNumberFormat: string;
  returnPeriodDays: number;
  priceDecimalPlaces: number;
  defaultTaxRate: number;
  paymentMethods: string[];
  enableInventoryTracking: boolean;
  enableBarcodeScanning: boolean;
  autoGenerateOrderNumbers: boolean;
}

// 通知设置类型
export interface NotificationSettings {
  enableLowStockAlerts: boolean;
  enableOrderNotifications: boolean;
  enableSystemNotifications: boolean;
  enableEmailNotifications: boolean;
  enableSoundAlerts: boolean;
  lowStockThresholdPercent: number;
  emailRecipients: string[];
}

// 数据管理设置类型
export interface DataManagementSettings {
  // 数据备份设置
  autoBackupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  backupTime: string; // HH:mm 格式
  backupRetentionDays: number;
  backupStoragePath: string;
  backupCompression: boolean;

  // 数据导出设置
  exportFormats: ('excel' | 'csv' | 'json')[];
  exportMaxRecords: number;
  exportIncludeDeleted: boolean;
  exportScheduleEnabled: boolean;
  exportScheduleFrequency: 'daily' | 'weekly' | 'monthly';

  // 系统维护设置
  autoCleanupEnabled: boolean;
  logRetentionDays: number;
  tempFileCleanupDays: number;
  cacheCleanupFrequency: 'daily' | 'weekly';
  performanceMonitoringEnabled: boolean;
  maxFileUploadSizeMB: number;

  // 数据库维护
  dbOptimizationEnabled: boolean;
  dbOptimizationFrequency: 'weekly' | 'monthly';
  dbBackupBeforeOptimization: boolean;
}

// 完整系统设置类型
export interface SystemSettings {
  basic: BasicSettings;
  userManagement: UserManagementSettings;
  business: BusinessSettings;
  notifications: NotificationSettings;
  dataManagement: DataManagementSettings;
  updatedAt: Date;
  updatedBy: string;
}

// 设置更新请求类型
export interface SettingsUpdateRequest {
  category:
    | 'basic'
    | 'userManagement'
    | 'business'
    | 'notifications'
    | 'dataManagement';
  data: Partial<
    | BasicSettings
    | UserManagementSettings
    | BusinessSettings
    | NotificationSettings
    | DataManagementSettings
  >;
}

// 设置响应类型
export interface SettingsResponse {
  success: boolean;
  data?: SystemSettings;
  error?: string;
  message?: string;
}

// 设置分类信息
export interface SettingCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
  requiredRole: 'admin' | 'all';
  priority: number;
}

// 预定义的设置分类
export const SETTING_CATEGORIES: SettingCategory[] = [
  {
    id: 'basic',
    title: '基础设置',
    description: '公司信息、系统名称、Logo等基础配置',
    icon: 'Building',
    requiredRole: 'admin',
    priority: 1,
  },
  {
    id: 'userManagement',
    title: '用户管理',
    description: '角色权限、密码策略、会话管理',
    icon: 'Users',
    requiredRole: 'admin',
    priority: 2,
  },
  {
    id: 'business',
    title: '业务设置',
    description: '库存预警、订单规则、财务配置',
    icon: 'Settings',
    requiredRole: 'admin',
    priority: 3,
  },
  {
    id: 'notifications',
    title: '通知设置',
    description: '消息提醒、预警配置',
    icon: 'Bell',
    requiredRole: 'all',
    priority: 4,
  },
  {
    id: 'dataManagement',
    title: '数据管理',
    description: '备份、导出、维护工具',
    icon: 'Database',
    requiredRole: 'admin',
    priority: 5,
  },
];

// 默认设置值
export const DEFAULT_SETTINGS: SystemSettings = {
  basic: {
    companyName: '瓷砖库存管理系统',
    systemName: '库存管理工具',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    currency: 'CNY',
  },
  userManagement: {
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: false,
    sessionTimeoutHours: 8,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    enableTwoFactor: false,
  },
  business: {
    lowStockThreshold: 10,
    orderNumberFormat: 'SO{YYYYMMDD}{序号}',
    returnPeriodDays: 30,
    priceDecimalPlaces: 2,
    defaultTaxRate: 0.13,
    paymentMethods: ['现金', '银行转账', '支付宝', '微信支付'],
    enableInventoryTracking: true,
    enableBarcodeScanning: false,
    autoGenerateOrderNumbers: true,
  },
  notifications: {
    enableLowStockAlerts: true,
    enableOrderNotifications: true,
    enableSystemNotifications: true,
    enableEmailNotifications: false,
    enableSoundAlerts: false,
    lowStockThresholdPercent: 20,
    emailRecipients: [],
  },
  dataManagement: {
    autoBackupEnabled: true,
    backupFrequency: 'daily',
    logRetentionDays: 90,
    tempFileCleanupDays: 7,
    exportFormats: ['Excel', 'CSV', 'PDF'],
    maxFileUploadSizeMB: 10,
  },
  updatedAt: new Date(),
  updatedBy: 'system',
};

// 支持的选项
export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Shanghai', label: '中国标准时间 (UTC+8)' },
  { value: 'Asia/Hong_Kong', label: '香港时间 (UTC+8)' },
  { value: 'Asia/Taipei', label: '台北时间 (UTC+8)' },
  { value: 'UTC', label: '协调世界时 (UTC)' },
];

export const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁体中文' },
  { value: 'en-US', label: 'English' },
];

export const CURRENCY_OPTIONS = [
  { value: 'CNY', label: '人民币 (¥)' },
  { value: 'HKD', label: '港币 (HK$)' },
  { value: 'TWD', label: '新台币 (NT$)' },
  { value: 'USD', label: '美元 ($)' },
];

export const PAYMENT_METHOD_OPTIONS = [
  '现金',
  '银行转账',
  '支付宝',
  '微信支付',
  '信用卡',
  '支票',
  '承兑汇票',
];

// 数据管理相关类型
export interface BackupOperation {
  id: string;
  type: 'manual' | 'scheduled';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  filePath?: string;
  fileSize?: number;
  error?: string;
  progress?: number;
}

export interface ExportOperation {
  id: string;
  type: 'manual' | 'scheduled';
  format: 'excel' | 'csv' | 'json';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  filePath?: string;
  fileSize?: number;
  recordCount?: number;
  error?: string;
  progress?: number;
  exportRange: {
    tables: string[];
    dateFrom?: Date;
    dateTo?: Date;
    includeDeleted: boolean;
  };
}

export interface MaintenanceOperation {
  id: string;
  type: 'cache_cleanup' | 'log_cleanup' | 'temp_cleanup' | 'db_optimization';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  result?: {
    itemsProcessed: number;
    spaceFreed: number;
    errors: string[];
  };
  error?: string;
  progress?: number;
}

export interface SystemPerformance {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  dbConnections: number;
  responseTime: number;
  errorRate: number;
}

// 数据管理操作选项
export const BACKUP_FREQUENCY_OPTIONS = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
];

export const EXPORT_FORMAT_OPTIONS = [
  { value: 'excel', label: 'Excel (.xlsx)' },
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'json', label: 'JSON (.json)' },
];

export const CLEANUP_FREQUENCY_OPTIONS = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
];

export const DB_OPTIMIZATION_FREQUENCY_OPTIONS = [
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
];
