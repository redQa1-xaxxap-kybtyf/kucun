/**
 * 库存调整记录API客户端
 * 提供调整记录的查询和管理功能
 */

import type { ApiResponse } from '@/lib/types/api';
import type {
  AdjustmentQueryParams,
  InventoryAdjustment,
} from '@/lib/types/inventory-operations';

// 定义 AdjustmentListResponse 类型
interface AdjustmentListResponse {
  success: boolean;
  data: {
    adjustments: InventoryAdjustment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

const API_BASE = '/api/inventory/adjustments';

/**
 * 获取库存调整记录列表
 */
export async function getAdjustments(
  params: AdjustmentQueryParams = {}
): Promise<AdjustmentListResponse['data']> {
  const searchParams = new URLSearchParams();

  // 添加查询参数
  if (params.page) {searchParams.set('page', params.page.toString());}
  if (params.limit) {searchParams.set('limit', params.limit.toString());}
  if (params.search) {searchParams.set('search', params.search);}
  if (params.sortBy) {searchParams.set('sortBy', params.sortBy);}
  if (params.sortOrder) {searchParams.set('sortOrder', params.sortOrder);}
  if (params.productId) {searchParams.set('productId', params.productId);}
  if (params.variantId) {searchParams.set('variantId', params.variantId);}
  if (params.batchNumber) {searchParams.set('batchNumber', params.batchNumber);}
  if (params.reason) {searchParams.set('reason', params.reason);}
  if (params.status) {searchParams.set('status', params.status);}
  if (params.operatorId) {searchParams.set('operatorId', params.operatorId);}
  if (params.startDate) {searchParams.set('startDate', params.startDate);}
  if (params.endDate) {searchParams.set('endDate', params.endDate);}

  const url = `${API_BASE}?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`获取调整记录失败: ${response.statusText}`);
  }

  const data: AdjustmentListResponse = await response.json();

  if (!data.success) {
    throw new Error(data.message || '获取调整记录失败');
  }

  return data.data;
}

/**
 * 获取单个库存调整记录详情
 */
export async function getAdjustment(id: string): Promise<InventoryAdjustment> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`获取调整记录详情失败: ${response.statusText}`);
  }

  const data: ApiResponse<InventoryAdjustment> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '获取调整记录详情失败');
  }

  if (!data.data) {
    throw new Error('获取调整记录详情失败：数据为空');
  }

  return data.data;
}

/**
 * React Query 查询键工厂
 */
export const adjustmentQueryKeys = {
  all: ['adjustments'] as const,
  lists: () => [...adjustmentQueryKeys.all, 'list'] as const,
  list: (params: AdjustmentQueryParams) =>
    [...adjustmentQueryKeys.lists(), params] as const,
  details: () => [...adjustmentQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...adjustmentQueryKeys.details(), id] as const,
};

/**
 * 获取调整记录的查询选项
 */
export const getAdjustmentQueryOptions = (
  params: AdjustmentQueryParams = {}
) => ({
  queryKey: adjustmentQueryKeys.list(params),
  queryFn: () => getAdjustments(params),
  staleTime: 5 * 60 * 1000, // 5分钟
  gcTime: 10 * 60 * 1000, // 10分钟
});

/**
 * 获取单个调整记录的查询选项
 */
export const getAdjustmentDetailQueryOptions = (id: string) => ({
  queryKey: adjustmentQueryKeys.detail(id),
  queryFn: () => getAdjustment(id),
  staleTime: 5 * 60 * 1000, // 5分钟
  gcTime: 10 * 60 * 1000, // 10分钟
  enabled: !!id,
});
