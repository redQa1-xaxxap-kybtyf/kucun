/**
 * 业务事件类型定义
 * 所有实时推送事件的统一类型系统
 */

/**
 * 基础事件接口
 */
export interface BaseEvent {
  type: string;
  timestamp: number;
  userId?: string;
}

/**
 * 通知事件
 */
export interface NotificationEvent extends BaseEvent {
  type: 'notification';
  notificationType: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
}

/**
 * 库存变更事件
 */
export interface InventoryChangeEvent extends BaseEvent {
  type: 'inventory:change';
  action: 'adjust' | 'inbound' | 'outbound' | 'reserve' | 'release';
  productId: string;
  productName?: string;
  variantId?: string;
  oldQuantity: number;
  newQuantity: number;
  changeAmount: number;
  reason?: string;
  operator?: string;
}

/**
 * 订单状态变更事件
 */
export interface OrderStatusEvent extends BaseEvent {
  type: 'order:status';
  orderType: 'sales' | 'return' | 'purchase';
  orderId: string;
  orderNumber: string;
  oldStatus: string;
  newStatus: string;
  customerId?: string;
  customerName?: string;
}

/**
 * 审核事件
 */
export interface ApprovalEvent extends BaseEvent {
  type: 'approval:request' | 'approval:approved' | 'approval:rejected';
  resourceType: 'order' | 'return' | 'payment' | 'refund' | 'adjustment';
  resourceId: string;
  resourceNumber: string;
  requesterId: string;
  requesterName: string;
  approverId?: string;
  approverName?: string;
  reason?: string;
  comment?: string;
}

/**
 * 财务事件
 */
export interface FinanceEvent extends BaseEvent {
  type: 'finance:payment' | 'finance:refund' | 'finance:overdue';
  action: 'created' | 'confirmed' | 'cancelled' | 'overdue';
  recordType: 'payment' | 'paymentOut' | 'refund';
  recordId: string;
  recordNumber: string;
  amount: number;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
}

/**
 * 数据变更事件（通用）
 */
export interface DataChangeEvent extends BaseEvent {
  type: 'data:change';
  resource: 'product' | 'customer' | 'supplier' | 'category' | 'user';
  action: 'created' | 'updated' | 'deleted';
  resourceId: string;
  resourceName?: string;
  changes?: Record<string, unknown>;
}

/**
 * 系统事件
 */
export interface SystemEvent extends BaseEvent {
  type: 'system:maintenance' | 'system:update' | 'system:alert';
  level: 'info' | 'warning' | 'critical';
  message: string;
  affectedUsers?: string[];
  scheduledTime?: number;
  estimatedDuration?: number;
}

/**
 * 所有事件类型联合
 */
export type BusinessEvent =
  | NotificationEvent
  | InventoryChangeEvent
  | OrderStatusEvent
  | ApprovalEvent
  | FinanceEvent
  | DataChangeEvent
  | SystemEvent;

/**
 * 事件频道映射
 */
export const EventChannels = {
  // 个人通知（用户专属频道）
  userNotification: (userId: string) => `user:${userId}:notifications`,

  // 业务频道
  inventory: 'inventory',
  orders: 'orders',
  approvals: 'approvals',
  finance: 'finance',

  // 资源频道
  products: 'products',
  customers: 'customers',
  suppliers: 'suppliers',

  // 系统频道
  system: 'system',

  // 全局广播
  broadcast: 'broadcast',
} as const;

/**
 * 频道类型
 */
export type EventChannel =
  | ReturnType<typeof EventChannels.userNotification>
  | (typeof EventChannels)[keyof Omit<
      typeof EventChannels,
      'userNotification'
    >];
