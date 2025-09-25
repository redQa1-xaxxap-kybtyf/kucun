/**
 * 库存状态相关类型定义
 * 统一管理所有库存状态、预警级别和显示标签
 */

// 库存状态枚举
export type InventoryStatus =
  | 'in_stock' // 有库存
  | 'low_stock' // 库存不足
  | 'out_of_stock' // 缺货
  | 'overstock' // 库存过多
  | 'reserved' // 已预留
  | 'damaged' // 损坏
  | 'expired'; // 过期

// 库存预警级别
export type AlertLevel = 'safe' | 'warning' | 'danger' | 'critical';

// 库存状态标签映射
export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  in_stock: '有库存',
  low_stock: '库存不足',
  out_of_stock: '缺货',
  overstock: '库存过多',
  reserved: '已预留',
  damaged: '损坏',
  expired: '过期',
};

// 库存状态变体映射（用于UI组件）
export const INVENTORY_STATUS_VARIANTS: Record<
  InventoryStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  in_stock: 'default',
  low_stock: 'outline',
  out_of_stock: 'destructive',
  overstock: 'secondary',
  reserved: 'secondary',
  damaged: 'destructive',
  expired: 'destructive',
};

// 库存预警级别标签映射
export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  safe: '安全',
  warning: '警告',
  danger: '危险',
  critical: '紧急',
};

// 库存预警级别颜色映射
export const ALERT_LEVEL_COLORS: Record<AlertLevel, string> = {
  safe: 'text-green-600',
  warning: 'text-yellow-600',
  danger: 'text-orange-600',
  critical: 'text-red-600',
};

// 库存预警阈值配置
export const INVENTORY_THRESHOLDS = {
  DEFAULT_MIN_QUANTITY: 10,
  CRITICAL_MIN_QUANTITY: 5,
  OVERSTOCK_MULTIPLIER: 5, // 超过平均库存5倍视为库存过多
} as const;

/**
 * 库存状态检查函数（增强版）
 * @param quantity 当前库存数量
 * @param reservedQuantity 预留数量
 * @param minQuantity 最小库存阈值
 * @param criticalQuantity 紧急库存阈值
 * @param overstockThreshold 库存过多阈值
 * @returns 库存状态信息
 */
export const getInventoryStatus = (
  quantity: number,
  reservedQuantity: number = 0,
  minQuantity: number = INVENTORY_THRESHOLDS.DEFAULT_MIN_QUANTITY,
  criticalQuantity: number = INVENTORY_THRESHOLDS.CRITICAL_MIN_QUANTITY,
  overstockThreshold?: number
): {
  status: InventoryStatus;
  label: string;
  color: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} => {
  const availableQuantity = quantity - reservedQuantity;

  // 检查缺货
  if (availableQuantity <= 0) {
    return {
      status: 'out_of_stock',
      label: INVENTORY_STATUS_LABELS.out_of_stock,
      color: 'text-red-600',
      variant: 'destructive',
    };
  }

  // 检查紧急库存不足
  if (availableQuantity <= criticalQuantity) {
    return {
      status: 'low_stock',
      label: INVENTORY_STATUS_LABELS.low_stock,
      color: 'text-red-600',
      variant: 'destructive',
    };
  }

  // 检查库存不足
  if (availableQuantity <= minQuantity) {
    return {
      status: 'low_stock',
      label: INVENTORY_STATUS_LABELS.low_stock,
      color: 'text-yellow-600',
      variant: 'outline',
    };
  }

  // 检查库存过多
  if (overstockThreshold && availableQuantity > overstockThreshold) {
    return {
      status: 'overstock',
      label: INVENTORY_STATUS_LABELS.overstock,
      color: 'text-blue-600',
      variant: 'secondary',
    };
  }

  // 库存正常
  return {
    status: 'in_stock',
    label: INVENTORY_STATUS_LABELS.in_stock,
    color: 'text-green-600',
    variant: 'default',
  };
};

/**
 * 计算可用库存数量
 * @param quantity 总库存数量
 * @param reservedQuantity 预留数量
 * @returns 可用库存数量
 */
export const calculateAvailableQuantity = (
  quantity: number,
  reservedQuantity: number = 0
): number => Math.max(0, quantity - reservedQuantity);

/**
 * 获取库存预警级别
 * @param quantity 当前库存数量
 * @param reservedQuantity 预留数量
 * @param minQuantity 最小库存阈值
 * @returns 预警级别
 */
export const getAlertLevel = (
  quantity: number,
  reservedQuantity: number = 0,
  minQuantity: number = INVENTORY_THRESHOLDS.DEFAULT_MIN_QUANTITY
): AlertLevel => {
  const availableQuantity = calculateAvailableQuantity(
    quantity,
    reservedQuantity
  );

  if (availableQuantity <= 0) {
    return 'critical';
  } else if (availableQuantity <= INVENTORY_THRESHOLDS.CRITICAL_MIN_QUANTITY) {
    return 'danger';
  } else if (availableQuantity <= minQuantity) {
    return 'warning';
  } else {
    return 'safe';
  }
};
