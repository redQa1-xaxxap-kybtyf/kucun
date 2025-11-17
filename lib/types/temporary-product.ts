/**
 * 临时产品相关类型定义
 */

// 历史临时产品项
export interface HistoricalTemporaryProduct {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  unit: string;
  weight: number | null;
  piecesPerUnit: number;
  usageCount: number;
  lastUsedAt: Date | null;
  supplierId: string;
  supplier: {
    id: string;
    name: string;
  };
}

// 历史临时产品查询参数
export interface HistoricalTemporaryProductQueryParams {
  supplierId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// 历史临时产品列表响应
export interface HistoricalTemporaryProductListResponse {
  data: HistoricalTemporaryProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
