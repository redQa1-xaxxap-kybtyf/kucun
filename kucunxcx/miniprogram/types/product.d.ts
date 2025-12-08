// 产品相关类型定义

import type {
  PaginationParams,
  SearchParams,
  SortParams,
  Status,
} from './common';

/**
 * 产品基本信息
 */
export interface Product {
  id: string;
  code: string;
  name: string;
  specification?: string;
  unit: string;
  // 每件包含的片数（用于“X件Y片”展示）
  piecesPerUnit?: number;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
    code: string;
  };
  status: Status;
  thumbnailUrl?: string;
  images: string[];
  description?: string;
  createdAt: string;
  updatedAt: string;
  // 库存信息（可选）
  inventory?: {
    totalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
  };
  // 统计信息（可选）
  statistics?: {
    totalSales: number;
    totalPurchases: number;
    averagePrice: number;
  };
}

/**
 * 产品查询参数
 */
export interface ProductQueryParams
  extends PaginationParams,
    SearchParams,
    SortParams {
  categoryId?: string;
  status?: Status;
  includeInventory?: boolean;
  includeStatistics?: boolean;
  includeBatchSpecs?: boolean;
}

/**
 * 产品详情（包含更多信息）
 */
export interface ProductDetail extends Product {
  batches?: Array<{
    id: string;
    batchNumber: string;
    quantity: number;
    manufactureDate?: string;
    expiryDate?: string;
  }>;
}
