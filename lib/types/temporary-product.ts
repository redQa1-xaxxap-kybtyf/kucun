/**
 * 外采产品相关类型定义
 */

// 外采产品项（销售订单调货开单使用）
export interface HistoricalTemporaryProduct {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  unit: string;
  weight: number | null;
  piecesPerUnit: number;
  description?: string | null;
  thumbnailUrl?: string | null;
  showInMiniProgram?: boolean;
  latestCostPrice?: number | null;
  latestSalePrice?: number | null;
  latestPriceSource?: string | null;
  latestPriceOrderNumber?: string | null;
  latestPriceDate?: string | Date | null;
  priceUpdatedAt?: string | Date | null;
  priceRemarks?: string | null;
  usageCount: number;
  lastUsedAt: string | Date | null;
  supplierId: string;
  supplier: {
    id: string;
    name: string;
  };
}

// 外采产品查询参数
export interface HistoricalTemporaryProductQueryParams {
  supplierId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// 外采产品列表响应
export interface HistoricalTemporaryProductListResponse {
  data: HistoricalTemporaryProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
