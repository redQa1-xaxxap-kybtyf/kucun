/**
 * 通用API响应类型定义
 * 严格遵循全栈项目统一约定规范
 */

/**
 * 基础API响应接口
 */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * 分页信息接口
 */
export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * 分页响应接口
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationInfo
}

/**
 * 错误响应接口
 */
export interface ErrorResponse {
  success: false
  error: string
  details?: any[]
  code?: string
}

/**
 * 成功响应接口
 */
export interface SuccessResponse<T = any> {
  success: true
  data: T
  message?: string
}

/**
 * 批量操作响应接口
 */
export interface BatchOperationResponse {
  success: boolean
  processed: number
  failed: number
  errors?: string[]
}

/**
 * 统计信息响应接口
 */
export interface StatsResponse {
  [key: string]: number | string | boolean
}

/**
 * 搜索响应接口
 */
export interface SearchResponse<T> {
  results: T[]
  total: number
  query: string
  took: number // 搜索耗时（毫秒）
}

/**
 * 文件上传响应接口
 */
export interface UploadResponse {
  success: boolean
  data?: {
    filename: string
    originalName: string
    size: number
    mimetype: string
    url: string
  }
  error?: string
}

/**
 * 导出响应接口
 */
export interface ExportResponse {
  success: boolean
  data?: {
    filename: string
    url: string
    size: number
    recordCount: number
  }
  error?: string
}

/**
 * 通用查询参数接口
 */
export interface BaseQueryParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * 日期范围查询参数
 */
export interface DateRangeParams {
  startDate?: string
  endDate?: string
}

/**
 * 状态筛选参数
 */
export interface StatusFilterParams {
  status?: string | string[]
}

/**
 * API错误类型枚举
 */
export enum ApiErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * HTTP状态码枚举
 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  RATE_LIMIT = 429,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}

/**
 * API请求配置接口
 */
export interface ApiRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: any
  timeout?: number
  retries?: number
}

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  ttl?: number // 缓存时间（秒）
  key?: string // 缓存键
  tags?: string[] // 缓存标签
}

/**
 * 实时更新配置接口
 */
export interface RealtimeConfig {
  enabled: boolean
  channel?: string
  events?: string[]
}

/**
 * API端点配置接口
 */
export interface ApiEndpointConfig {
  baseUrl: string
  version?: string
  timeout?: number
  retries?: number
  cache?: CacheConfig
  realtime?: RealtimeConfig
}

/**
 * 通用API客户端接口
 */
export interface ApiClient {
  get<T>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T>>
  post<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>>
  put<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>>
  patch<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<ApiResponse<T>>
  delete<T>(url: string, config?: ApiRequestConfig): Promise<ApiResponse<T>>
}

/**
 * 数据验证结果接口
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/**
 * 验证错误接口
 */
export interface ValidationError {
  field: string
  message: string
  code?: string
  value?: any
}

/**
 * 审计日志接口
 */
export interface AuditLog {
  id: string
  userId: string
  action: string
  resource: string
  resourceId: string
  changes?: Record<string, any>
  metadata?: Record<string, any>
  timestamp: string
  ipAddress?: string
  userAgent?: string
}

/**
 * 系统健康检查响应接口
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  version: string
  services: {
    [serviceName: string]: {
      status: 'up' | 'down' | 'degraded'
      responseTime?: number
      error?: string
    }
  }
}

/**
 * 创建标准API响应
 */
export function createApiResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  message?: string
): ApiResponse<T> {
  return {
    success,
    data,
    error,
    message,
  }
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(data: T, message?: string): SuccessResponse<T> {
  return {
    success: true,
    data,
    message,
  }
}

/**
 * 创建错误响应
 */
export function createErrorResponse(error: string, details?: any[], code?: string): ErrorResponse {
  return {
    success: false,
    error,
    details,
    code,
  }
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationInfo
): PaginatedResponse<T> {
  return {
    data,
    pagination,
  }
}
