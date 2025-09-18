/**
 * 统一的错误消息常量
 * 避免在多个文件中重复定义相同的错误消息
 */

// API 错误消息
export const API_ERROR_MESSAGES = {
  // 认证相关
  UNAUTHORIZED: '未授权访问',
  FORBIDDEN: '权限不足',
  SESSION_REQUIRED: '需要登录',
  INVALID_CREDENTIALS: '用户名或密码错误',
  ACCOUNT_DISABLED: '账户已被禁用',
  
  // 数据验证相关
  INVALID_INPUT: '输入数据格式不正确',
  REQUIRED_FIELD: '必填字段不能为空',
  INVALID_FORMAT: '数据格式不正确',
  DUPLICATE_ENTRY: '数据已存在',
  
  // 资源相关
  NOT_FOUND: '资源不存在',
  ALREADY_EXISTS: '资源已存在',
  CANNOT_DELETE: '无法删除，存在关联数据',
  
  // 业务逻辑相关
  INSUFFICIENT_STOCK: '库存不足',
  INVALID_OPERATION: '操作无效',
  OPERATION_FAILED: '操作失败',
  
  // 系统错误
  INTERNAL_ERROR: '系统内部错误',
  DATABASE_ERROR: '数据库错误',
  NETWORK_ERROR: '网络错误',
} as const;

// 状态常量
export const STATUS_VALUES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

// 用户角色常量
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SALES: 'sales',
  VIEWER: 'viewer',
} as const;

// 订单状态常量
export const ORDER_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
} as const;

// 支付状态常量
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  PARTIAL: 'partial',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const;

// 库存操作类型常量
export const INVENTORY_OPERATION_TYPE = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
  ADJUST: 'adjust',
  TRANSFER: 'transfer',
} as const;

// 入库类型常量
export const INBOUND_TYPE = {
  PURCHASE: 'purchase',
  RETURN: 'return',
  ADJUST: 'adjust',
  TRANSFER: 'transfer',
} as const;

// 出库类型常量
export const OUTBOUND_TYPE = {
  SALE: 'sale',
  RETURN: 'return',
  ADJUST: 'adjust',
  TRANSFER: 'transfer',
  DAMAGE: 'damage',
} as const;

// HTTP 状态码常量
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// 成功消息
export const SUCCESS_MESSAGES = {
  CREATED: '创建成功',
  UPDATED: '更新成功',
  DELETED: '删除成功',
  SAVED: '保存成功',
  OPERATION_SUCCESS: '操作成功',
} as const;

// 类型导出
export type ApiErrorMessage = typeof API_ERROR_MESSAGES[keyof typeof API_ERROR_MESSAGES];
export type StatusValue = typeof STATUS_VALUES[keyof typeof STATUS_VALUES];
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];
export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];
export type InventoryOperationType = typeof INVENTORY_OPERATION_TYPE[keyof typeof INVENTORY_OPERATION_TYPE];
export type InboundType = typeof INBOUND_TYPE[keyof typeof INBOUND_TYPE];
export type OutboundType = typeof OUTBOUND_TYPE[keyof typeof OUTBOUND_TYPE];
export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];
export type SuccessMessage = typeof SUCCESS_MESSAGES[keyof typeof SUCCESS_MESSAGES];
