// 产品入库相关类型定义
// 遵循命名约定：数据库 snake_case → API camelCase → 前端 camelCase

import type { Product } from './product';
import type { User } from './user';

// 入库原因枚举
export type InboundReason =
  | 'purchase' // 采购入库
  | 'return' // 退货入库
  | 'transfer' // 调拨入库
  | 'surplus' // 盘盈入库
  | 'other'; // 其他

// 入库原因标签映射
export const INBOUND_REASON_LABELS: Record<InboundReason, string> = {
  purchase: '采购入库',
  return: '退货入库',
  transfer: '调拨入库',
  surplus: '盘盈入库',
  other: '其他',
};

// 入库原因选项
export const INBOUND_REASON_OPTIONS = Object.entries(INBOUND_REASON_LABELS).map(
  ([value, label]) => ({ value: value as InboundReason, label })
);

// 入库单位标签映射
export const INBOUND_UNIT_LABELS: Record<InboundUnit, string> = {
  pieces: '片',
  units: '件',
};

// 入库单位选项
export const INBOUND_UNIT_OPTIONS = Object.entries(INBOUND_UNIT_LABELS).map(
  ([value, label]) => ({ value: value as InboundUnit, label })
);

// 基础入库记录类型（对应数据库模型）
export interface InboundRecord {
  id: string;
  recordNumber: string;
  productId: string;
  variantId?: string; // 产品变体ID
  quantity: number;
  reason: InboundReason;
  remarks?: string;
  userId: string;

  // 批次管理字段
  productionDate?: string; // ISO日期字符串
  batchNumber?: string; // 批次号
  colorCode?: string; // 色号
  unitCost?: number; // 单位成本
  location?: string; // 存储位置
  batchSpecificationId?: string; // 批次规格参数ID

  createdAt: string;
  updatedAt: string;

  // 关联数据（可选，根据查询需要包含）
  product?: Product;
  variant?: import('./product').ProductVariant;
  user?: User;
  batchSpecification?: import('./batch-specification').BatchSpecification;
}

// 创建入库记录的请求数据
export interface CreateInboundRequest {
  productId: string;
  variantId?: string; // 产品变体ID
  quantity: number;
  reason: InboundReason;
  remarks?: string;

  // 批次管理字段
  productionDate?: string; // ISO日期字符串
  batchNumber?: string; // 批次号
  colorCode?: string; // 色号
  unitCost?: number; // 单位成本
  location?: string; // 存储位置

  // 批次规格参数（入库时确定）
  piecesPerUnit?: number; // 每单位片数
  weight?: number; // 产品重量(kg)
  thickness?: number; // 产品厚度(mm)
}

// 更新入库记录的请求数据
export interface UpdateInboundRequest {
  quantity?: number;
  reason?: InboundReason;
  remarks?: string;
}

// 入库记录查询参数
export interface InboundQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  productId?: string;
  reason?: InboundReason;
  userId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'quantity' | 'recordNumber';
  sortOrder?: 'asc' | 'desc';
}

// 入库记录列表响应
export interface InboundListResponse {
  data: InboundRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 入库统计数据
export interface InboundStats {
  todayCount: number;
  monthCount: number;
  totalQuantity: number;
  recentRecords: InboundRecord[];
}

// 产品选择器选项
export interface ProductOption {
  value: string;
  label: string;
  code: string;
  specification?: string;
  unit: string;
  piecesPerUnit: number;
  currentStock?: number;
}

// 入库单位类型
export type InboundUnit = 'pieces' | 'units';

// 入库表单数据
export interface InboundFormData {
  productId: string;
  variantId?: string; // 产品变体ID
  inputQuantity: number; // 用户输入的数量
  inputUnit: InboundUnit; // 用户选择的单位
  quantity: number; // 最终存储的片数
  reason: InboundReason;
  remarks?: string;

  // 批次管理字段
  batchNumber?: string; // 批次号
  piecesPerUnit: number; // 每单位片数（入库时确定）
  weight: number; // 产品重量（入库时确定）
  unitCost?: number; // 单位成本
  location?: string; // 存储位置
}

// 入库操作结果
export interface InboundOperationResult {
  success: boolean;
  record?: InboundRecord;
  message?: string;
  error?: string;
}
