/**
 * 库存数据格式化器
 * 提供库存数据的格式化和转换功能
 * 遵循全栈项目统一约定规范
 */

import type { InventoryQueryResult } from './inventory-query-builder';

/**
 * 格式化的库存数据类型
 */
export interface FormattedInventory {
  id: string;
  productId: string;
  batchNumber?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  location?: string;
  unitCost?: number;
  updatedAt: string;
  batchPiecesPerUnit?: number;
  product: {
    id: string;
    code: string;
    name: string;
    specification?: string;
    unit: string;
    piecesPerUnit: number;
    status: string;
    categoryId?: string;
    category: {
      id: string;
      name: string;
      code: string;
    } | null;
  };
}

/**
 * 格式化单个库存记录
 */
export function formatInventoryRecord(
  record: InventoryQueryResult
): FormattedInventory {
  return {
    id: record.id,
    productId: record.productId,
    batchNumber: record.batchNumber ?? undefined,
    quantity: record.quantity,
    reservedQuantity: record.reservedQuantity,
    availableQuantity: record.quantity - record.reservedQuantity,
    location: record.location ?? undefined,
    unitCost: record.unitCost ?? undefined,
    updatedAt: record.updatedAt.toISOString(),
    batchPiecesPerUnit: record.batch_piecesPerUnit ?? undefined,
    product: {
      id: record.product_id,
      code: record.product_code,
      name: record.product_name,
      specification: record.specification_size ?? undefined,
      unit: record.product_unit,
      piecesPerUnit: record.product_piecesPerUnit,
      status: record.product_status,
      categoryId: record.category_id ?? undefined,
      category:
        record.category_id && record.category_name
          ? {
              id: record.category_id,
              name: record.category_name,
              code: record.category_code || '',
            }
          : null,
    },
  };
}

/**
 * 批量格式化库存记录
 */
export function formatInventoryRecords(
  records: InventoryQueryResult[]
): FormattedInventory[] {
  return records.map(formatInventoryRecord);
}

/**
 * ✅ 统一的库存列表响应格式
 * 符合 TanStack Query 和 Next.js App Router 最佳实践
 */
export interface InventoryListResponse {
  inventories: FormattedInventory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 格式化分页响应（统一返回格式）
 */
export function formatPaginatedResponse(
  records: InventoryQueryResult[],
  total: number,
  page: number,
  limit: number
): InventoryListResponse {
  const formattedRecords = formatInventoryRecords(records);
  const totalPages = Math.ceil(total / limit);

  return {
    inventories: formattedRecords, // ✅ 统一字段名
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * @deprecated 使用 InventoryListResponse 代替
 */
export type PaginatedInventoryResponse = InventoryListResponse;
