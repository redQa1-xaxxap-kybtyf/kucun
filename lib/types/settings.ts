/**
 * 系统设置相关类型定义
 * 遵循项目TypeScript严格模式规范
 * 配置常量统一从 lib/config/settings.ts 导入
 */

import type { PaymentMethod } from '@/lib/config/settings';

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
  paymentMethods: PaymentMethod[];
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
  backupFrequency: BackupFrequency;
  backupTime: string; // HH:mm 格式
  backupRetentionDays: number;
  backupStoragePath: string;
  backupCompression: boolean;

  // 数据导出设置
  exportFormats: ExportFormat[];
  exportMaxRecords: number;
  exportIncludeDeleted: boolean;
  exportScheduleEnabled: boolean;
  exportScheduleFrequency: BackupFrequency;

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
export type SettingsUpdateRequest =
  | {
      category: 'basic';
      data: Partial<BasicSettings>;
    }
  | {
      category: 'userManagement';
      data: Partial<UserManagementSettings>;
    }
  | {
      category: 'business';
      data: Partial<BusinessSettings>;
    }
  | {
      category: 'notifications';
      data: Partial<NotificationSettings>;
    }
  | {
      category: 'dataManagement';
      data: Partial<DataManagementSettings>;
    };

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

// 默认设置值 - 从统一配置导入
export { SETTINGS_DEFAULTS as DEFAULT_SETTINGS } from '@/lib/config/settings';

// 支持的选项 - 从统一配置导入
export {
  CURRENCY_OPTIONS,
  LANGUAGE_OPTIONS,
  PAYMENT_METHODS as PAYMENT_METHOD_OPTIONS,
  TIMEZONE_OPTIONS,
} from '@/lib/config/settings';

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

// 数据管理操作选项 - 从统一配置导入
export {
  BACKUP_FREQUENCY_OPTIONS,
  EXPORT_FORMATS as EXPORT_FORMAT_OPTIONS,
} from '@/lib/config/settings';

export const CLEANUP_FREQUENCY_OPTIONS = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
] as const;

export const DB_OPTIMIZATION_FREQUENCY_OPTIONS = [
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
] as const;
