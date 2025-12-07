/**
 * 销售订单API
 * 严格遵循全栈项目统一约定规范
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import type {
  ApiResponse,
  ErrorResponse,
  PaginatedResponse,
} from '@/lib/types/api';
import type {
  SalesOrder,
  SalesOrderCreateInput,
  SalesOrderQueryParams,
  SalesOrderStats,
  SalesOrderStatus,
  SalesOrderUpdateInput,
} from '@/lib/types/sales-order';
import { csrfFetch } from '@/lib/utils/csrf';

// API错误类型
type ApiError = ErrorResponse;

/**
 * API基础URL
 */
const API_BASE = '/api/sales-orders';

/**
 * 查询键工厂
 */
export const salesOrderQueryKeys = {
  all: ['sales-orders'] as const,
  lists: () => [...salesOrderQueryKeys.all, 'list'] as const,
  list: (params: SalesOrderQueryParams) =>
    [...salesOrderQueryKeys.lists(), params] as const,
  details: () => [...salesOrderQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...salesOrderQueryKeys.details(), id] as const,
  statistics: () => [...salesOrderQueryKeys.all, 'statistics'] as const,
  customer: (customerId: string) =>
    [...salesOrderQueryKeys.all, 'customer', customerId] as const,
};

/**
 * 获取销售订单列表
 */
export async function getSalesOrders(
  params: SalesOrderQueryParams
): Promise<PaginatedResponse<SalesOrder>> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const response = await fetch(`${API_BASE}?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`获取销售订单列表失败: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || '获取销售订单列表失败');
  }

  // API路由返回的数据结构是 { success: true, data: { data: [...], pagination: {...} } }
  // handler返回的 { data, pagination } 被 successResponse 包装
  return {
    data: result.data.data,
    pagination: result.data.pagination,
  };
}

/**
 * 获取销售订单详情
 */
export async function getSalesOrder(id: string): Promise<SalesOrder> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('销售订单不存在');
    }
    throw new Error(`获取销售订单详情失败: ${response.statusText}`);
  }

  const data: ApiResponse<SalesOrder> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '获取销售订单详情失败');
  }

  if (!data.data) {
    throw new Error('获取销售订单失败：数据为空');
  }
  return data.data;
}

/**
 * 创建销售订单
 */
export async function createSalesOrder(
  orderData: SalesOrderCreateInput
): Promise<SalesOrder> {
  const response = await csrfFetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderData),
  });

  if (!response.ok) {
    // 优先解析API返回的错误消息，便于定位500错误
    try {
      const rawText = await response.text();
      const json = JSON.parse(rawText);
      const message =
        (json?.error && (json.error.message || json.error)) ||
        response.statusText ||
        '创建销售订单失败';
      throw new Error(message);
    } catch {
      // 非JSON响应
      throw new Error(
        `创建销售订单失败: ${response.status} ${response.statusText}`
      );
    }
  }

  const data: ApiResponse<SalesOrder> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '创建销售订单失败');
  }

  if (!data.data) {
    throw new Error('创建销售订单失败：数据为空');
  }
  return data.data;
}

