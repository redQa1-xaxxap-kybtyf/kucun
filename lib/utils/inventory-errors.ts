/**
 * 库存管理统一错误处理工具
 * 提供一致的错误消息和处理机制
 */

import { INVENTORY_THRESHOLDS } from '@/lib/types/inventory-status';

// 错误类型枚举
export enum InventoryErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  INVENTORY_NOT_FOUND = 'INVENTORY_NOT_FOUND',
  BOUNDARY_VIOLATION = 'BOUNDARY_VIOLATION',
  RESERVED_STOCK_CONFLICT = 'RESERVED_STOCK_CONFLICT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}

// 错误消息映射
export const INVENTORY_ERROR_MESSAGES: Record<InventoryErrorType, string> = {
  [InventoryErrorType.VALIDATION_ERROR]: '输入数据格式不正确',
  [InventoryErrorType.INSUFFICIENT_STOCK]: '库存数量不足',
  [InventoryErrorType.PRODUCT_NOT_FOUND]: '产品不存在',
  [InventoryErrorType.INVENTORY_NOT_FOUND]: '库存记录不存在',
  [InventoryErrorType.BOUNDARY_VIOLATION]: '操作超出允许范围',
  [InventoryErrorType.RESERVED_STOCK_CONFLICT]: '与预留库存冲突',
  [InventoryErrorType.PERMISSION_DENIED]: '权限不足',
  [InventoryErrorType.SYSTEM_ERROR]: '系统错误',
};

// 库存错误类
export class InventoryError extends Error {
  public readonly type: InventoryErrorType;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    type: InventoryErrorType,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(message || INVENTORY_ERROR_MESSAGES[type]);
    this.type = type;
    this.code = type;
    this.details = details;
    this.name = 'InventoryError';
  }
}

// 库存操作结果类型
export interface InventoryOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    type: InventoryErrorType;
    message: string;
    details?: Record<string, unknown>;
  };
  warnings?: string[];
}

// 创建成功结果
export function createSuccessResult<T>(
  data: T,
  warnings?: string[]
): InventoryOperationResult<T> {
  return {
    success: true,
    data,
    warnings,
  };
}

// 创建错误结果
export function createErrorResult(
  type: InventoryErrorType,
  message?: string,
  details?: Record<string, unknown>
): InventoryOperationResult {
  return {
    success: false,
    error: {
      type,
      message: message || INVENTORY_ERROR_MESSAGES[type],
      details,
    },
  };
}

// 统一的库存验证函数
export const inventoryValidators = {
  /**
   * 验证产品存在性
   */
  validateProductExists: (product: unknown): boolean =>
    product !== null && product !== undefined,

  /**
   * 验证库存充足性
   */
  validateSufficientStock: (
    available: number,
    required: number
  ): { isValid: boolean; message?: string } => {
    if (available < required) {
      return {
        isValid: false,
        message: `可用库存(${available})不足，需要(${required})`,
      };
    }
    return { isValid: true };
  },

  /**
   * 验证库存边界
   */
  validateStockBoundaries: (
    quantity: number,
    min: number = 0,
    max: number = 999999
  ): { isValid: boolean; message?: string } => {
    if (quantity < min) {
      return {
        isValid: false,
        message: `库存数量(${quantity})不能小于最小值(${min})`,
      };
    }
    if (quantity > max) {
      return {
        isValid: false,
        message: `库存数量(${quantity})不能超过最大值(${max})`,
      };
    }
    return { isValid: true };
  },

  /**
   * 验证预留库存冲突
   */
  validateReservedStockConflict: (
    newQuantity: number,
    reservedQuantity: number
  ): { isValid: boolean; message?: string } => {
    if (newQuantity < reservedQuantity) {
      return {
        isValid: false,
        message: `库存数量(${newQuantity})不能低于预留数量(${reservedQuantity})`,
      };
    }
    return { isValid: true };
  },
};

// 统一的错误处理中间件
export function handleInventoryError(error: unknown): InventoryOperationResult {
  if (error instanceof InventoryError) {
    return createErrorResult(error.type, error.message, error.details);
  }

  if (error instanceof Error) {
    return createErrorResult(InventoryErrorType.SYSTEM_ERROR, error.message);
  }

  return createErrorResult(InventoryErrorType.SYSTEM_ERROR, '未知错误');
}

// 库存状态检查工具
export const inventoryStatusCheckers = {
  /**
   * 检查是否为低库存
   */
  isLowStock: (
    quantity: number,
    minQuantity: number = INVENTORY_THRESHOLDS.DEFAULT_MIN_QUANTITY
  ): boolean => quantity <= minQuantity,

  /**
   * 检查是否为紧急库存
   */
  isCriticalStock: (quantity: number): boolean =>
    quantity <= INVENTORY_THRESHOLDS.CRITICAL_MIN_QUANTITY,

  /**
   * 检查是否缺货
   */
  isOutOfStock: (quantity: number): boolean => quantity <= 0,

  /**
   * 检查是否库存过多
   */
  isOverstock: (
    quantity: number,
    minQuantity: number = INVENTORY_THRESHOLDS.DEFAULT_MIN_QUANTITY
  ): boolean => {
    const overstockThreshold =
      minQuantity * INVENTORY_THRESHOLDS.OVERSTOCK_MULTIPLIER;
    return quantity > overstockThreshold;
  },
};
