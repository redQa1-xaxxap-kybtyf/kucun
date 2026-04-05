// 产品入库相关类型定义
// 遵循命名约定：数据库 snake_case → API camelCase → 前端 camelCase

import type { Product, ProductBatchSpec } from './product';
import type { User } from './user';

// 入库原因枚举
export type InboundReason =
  | 'purchase' // 采购入库
  | 'return' // 退货入库（手工处理）
  | 'transfer' // 调拨入库
  | 'surplus' // 盘盈入库
  | 'other' // 其他
  | 'sales_cancel' // 销售取消回库
  | 'return_inbound' // 退货单自动入库
  | 'opening_balance'; // 期初库存

// 入库原因标签映射
export const INBOUND_REASON_LABELS: Record<InboundReason, string> = {
  purchase: '采购入库',
  return: '退货入库',
  transfer: '调拨入库',
  surplus: '盘盈入库',
  other: '其他',
  sales_cancel: '销售订单取消入库',
  return_inbound: '退货订单入库',
  opening_balance: '期初库存',
};

// 入库原因选项
export const INBOUND_REASON_OPTIONS = Object.entries(INBOUND_REASON_LABELS).map(
  ([value, label]) => ({ value: value as InboundReason, label })
);

// 采购到货破损处理方式
export type InboundDamageHandling = 'supplier_claim' | 'internal_loss';

export const INBOUND_DAMAGE_HANDLING_LABELS: Record<
  InboundDamageHandling,
  string
> = {
  supplier_claim: '报工厂赔付',
  internal_loss: '不报工厂，内部承担',
};

export const INBOUND_DAMAGE_HANDLING_OPTIONS = Object.entries(
  INBOUND_DAMAGE_HANDLING_LABELS
).map(([value, label]) => ({
  value: value as InboundDamageHandling,
  label,
}));

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
  supplierId?: string; // 供应商ID
  quantity: number;
  damagedQuantity?: number; // 到货破损片数（不入库存）
  damageHandling?: InboundDamageHandling; // 到货破损处理方式
  damageTotalCost?: number; // 破损参考金额
  damageRemarks?: string; // 破损备注
  reason: InboundReason;
  remarks?: string;
  userId: string;

  // 批次管理字段
  productionDate?: string; // ISO日期字符串
  batchNumber?: string; // 批次号
  openingImportBatchId?: string; // 期初批量导入批次号
  colorCode?: string; // 色号
  unitCost?: number; // 单位成本
  totalCost?: number; // 总成本
  location?: string; // 存储位置
  batchSpecificationId?: string; // 批次规格参数ID

  createdAt: string;
  updatedAt: string;

  // 关联数据（可选，根据查询需要包含）
  product?: Pick<
    Product,
    | 'id'
    | 'name'
    | 'code'
    | 'specification'
    | 'unit'
    | 'piecesPerUnit'
    | 'weight'
  >;
  variant?: Pick<
    import('./product').ProductVariant,
    'id' | 'colorCode' | 'colorName' | 'sku'
  >;
  supplier?: Pick<
    import('./supplier').Supplier,
    'id' | 'name' | 'phone' | 'address'
  >;
  user?: Pick<User, 'id' | 'name' | 'email'>;
  batchSpecification?: Pick<
    import('./batch-specification').BatchSpecification,
    'id' | 'piecesPerUnit' | 'weight' | 'thickness' | 'batchNumber'
  >;
  productName?: string;
  productSku?: string;
  productUnit?: string;
  userName?: string;
}

// 创建入库记录的请求数据
export interface CreateInboundRequest {
  idempotencyKey: string;
  productId: string;
  variantId?: string; // 产品变体ID
  supplierId?: string; // 供应商ID
  inputQuantity: number;
  inputUnit: InboundUnit;
  quantity: number;
  unitCost: number; // 单位成本（必填）
  reason: InboundReason;
  remarks?: string;
  damagedInputQuantity?: number; // 到货破损录入数量（沿用入库单位）
  damagedQuantity?: number; // 到货破损折算片数
  damageHandling?: InboundDamageHandling; // 到货破损处理方式
  damageRemarks?: string; // 到货破损备注

  // 批次管理字段
  productionDate?: string; // ISO日期字符串
  batchNumber?: string; // 批次号
  colorCode?: string; // 色号
  location?: string; // 存储位置

  // 批次规格参数（入库时确定，可选）
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
  hasDamage?: boolean;
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

// 批次规格信息
export type BatchSpecInfo = ProductBatchSpec;

// 产品选择器选项
export interface ProductOption {
  value: string;
  label: string;
  code: string;
  specification?: string;
  unit: string;
  piecesPerUnit: number;
  currentStock?: number;
  batchSpecs?: BatchSpecInfo[]; // 批次规格列表（批次号+每件片数组合）
}

// 入库单位类型
export type InboundUnit = 'pieces' | 'units';

// ✅ 入库表单数据 - 从 Zod Schema 导出,确保类型一致性
// 遵循类型安全原则: 使用 Zod 推断类型而非手动定义
export type { InboundFormData } from '@/lib/validations/inbound';

// 入库操作结果
export interface InboundOperationResult {
  success: boolean;
  record?: InboundRecord;
  message?: string;
  error?: string;
}

// 入库详情类型
export interface InboundRecordDetail extends InboundRecord {
  inventoryBalance?: number;
}
