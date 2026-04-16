/**
 * 库存模块 Prisma 查询选择器
 * 使用 Prisma 类型推导，避免手动维护重复类型定义
 *
 * 最佳实践：
 * 1. 使用 `as const satisfies Prisma.XXXSelect` 确保类型安全
 * 2. 使用 `Prisma.XXXGetPayload<>` 推导类型
 * 3. 集中管理所有查询选择器，便于复用和维护
 */

import type { Prisma } from '@prisma/client';

// ==================== 出库记录选择器 ====================

/**
 * 出库记录基础选择器
 * 包含所有核心字段和关联数据
 */
export const OUTBOUND_RECORD_SELECT = {
  id: true,
  recordNumber: true,
  productId: true,
  variantId: true,
  inventoryId: true,
  quantity: true,
  reason: true,
  notes: true,
  customerId: true,
  salesOrderId: true,
  operatorId: true,
  batchNumber: true,
  unitCost: true,
  totalCost: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      code: true,
      name: true,
      specification: true,
      unit: true,
      piecesPerUnit: true,
      weight: true,
    },
  },
  variant: {
    select: {
      id: true,
      colorCode: true,
      colorName: true,
      sku: true,
    },
  },
  operator: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  customer: {
    select: {
      id: true,
      name: true,
    },
  },
  salesOrder: {
    select: {
      id: true,
      orderNumber: true,
    },
  },
} as const satisfies Prisma.OutboundRecordSelect;

/**
 * 出库记录完整类型（从 Prisma 推导）
 * ✅ 自动同步 Prisma Schema 变更
 */
export type OutboundRecordWithRelations = Prisma.OutboundRecordGetPayload<{
  select: typeof OUTBOUND_RECORD_SELECT;
}>;

// ==================== 入库记录选择器 ====================

/**
 * 入库记录基础选择器
 */
export const INBOUND_RECORD_SELECT = {
  id: true,
  recordNumber: true,
  productId: true,
  variantId: true,
  supplierId: true,
  quantity: true,
  damagedQuantity: true,
  damageHandling: true,
  damageTotalCost: true,
  damageRemarks: true,
  reason: true,
  remarks: true,
  userId: true,
  batchNumber: true,
  openingImportBatchId: true,
  unitCost: true,
  totalCost: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      name: true,
      code: true,
      specification: true,
      unit: true,
      piecesPerUnit: true,
      weight: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  variant: {
    select: {
      id: true,
      colorCode: true,
      colorName: true,
      sku: true,
    },
  },
  batchSpecification: {
    select: {
      id: true,
      batchNumber: true,
      piecesPerUnit: true,
      weight: true,
      thickness: true,
    },
  },
  supplier: {
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
    },
  },
} as const satisfies Prisma.InboundRecordSelect;

/**
 * 入库记录完整类型（从 Prisma 推导）
 */
export type InboundRecordWithRelations = Prisma.InboundRecordGetPayload<{
  select: typeof INBOUND_RECORD_SELECT;
}>;

// ==================== 库存调整选择器 ====================

/**
 * 库存调整记录选择器
 */
export const INVENTORY_ADJUSTMENT_SELECT = {
  id: true,
  adjustmentNumber: true,
  productId: true,
  variantId: true,
  batchNumber: true,
  beforeQuantity: true,
  adjustQuantity: true,
  afterQuantity: true,
  reason: true,
  notes: true,
  status: true,
  operatorId: true,
  approverId: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      code: true,
      name: true,
      specification: true,
      unit: true,
      piecesPerUnit: true,
    },
  },
  variant: {
    select: {
      id: true,
      sku: true,
      colorCode: true,
      colorName: true,
    },
  },
  operator: {
    select: {
      id: true,
      name: true,
    },
  },
  approver: {
    select: {
      id: true,
      name: true,
    },
  },
} as const satisfies Prisma.InventoryAdjustmentSelect;

/**
 * 库存调整记录完整类型（从 Prisma 推导）
 */
export type InventoryAdjustmentWithRelations =
  Prisma.InventoryAdjustmentGetPayload<{
    select: typeof INVENTORY_ADJUSTMENT_SELECT;
  }>;

// ==================== 库存记录选择器 ====================

/**
 * 库存记录基础选择器
 * 注意：库存查询已使用原生 SQL 优化，此选择器用于单条记录查询
 */
export const INVENTORY_SELECT = {
  id: true,
  productId: true,
  variantId: true,
  batchNumber: true,
  quantity: true,
  reservedQuantity: true,
  location: true,
  unitCost: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      code: true,
      name: true,
      specification: true,
      unit: true,
      piecesPerUnit: true,
      weight: true,
      status: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  },
  variant: {
    select: {
      id: true,
      sku: true,
      colorCode: true,
      colorName: true,
    },
  },
} as const satisfies Prisma.InventorySelect;

/**
 * 库存记录完整类型（从 Prisma 推导）
 */
export type InventoryWithRelations = Prisma.InventoryGetPayload<{
  select: typeof INVENTORY_SELECT;
}>;

// ==================== 辅助类型 ====================

/**
 * 提取产品信息类型
 */
export type ProductInfo = OutboundRecordWithRelations['product'];

/**
 * 提取用户信息类型
 */
export type UserInfo = InboundRecordWithRelations['user'];

/**
 * 提取变体信息类型
 */
export type VariantInfo = NonNullable<OutboundRecordWithRelations['variant']>;

/**
 * 提取批次规格信息类型
 */
export type BatchSpecInfo = NonNullable<
  InboundRecordWithRelations['batchSpecification']
>;

// ==================== 使用示例 ====================

/**
 * 示例：在 API 处理器中使用
 *
 * ```typescript
 * import { OUTBOUND_RECORD_SELECT, type OutboundRecordWithRelations } from './selectors/inventory-selectors';
 *
 * export async function getOutboundRecords() {
 *   const records = await prisma.outboundRecord.findMany({
 *     select: OUTBOUND_RECORD_SELECT,  // ✅ 复用选择器
 *   });
 *
 *   // TypeScript 自动推导类型为 OutboundRecordWithRelations[]
 *   return records.map(formatRecord);
 * }
 *
 * function formatRecord(record: OutboundRecordWithRelations) {
 *   // ✅ 类型安全，自动补全
 *   return {
 *     id: record.id,
 *     productCode: record.product.code,
 *     // ...
 *   };
 * }
 * ```
 */
