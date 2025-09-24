/**
 * 系统设置相关类型定义
 * 严格遵循全栈项目统一约定规范
 */

// 系统设置数据类型枚举
export type SettingDataType = 'string' | 'number' | 'boolean' | 'json';

// 系统设置分类枚举
export type SettingCategory = 'basic' | 'user' | 'storage' | 'log';

// 系统设置基础接口
export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: SettingCategory;
  description?: string;
  dataType: SettingDataType;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

// 基本设置接口
export interface BasicSettings {
  // 公司信息
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;

  // 系统配置
  systemName: string;
  systemVersion?: string;
  systemDescription?: string;

  // 业务配置
  defaultLanguage: string;

  // 库存配置
  lowStockThreshold: number;
  enableStockAlerts: boolean;

  // 订单配置
  orderNumberPrefix: string;
  enableOrderApproval: boolean;
}

// 用户管理设置接口
export interface UserSettings {
  // 密码策略
  minPasswordLength: number;
  requireSpecialChars: boolean;
  passwordExpiryDays: number;

  // 会话配置
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;

  // 权限配置
  defaultUserRole: string;
  enableUserRegistration: boolean;
}

// 七牛云存储设置接口
export interface StorageSettings {
  // 七牛云配置
  qiniuAccessKey: string;
  qiniuSecretKey: string;
  qiniuBucket: string;
  qiniuDomain: string;
  qiniuRegion: string;

  // 上传配置
  maxFileSize: number;
  allowedFileTypes: string[];
  enableImageCompression: boolean;
  imageQuality: number;
}

// 系统日志设置接口
export interface LogSettings {
  // 日志级别
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // 日志保留
  logRetentionDays: number;
  enableLogRotation: boolean;
  maxLogFileSize: number;

  // 审计日志
  enableAuditLog: boolean;
  auditLogEvents: string[];
}

// 设置更新请求接口
export interface SettingUpdateRequest {
  key: string;
  value: string;
  category?: SettingCategory;
  description?: string;
  dataType?: SettingDataType;
  isPublic?: boolean;
}

// 批量设置更新请求接口
export interface BatchSettingUpdateRequest {
  settings: SettingUpdateRequest[];
}

// API响应接口
export interface SettingsApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 设置表单状态接口
export interface SettingsFormState {
  isLoading: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  errors: Record<string, string>;
}

// 用户管理相关类型定义
export interface UserManagementUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'sales';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// 用户创建请求接口
export interface CreateUserRequest {
  username: string;
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'sales';
}

// 用户更新请求接口
export interface UpdateUserRequest {
  userId: string;
  username?: string;
  email?: string;
  name?: string;
  role?: 'admin' | 'sales';
  status?: 'active' | 'inactive';
}

// 用户列表查询参数接口
export interface UserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: 'admin' | 'sales';
  status?: 'active' | 'inactive';
}

// 用户列表响应接口
export interface UserListResponse {
  users: UserManagementUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 密码重置请求接口
export interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
}

// 七牛云存储配置相关类型
export interface QiniuStorageConfig {
  accessKey: string;
  secretKey: string;
  bucket: string;
  domain: string;
  region?: string;
}

export interface QiniuStorageConfigRequest {
  accessKey: string;
  secretKey: string;
  bucket: string;
  domain: string;
  region?: string;
}

export interface QiniuStorageTestRequest {
  accessKey: string;
  secretKey: string;
  bucket: string;
  region?: string;
}

export interface QiniuStorageTestResponse {
  success: boolean;
  message: string;
  bucketInfo?: {
    name: string;
    region: string;
    private: boolean;
  };
}

// 系统日志相关类型定义
export interface SystemLog {
  id: string;
  type: SystemLogType;
  level: SystemLogLevel;
  action: string;
  description: string;
  userId?: string | null;
  user?: {
    id: string;
    name: string;
    username: string;
  } | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export type SystemLogType =
  | 'user_action'
  | 'business_operation'
  | 'system_event'
  | 'error'
  | 'security';

export type SystemLogLevel = 'info' | 'warning' | 'error' | 'critical';

export interface SystemLogFilters {
  type?: SystemLogType | null;
  level?: SystemLogLevel | null;
  userId?: string | null;
  action?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  search?: string | null;
}

export interface SystemLogListRequest {
  page?: number;
  limit?: number;
  filters?: SystemLogFilters;
}

export interface SystemLogListResponse {
  logs: SystemLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SystemLogExportRequest {
  format: 'csv' | 'json';
  filters?: SystemLogFilters;
}

export interface SystemLogCleanupRequest {
  beforeDate: string;
  types?: SystemLogType[];
}
