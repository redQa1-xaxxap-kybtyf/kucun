import type { PrismaClient } from '@prisma/client';

// 销售订单管理系统类型定义

export type OrderStatus =
  | 'draft' // 草稿
  | 'pending_review' // 待审核
  | 'approved' // 已审核
  | 'confirmed' // 已确认
  | 'in_production' // 生产中
  | 'ready_to_ship' // 待发货
  | 'shipped' // 已发货
  | 'delivered' // 已交付
  | 'completed' // 已完成
  | 'cancelled' // 已取消
  | 'on_hold'; // 暂停

export type PriorityLevel = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type ReservationStatus = 'ACTIVE' | 'RELEASED' | 'EXPIRED' | 'FULFILLED';

export type ExpenseApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type AlertType =
  | 'LOW_MARGIN'
  | 'NEGATIVE_PROFIT'
  | 'HIGH_COST'
  | 'PRICING_ERROR';

export type AlertLevel = 'INFO' | 'WARNING' | 'CRITICAL';

// 订单状态历史记录
export interface OrderStatusHistory {
  id: string;
  salesOrderId: string;
  fromStatus?: OrderStatus;
  toStatus: OrderStatus;
  changedBy: string;
  changeReason?: string;
  remarks?: string;
  createdAt: Date;
}

// 订单优先级
export interface OrderPriority {
  id: string;
  salesOrderId: string;
  priorityLevel: PriorityLevel;
  priorityScore: number;
  dueDate?: Date;
  escalationDate?: Date;
  assignedTo?: string;
  priorityReason?: string;
  autoCalculated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 库存预留
export interface InventoryReservation {
  id: string;
  reservationNumber: string;
  salesOrderId: string;
  salesOrderItemId: string;
  productId: string;
  variantId?: string;
  batchNumber?: string;
  reservedQuantity: number;
  availableQuantity: number;
  reservationStatus: ReservationStatus;
  expiresAt?: Date;
  reservedBy: string;
  releasedBy?: string;
  releasedAt?: Date;
  releaseReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 库存安全库存配置
export interface InventorySafetyStock {
  id: string;
  productId: string;
  variantId?: string;
  minimumStock: number;
  safetyStock: number;
  reorderPoint: number;
  maximumStock?: number;
  leadTimeDays: number;
  alertEnabled: boolean;
  alertThreshold: number;
  lastAlertSent?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 费用类型
export interface ExpenseType {
  id: string;
  typeCode: string;
  typeName: string;
  category: string;
  calculationMethod:
    | 'FIXED'
    | 'PERCENTAGE'
    | 'WEIGHT_BASED'
    | 'QUANTITY_BASED'
    | 'MANUAL';
  defaultRate: number;
  minAmount: number;
  maxAmount?: number;
  isTaxable: boolean;
  requiresApproval: boolean;
  approvalThreshold?: number;
  isActive: boolean;
  sortOrder: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 费用审核
export interface ExpenseApproval {
  id: string;
  salesOrderId: string;
  feeItemId: string;
  expenseTypeId: string;
  requestedAmount: number;
  approvedAmount?: number;
  approvalStatus: ExpenseApprovalStatus;
  requestedBy: string;
  approvedBy?: string;
  approvalReason?: string;
  rejectionReason?: string;
  requestedAt: Date;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 利润分析配置
export interface ProfitAnalysisConfig {
  id: string;
  configName: string;
  profitMarginThresholdLow: number;
  profitMarginThresholdMedium: number;
  profitMarginThresholdHigh: number;
  costAllocationMethod: 'PROPORTIONAL' | 'EQUAL' | 'WEIGHT_BASED' | 'MANUAL';
  includeShippingCosts: boolean;
  includePackagingCosts: boolean;
  includeHandlingCosts: boolean;
  taxRate: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 利润预警
export interface ProfitAlert {
  id: string;
  salesOrderId: string;
  alertType: AlertType;
  alertLevel: AlertLevel;
  currentMargin?: number;
  thresholdMargin?: number;
  profitAmount?: number;
  costAmount?: number;
  alertMessage: string;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
}

// 订单处理请求
export interface OrderProcessingRequest {
  orderId: string;
  action:
    | 'create'
    | 'edit'
    | 'review'
    | 'approve'
    | 'confirm'
    | 'cancel'
    | 'hold';
  userId: string;
  reason?: string;
  remarks?: string;
  data?: Record<string, any>;
}

// 订单处理结果
export interface OrderProcessingResult {
  success: boolean;
  orderId: string;
  newStatus?: OrderStatus;
  message: string;
  errors?: string[];
  warnings?: string[];
  data?: Record<string, any>;
}

export type SalesOrderManagementPrisma = PrismaClient & Record<string, unknown>;
