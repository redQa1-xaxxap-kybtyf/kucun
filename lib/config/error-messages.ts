/**
 * 统一错误信息配置
 * 将所有英文错误信息替换为中文，确保用户体验一致性
 */

// 通用错误信息
export const COMMON_ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  SERVER_ERROR: '服务器内部错误，请稍后重试',
  UNAUTHORIZED: '未授权访问，请先登录',
  FORBIDDEN: '权限不足，无法执行此操作',
  NOT_FOUND: '请求的资源不存在',
  VALIDATION_ERROR: '输入数据格式不正确',
  TIMEOUT_ERROR: '请求超时，请稍后重试',
  UNKNOWN_ERROR: '未知错误，请联系技术支持',
} as const;

// WebSocket相关错误信息
export const WEBSOCKET_ERROR_MESSAGES = {
  CONNECTION_FAILED: 'WebSocket连接失败',
  CONNECTION_CLOSED: 'WebSocket连接已关闭',
  MESSAGE_PARSE_ERROR: '消息解析失败',
  ORIGIN_NOT_ALLOWED: '禁止的来源',
  UNAUTHORIZED: '未授权',
  SERVER_START_FAILED: 'WebSocket服务器启动失败',
} as const;

// 产品相关错误信息
export const PRODUCT_ERROR_MESSAGES = {
  NOT_FOUND: '产品不存在',
  CODE_DUPLICATE: '产品编码已存在',
  NAME_REQUIRED: '产品名称不能为空',
  CODE_REQUIRED: '产品编码不能为空',
  SPECIFICATION_REQUIRED: '产品规格不能为空',
  UNIT_REQUIRED: '计量单位不能为空',
  SEARCH_FAILED: '搜索产品失败',
  CREATE_FAILED: '创建产品失败',
  UPDATE_FAILED: '更新产品失败',
  DELETE_FAILED: '删除产品失败',
} as const;

// 销售订单相关错误信息
export const SALES_ORDER_ERROR_MESSAGES = {
  NOT_FOUND: '销售订单不存在',
  ORDER_NUMBER_DUPLICATE: '订单号已存在',
  CUSTOMER_REQUIRED: '客户信息不能为空',
  ITEMS_REQUIRED: '订单明细不能为空',
  TOTAL_AMOUNT_INVALID: '订单金额无效',
  STATUS_INVALID: '订单状态无效',
  SEARCH_FAILED: '搜索订单失败',
  CREATE_FAILED: '创建订单失败',
  UPDATE_FAILED: '更新订单失败',
  DELETE_FAILED: '删除订单失败',
  CANCEL_FAILED: '取消订单失败',
} as const;

// 客户相关错误信息
export const CUSTOMER_ERROR_MESSAGES = {
  NOT_FOUND: '客户不存在',
  NAME_REQUIRED: '客户名称不能为空',
  PHONE_REQUIRED: '联系电话不能为空',
  PHONE_INVALID: '联系电话格式不正确',
  EMAIL_INVALID: '邮箱格式不正确',
  SEARCH_FAILED: '搜索客户失败',
  CREATE_FAILED: '创建客户失败',
  UPDATE_FAILED: '更新客户失败',
  DELETE_FAILED: '删除客户失败',
} as const;

// 库存相关错误信息
export const INVENTORY_ERROR_MESSAGES = {
  NOT_FOUND: '库存记录不存在',
  INSUFFICIENT_STOCK: '库存数量不足',
  QUANTITY_INVALID: '数量必须大于0',
  BATCH_NUMBER_REQUIRED: '批次号不能为空',
  LOCATION_REQUIRED: '存储位置不能为空',
  INBOUND_FAILED: '入库操作失败',
  OUTBOUND_FAILED: '出库操作失败',
  ADJUSTMENT_FAILED: '库存调整失败',
} as const;

// 财务相关错误信息
export const FINANCE_ERROR_MESSAGES = {
  PAYMENT_NOT_FOUND: '收款记录不存在',
  REFUND_NOT_FOUND: '退款记录不存在',
  AMOUNT_INVALID: '金额必须大于0',
  PAYMENT_METHOD_REQUIRED: '支付方式不能为空',
  PAYMENT_DATE_REQUIRED: '支付日期不能为空',
  INSUFFICIENT_BALANCE: '余额不足',
  PAYMENT_FAILED: '收款操作失败',
  REFUND_FAILED: '退款操作失败',
} as const;

// 认证相关错误信息
export const AUTH_ERROR_MESSAGES = {
  CREDENTIALS_INVALID: '邮箱或密码错误',
  ACCOUNT_DISABLED: '账户已被禁用',
  ACCESS_DENIED: '访问被拒绝',
  SESSION_EXPIRED: '会话已过期，请重新登录',
  SESSION_REQUIRED: '需要登录才能访问',
  PASSWORD_TOO_SHORT: '密码长度不能少于8位',
  EMAIL_INVALID: '邮箱格式不正确',
  LOGIN_FAILED: '登录失败',
  LOGOUT_FAILED: '退出登录失败',
} as const;

// 文件上传相关错误信息
export const UPLOAD_ERROR_MESSAGES = {
  FILE_TOO_LARGE: '文件大小超出限制',
  FILE_TYPE_NOT_ALLOWED: '不支持的文件类型',
  UPLOAD_FAILED: '文件上传失败',
  NO_FILE_SELECTED: '请选择要上传的文件',
  MULTIPLE_FILES_NOT_ALLOWED: '不支持多文件上传',
} as const;