// 更新销售订单
export async function updateSalesOrder(
  data: SalesOrderUpdateInput
): Promise<ApiResponse<SalesOrder>> {
  const { id, ...updateData } = data;

  const response = await csrfFetch(`${API_BASE}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json();
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

// 删除销售订单
export async function deleteSalesOrder(
  id: string
): Promise<ApiResponse<{ id: string }>> {
  const response = await csrfFetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json();
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

// 更新订单状态
export async function updateSalesOrderStatus(payload: {
  id: string;
  status: SalesOrderStatus;
  remarks?: string;
  idempotencyKey: string;
}): Promise<ApiResponse<SalesOrder>> {
  const { id, ...body } = payload;
  const response = await csrfFetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json();
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

// 获取销售订单统计信息
export async function getSalesOrderStats(params?: {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  userId?: string;
}): Promise<ApiResponse<SalesOrderStats>> {
  const searchParams = new URLSearchParams();

  if (params?.startDate) {
    searchParams.set('startDate', params.startDate);
  }
  if (params?.endDate) {
    searchParams.set('endDate', params.endDate);
  }
  if (params?.customerId) {
    searchParams.set('customerId', params.customerId);
  }
  if (params?.userId) {
    searchParams.set('userId', params.userId);
  }

  const url = `${API_BASE}/stats?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json();
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

// 获取客户的历史订单
export async function getCustomerOrders(
  customerId: string,
  params?: { limit?: number; status?: SalesOrderStatus }
): Promise<ApiResponse<SalesOrder[]>> {
  const searchParams = new URLSearchParams();
  searchParams.set('customerId', customerId);

  if (params?.limit) {
    searchParams.set('limit', params.limit.toString());
  }
  if (params?.status) {
    searchParams.set('status', params.status);
  }

  const url = `${API_BASE}?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json();
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  const result = await response.json();
  return {
    success: result.success,
    data: result.data.salesOrders,
    message: result.message,
  };
}

// 复制订单
export async function copySalesOrder(
  id: string
): Promise<ApiResponse<SalesOrder>> {
  const response = await csrfFetch(`${API_BASE}/${id}/copy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json();
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

// 批量更新订单状态
export async function batchUpdateSalesOrderStatus(
  ids: string[],
  status: SalesOrderStatus,
  remarks?: string
): Promise<ApiResponse<{ updated: number; failed: string[] }>> {
  const response = await csrfFetch(`${API_BASE}/batch/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids, status, remarks }),
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json();
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

// 批量删除订单
export async function batchDeleteSalesOrders(
  ids: string[]
): Promise<ApiResponse<{ deleted: number; failed: string[] }>> {
  const response = await csrfFetch(`${API_BASE}/batch`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json();
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

// 导出订单数据
export async function exportSalesOrders(
  params: SalesOrderQueryParams = {}
): Promise<Blob> {
  const searchParams = new URLSearchParams();

  // 构建查询参数
  if (params.search) {
    searchParams.set('search', params.search);
  }
  if (params.status) {
    searchParams.set('status', params.status);
  }
  if (params.customerId) {
    searchParams.set('customerId', params.customerId);
  }
  if (params.userId) {
    searchParams.set('userId', params.userId);
  }
  if (params.startDate) {
    searchParams.set('startDate', params.startDate);
  }
  if (params.endDate) {
    searchParams.set('endDate', params.endDate);
  }

  const url = `${API_BASE}/export?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });

  if (!response.ok) {
    throw new Error(`导出失败: ${response.status}`);
  }

  return response.blob();
}

// 获取订单打印数据
export async function getSalesOrderPrintData(id: string): Promise<
  ApiResponse<{
    order: SalesOrder;
    printTemplate: string;
  }>
> {
  const response = await fetch(`${API_BASE}/${id}/print`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData: ApiError = await response.json();
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

// ============================================================================
// TanStack Query Mutation Hooks
// ============================================================================

/**
 * 创建销售订单 Mutation Hook
 */
export function useCreateSalesOrder(
  options?: UseMutationOptions<
    SalesOrder,
    Error,
    SalesOrderCreateInput,
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSalesOrder,
    onSuccess: () => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
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
 * 更新销售订单 Mutation Hook
 */
export function useUpdateSalesOrder(
  options?: UseMutationOptions<
    ApiResponse<SalesOrder>,
    Error,
    SalesOrderUpdateInput,
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSalesOrder,
    onSuccess: (_, { id }) => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.detail(id),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
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
 * 删除销售订单 Mutation Hook
 */
export function useDeleteSalesOrder(
  options?: UseMutationOptions<
    ApiResponse<{ id: string }>,
    Error,
    string,
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSalesOrder,
    onSuccess: (_, id) => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // 移除详情缓存
      queryClient.removeQueries({
        queryKey: salesOrderQueryKeys.detail(id),
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
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
 * 更新销售订单状态 Mutation Hook
 */
export function useUpdateSalesOrderStatus(
  options?: UseMutationOptions<
    ApiResponse<SalesOrder>,
    Error,
    {
      id: string;
      status: SalesOrderStatus;
      remarks?: string;
      idempotencyKey: string;
    },
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSalesOrderStatus,
    // 先应用外部传入的配置（可能包含 onError、retry 等）
    ...options,
    // 统一的成功处理：先做内部缓存刷新，再调用外部传入的 onSuccess
    onSuccess: (data, variables, onMutateResult, context) => {
      const { id } = variables;

      // ✅ 立即刷新当前模块缓存（详情、列表、统计）
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.detail(id),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all,
      });

      // 调用外部自定义 onSuccess（如果有）
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    // 其它配置（onError / onSettled / retry 等）保持由外部传入
  });
}

/**
 * 复制销售订单 Mutation Hook
 */
export function useCopySalesOrder(
  options?: UseMutationOptions<
    ApiResponse<SalesOrder>,
    Error,
    string,
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: copySalesOrder,
    onSuccess: () => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
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
 * 批量更新销售订单状态 Mutation Hook
 */
export function useBatchUpdateSalesOrderStatus(
  options?: UseMutationOptions<
    ApiResponse<{ updated: number; failed: string[] }>,
    Error,
    { ids: string[]; status: SalesOrderStatus; remarks?: string },
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, status, remarks }) =>
      batchUpdateSalesOrderStatus(ids, status, remarks),
    onSuccess: () => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
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
 * 批量删除销售订单 Mutation Hook
 */
export function useBatchDeleteSalesOrders(
  options?: UseMutationOptions<
    ApiResponse<{ deleted: number; failed: string[] }>,
    Error,
    string[],
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: batchDeleteSalesOrders,
    onSuccess: () => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
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
