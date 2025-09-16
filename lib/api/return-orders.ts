// 退货管理 API 客户端
// 使用 TanStack Query 进行状态管理和缓存

import type {
  UseQueryOptions,
  UseMutationOptions } from '@tanstack/react-query';
import {
  useQuery,
  useMutation,
  useQueryClient
} from '@tanstack/react-query';

import type {
  ReturnOrderQueryParams,
  ReturnOrderResponse,
  ReturnOrderListResponse,
  ReturnOrderStatsResponse } from '@/lib/types/return-order';
import {
  ReturnOrder
} from '@/lib/types/return-order';
import type {
  CreateReturnOrderFormData,
  UpdateReturnOrderFormData,
  UpdateReturnStatusFormData,
  ReturnOrderApprovalFormData,
  BatchReturnOrderFormData,
} from '@/lib/validations/return-order';

// API 基础路径
const API_BASE = '/api/return-orders';

// 查询键工厂
export const returnOrderQueryKeys = {
  all: ['return-orders'] as const,
  lists: () => [...returnOrderQueryKeys.all, 'list'] as const,
  list: (params: ReturnOrderQueryParams) =>
    [...returnOrderQueryKeys.lists(), params] as const,
  details: () => [...returnOrderQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...returnOrderQueryKeys.details(), id] as const,
  stats: () => [...returnOrderQueryKeys.all, 'stats'] as const,
  salesOrderItems: (salesOrderId: string) =>
    [...returnOrderQueryKeys.all, 'sales-order-items', salesOrderId] as const,
};

// API 请求函数

/**
 * 获取退货订单列表
 */
export async function getReturnOrders(
  params: ReturnOrderQueryParams = {}
): Promise<ReturnOrderListResponse> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const response = await fetch(`${API_BASE}?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`获取退货订单列表失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 获取退货订单详情
 */
export async function getReturnOrder(id: string): Promise<ReturnOrderResponse> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    throw new Error(`获取退货订单详情失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 创建退货订单
 */
export async function createReturnOrder(
  data: CreateReturnOrderFormData
): Promise<ReturnOrderResponse> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `创建退货订单失败: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * 更新退货订单
 */
export async function updateReturnOrder(
  id: string,
  data: UpdateReturnOrderFormData
): Promise<ReturnOrderResponse> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `更新退货订单失败: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * 更新退货订单状态
 */
export async function updateReturnOrderStatus(
  id: string,
  status: string,
  remarks?: string,
  refundAmount?: number
): Promise<ReturnOrderResponse> {
  const data: UpdateReturnStatusFormData = {
    status: status as any,
    remarks,
    refundAmount,
  };

  const response = await fetch(`${API_BASE}/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `更新退货订单状态失败: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * 审核退货订单
 */
export async function approveReturnOrder(
  id: string,
  data: ReturnOrderApprovalFormData
): Promise<ReturnOrderResponse> {
  const response = await fetch(`${API_BASE}/${id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `审核退货订单失败: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * 删除退货订单
 */
export async function deleteReturnOrder(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `删除退货订单失败: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * 复制退货订单
 */
export async function duplicateReturnOrder(
  id: string
): Promise<ReturnOrderResponse> {
  const response = await fetch(`${API_BASE}/${id}/duplicate`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `复制退货订单失败: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * 批量操作退货订单
 */
export async function batchReturnOrderOperation(
  data: BatchReturnOrderFormData
): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`${API_BASE}/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `批量操作失败: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * 获取退货统计信息
 */
export async function getReturnOrderStats(): Promise<ReturnOrderStatsResponse> {
  const response = await fetch(`${API_BASE}/stats`);

  if (!response.ok) {
    throw new Error(`获取退货统计失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 获取销售订单可退货明细
 */
export async function getSalesOrderReturnableItems(
  salesOrderId: string
): Promise<any> {
  const response = await fetch(
    `/api/sales-orders/${salesOrderId}/returnable-items`
  );

  if (!response.ok) {
    throw new Error(`获取可退货明细失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 导出退货订单
 */
export async function exportReturnOrders(
  params: ReturnOrderQueryParams = {}
): Promise<Blob> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const response = await fetch(`${API_BASE}/export?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`导出退货订单失败: ${response.statusText}`);
  }

  return response.blob();
}

// TanStack Query Hooks

/**
 * 获取退货订单列表 Hook
 */
export function useReturnOrders(
  params: ReturnOrderQueryParams = {},
  options?: Omit<
    UseQueryOptions<ReturnOrderListResponse>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: returnOrderQueryKeys.list(params),
    queryFn: () => getReturnOrders(params),
    ...options,
  });
}

/**
 * 获取退货订单详情 Hook
 */
export function useReturnOrder(
  id: string,
  options?: Omit<UseQueryOptions<ReturnOrderResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: returnOrderQueryKeys.detail(id),
    queryFn: () => getReturnOrder(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * 获取退货统计 Hook
 */
export function useReturnOrderStats(
  options?: Omit<
    UseQueryOptions<ReturnOrderStatsResponse>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: returnOrderQueryKeys.stats(),
    queryFn: getReturnOrderStats,
    ...options,
  });
}

/**
 * 获取销售订单可退货明细 Hook
 */
export function useSalesOrderReturnableItems(
  salesOrderId: string,
  options?: Omit<UseQueryOptions<any>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: returnOrderQueryKeys.salesOrderItems(salesOrderId),
    queryFn: () => getSalesOrderReturnableItems(salesOrderId),
    enabled: !!salesOrderId,
    ...options,
  });
}

/**
 * 创建退货订单 Mutation Hook
 */
export function useCreateReturnOrder(
  options?: UseMutationOptions<
    ReturnOrderResponse,
    Error,
    CreateReturnOrderFormData
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createReturnOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.stats() });
    },
    ...options,
  });
}

/**
 * 更新退货订单 Mutation Hook
 */
export function useUpdateReturnOrder(
  options?: UseMutationOptions<
    ReturnOrderResponse,
    Error,
    { id: string; data: UpdateReturnOrderFormData }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateReturnOrder(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: returnOrderQueryKeys.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.stats() });
    },
    ...options,
  });
}

/**
 * 更新退货订单状态 Mutation Hook
 */
export function useUpdateReturnOrderStatus(
  options?: UseMutationOptions<
    ReturnOrderResponse,
    Error,
    { id: string; status: string; remarks?: string; refundAmount?: number }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, remarks, refundAmount }) =>
      updateReturnOrderStatus(id, status, remarks, refundAmount),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: returnOrderQueryKeys.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.stats() });
    },
    ...options,
  });
}

/**
 * 审核退货订单 Mutation Hook
 */
export function useApproveReturnOrder(
  options?: UseMutationOptions<
    ReturnOrderResponse,
    Error,
    { id: string; data: ReturnOrderApprovalFormData }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => approveReturnOrder(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: returnOrderQueryKeys.detail(id),
      });
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.stats() });
    },
    ...options,
  });
}

/**
 * 删除退货订单 Mutation Hook
 */
export function useDeleteReturnOrder(
  options?: UseMutationOptions<
    { success: boolean; message?: string },
    Error,
    string
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteReturnOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.stats() });
    },
    ...options,
  });
}

/**
 * 批量操作 Mutation Hook
 */
export function useBatchReturnOrderOperation(
  options?: UseMutationOptions<
    { success: boolean; message?: string },
    Error,
    BatchReturnOrderFormData
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: batchReturnOrderOperation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.stats() });
    },
    ...options,
  });
}
