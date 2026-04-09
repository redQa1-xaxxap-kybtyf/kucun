// 退货管理 API 客户端
// 使用 TanStack Query 进行状态管理和缓存

import {
  type UseMutationOptions,
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import type { ReturnableItemsResponse } from '@/lib/services/sales-order-service';
import type {
  ReturnOrderListResponse,
  ReturnOrderQueryParams,
  ReturnOrderResponse,
  ReturnOrderStatsResponse,
} from '@/lib/types/return-order';
import { csrfFetch } from '@/lib/utils/csrf';
import type {
  BatchReturnOrderFormData,
  CreateReturnOrderFormData,
  ReturnOrderApprovalFormData,
  UpdateReturnOrderFormData,
  UpdateReturnStatusFormData,
} from '@/lib/validations/return-order';
import { createFriendlyApiError } from '@/lib/utils/user-friendly-error';

// API 基础路径
const API_BASE = '/api/return-orders';

// 使用全局统一的查询键
export const returnOrderQueryKeys = queryKeys.returnOrders;

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
    throw await createFriendlyApiError(response, '获取退货订单列表失败');
  }

  return response.json();
}

/**
 * 获取退货订单详情
 */
export async function getReturnOrder(id: string): Promise<ReturnOrderResponse> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    throw await createFriendlyApiError(response, '获取退货订单详情失败');
  }

  return response.json();
}

/**
 * 创建退货订单
 */
export async function createReturnOrder(
  data: CreateReturnOrderFormData
): Promise<ReturnOrderResponse> {
  const response = await csrfFetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '创建退货订单失败');
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
  const response = await csrfFetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '更新退货订单失败');
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
  // 生成幂等性键
  const idempotencyKey = crypto.randomUUID();

  const data: UpdateReturnStatusFormData = {
    idempotencyKey,
    status: status as UpdateReturnStatusFormData['status'],
    remarks,
    refundAmount,
  };

  const response = await csrfFetch(`${API_BASE}/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '更新退货订单状态失败');
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
  const response = await csrfFetch(`${API_BASE}/${id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '审核退货订单失败');
  }

  return response.json();
}

/**
 * 删除退货订单
 */
export async function deleteReturnOrder(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const response = await csrfFetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '删除退货订单失败');
  }

  return response.json();
}

/**
 * 复制退货订单
 */
export async function duplicateReturnOrder(
  id: string
): Promise<ReturnOrderResponse> {
  const response = await csrfFetch(`${API_BASE}/${id}/duplicate`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '复制退货订单失败');
  }

  return response.json();
}

/**
 * 批量操作退货订单
 */
export async function batchReturnOrderOperation(
  data: BatchReturnOrderFormData
): Promise<{ success: boolean; message?: string }> {
  const response = await csrfFetch(`${API_BASE}/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '批量操作失败');
  }

  return response.json();
}

/**
 * 获取退货统计信息
 */
export async function getReturnOrderStats(): Promise<ReturnOrderStatsResponse> {
  const response = await fetch(`${API_BASE}/stats`);

  if (!response.ok) {
    throw await createFriendlyApiError(response, '获取退货统计失败');
  }

  return response.json();
}

/**
 * 获取销售订单可退货明细
 */
export async function getSalesOrderReturnableItems(
  salesOrderId: string
): Promise<{ success: boolean; data: ReturnableItemsResponse }> {
  const response = await fetch(
    `/api/sales-orders/${salesOrderId}/returnable-items`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 包含cookies以传递会话信息
    }
  );

  if (!response.ok) {
    throw await createFriendlyApiError(response, '获取可退货明细失败');
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
    throw await createFriendlyApiError(response, '导出退货订单失败');
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
  options?: Omit<
    UseQueryOptions<{ success: boolean; data: ReturnableItemsResponse }>,
    'queryKey' | 'queryFn'
  >
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
    CreateReturnOrderFormData,
    unknown
  >
) {
  const queryClient = useQueryClient();

  const { onSuccess, onError, onSettled, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: createReturnOrder,
    ...restOptions,
    onSuccess: (data, variables, onMutateResult, context) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建后立即看到新订单
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.stats(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      // 允许调用方追加自定义 onSuccess（例如提示、导航），不会覆盖默认刷新逻辑
      onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      onError?.(error, variables, onMutateResult, context);
    },
    onSettled: (data, error, variables, onMutateResult, context) => {
      onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}

/**
 * 更新退货订单 Mutation Hook
 */
export function useUpdateReturnOrder(
  options?: UseMutationOptions<
    ReturnOrderResponse,
    Error,
    { id: string; data: UpdateReturnOrderFormData },
    unknown
  >
) {
  const queryClient = useQueryClient();

  const { onSuccess, onError, onSettled, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: ({ id, data }) => updateReturnOrder(id, data),
    ...restOptions,
    onSuccess: (data, variables, onMutateResult, context) => {
      const { id } = variables;
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新后立即看到变化
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.detail(id),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.stats(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      onError?.(error, variables, onMutateResult, context);
    },
    onSettled: (data, error, variables, onMutateResult, context) => {
      onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}

/**
 * 更新退货订单状态 Mutation Hook
 */
export function useUpdateReturnOrderStatus(
  options?: UseMutationOptions<
    ReturnOrderResponse,
    Error,
    { id: string; status: string; remarks?: string; refundAmount?: number },
    unknown
  >
) {
  const queryClient = useQueryClient();

  const { onSuccess, onError, onSettled, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: ({ id, status, remarks, refundAmount }) =>
      updateReturnOrderStatus(id, status, remarks, refundAmount),
    ...restOptions,
    onSuccess: (data, variables, onMutateResult, context) => {
      const { id } = variables;
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新状态后立即看到变化
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.detail(id),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.stats(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all,
      });
      // 允许调用方追加自定义 onSuccess（例如 Toast 提示）
      onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      onError?.(error, variables, onMutateResult, context);
    },
    onSettled: (data, error, variables, onMutateResult, context) => {
      onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}

/**
 * 审核退货订单 Mutation Hook
 */
export function useApproveReturnOrder(
  options?: UseMutationOptions<
    ReturnOrderResponse,
    Error,
    { id: string; data: ReturnOrderApprovalFormData },
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => approveReturnOrder(id, data),
    onSuccess: (_, { id }) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户审核后立即看到变化
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.detail(id),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.stats(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all,
      });
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
    string,
    unknown
  >
) {
  const queryClient = useQueryClient();

  const { onSuccess, onError, onSettled, ...restOptions } = options ?? {};

  return useMutation({
    mutationFn: deleteReturnOrder,
    ...restOptions,
    onSuccess: (data, variables, onMutateResult, context) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户删除后立即看到变化
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.stats(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      // 始终先执行默认刷新逻辑，再附加调用方自定义 onSuccess（例如 Toast 提示）
      onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      onError?.(error, variables, onMutateResult, context);
    },
    onSettled: (data, error, variables, onMutateResult, context) => {
      onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}

/**
 * 批量操作 Mutation Hook
 */
export function useBatchReturnOrderOperation(
  options?: UseMutationOptions<
    { success: boolean; message?: string },
    Error,
    BatchReturnOrderFormData,
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: batchReturnOrderOperation,
    onSuccess: () => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户批量操作后立即看到变化
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: returnOrderQueryKeys.stats(),
        type: 'active',
      });
    },
    ...options,
  });
}
