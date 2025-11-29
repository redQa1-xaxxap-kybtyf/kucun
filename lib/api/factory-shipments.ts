/**
 * 厂家发货订单 API 客户端
 * 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';
import { csrfFetch } from '@/lib/utils/csrf';
import type {
  CreateFactoryShipmentOrderData,
  FactoryShipmentOrderListParams,
  UpdateFactoryShipmentOrderData,
  UpdateFactoryShipmentOrderStatusData,
} from '@/lib/validations/factory-shipment';

export type FactoryShipmentValidationIssue = {
  path?: string;
  message: string;
  code?: string;
};

export class FactoryShipmentValidationError extends Error {
  public readonly details: FactoryShipmentValidationIssue[];
  public readonly status: number;

  constructor(
    message: string,
    details: FactoryShipmentValidationIssue[] = [],
    status = 422
  ) {
    super(message);
    this.name = 'FactoryShipmentValidationError';
    this.details = details;
    this.status = status;
  }
}

type ErrorPayload = {
  error?: string;
  message?: string;
  details?: FactoryShipmentValidationIssue[];
};

function isValidationErrorPayload(payload: unknown): payload is ErrorPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    Array.isArray((payload as ErrorPayload).details)
  );
}

async function parseErrorResponse(
  response: Response
): Promise<ErrorPayload | null> {
  try {
    return (await response.json()) as ErrorPayload;
  } catch {
    return null;
  }
}

async function throwFactoryShipmentError(
  response: Response,
  fallbackMessage: string
): Promise<never> {
  const payload = await parseErrorResponse(response);

  if (response.status === 422 && isValidationErrorPayload(payload)) {
    throw new FactoryShipmentValidationError(
      payload?.error || payload?.message || '数据验证失败',
      payload?.details ?? [],
      response.status
    );
  }

  const message =
    payload?.error ||
    payload?.message ||
    `${fallbackMessage}: ${response.statusText || `HTTP ${response.status}`}`;

  throw new Error(message);
}

// API 调用函数

/**
 * 获取厂家发货订单列表
 */
export async function getFactoryShipmentOrders(
  params: FactoryShipmentOrderListParams
): Promise<{
  data: FactoryShipmentOrder[];
  total: number;
  page: number;
  limit: number;
}> {
  const searchParams = new URLSearchParams();

  if (params.page) {
    searchParams.set('page', params.page.toString());
  }
  if (params.limit) {
    searchParams.set('limit', params.limit.toString());
  }
  if (params.status) {
    searchParams.set('status', params.status);
  }
  if (params.customerId) {
    searchParams.set('customerId', params.customerId);
  }
  if (params.containerNumber) {
    searchParams.set('containerNumber', params.containerNumber);
  }
  if (params.orderNumber) {
    searchParams.set('orderNumber', params.orderNumber);
  }
  if (params.startDate) {
    searchParams.set('startDate', params.startDate.toISOString());
  }
  if (params.endDate) {
    searchParams.set('endDate', params.endDate.toISOString());
  }
  // ✅ P0修复: 添加 search 参数序列化
  // 修复前：search 参数被完全忽略，导致搜索、分享链接、轮询刷新全部失效
  // 修复后：search 参数正确传递到 API 路由，支持同时搜索柜号和订单号
  if (params.search) {
    searchParams.set('search', params.search);
  }

  const response = await fetch(`/api/factory-shipments?${searchParams}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '获取厂家发货订单列表失败');
  }

  return response.json();
}

/**
 * 获取单个厂家发货订单详情
 */
export async function getFactoryShipmentOrder(
  id: string
): Promise<FactoryShipmentOrder> {
  const response = await fetch(`/api/factory-shipments/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '获取厂家发货订单详情失败');
  }

  return response.json();
}

/**
 * 创建厂家发货订单
 */
export async function createFactoryShipmentOrder(
  data: CreateFactoryShipmentOrderData
): Promise<FactoryShipmentOrder> {
  const response = await csrfFetch('/api/factory-shipments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await throwFactoryShipmentError(response, '创建厂家发货订单失败');
  }

  return response.json();
}

/**
 * 更新厂家发货订单
 */
export async function updateFactoryShipmentOrder(
  id: string,
  data: UpdateFactoryShipmentOrderData
): Promise<FactoryShipmentOrder> {
  const response = await csrfFetch(`/api/factory-shipments/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await throwFactoryShipmentError(response, '更新厂家发货订单失败');
  }

  return response.json();
}

/**
 * 更新厂家发货订单状态
 */
export async function updateFactoryShipmentOrderStatus(
  id: string,
  data: UpdateFactoryShipmentOrderStatusData
): Promise<FactoryShipmentOrder> {
  console.log('[DEBUG] 更新订单状态 - 请求数据:', { id, data });

  const response = await csrfFetch(`/api/factory-shipments/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('[DEBUG] 更新订单状态 - 服务器错误响应:', {
      status: response.status,
      statusText: response.statusText,
      error,
    });
    throw new Error(error.error || error.message || '更新厂家发货订单状态失败');
  }

  const result = await response.json();
  console.log('[DEBUG] 更新订单状态 - 成功响应:', result);
  return result;
}

/**
 * 更新厂家发货订单集装箱号
 */
export async function updateFactoryShipmentOrderContainerNumber(
  id: string,
  data: { containerNumber: string }
): Promise<FactoryShipmentOrder> {
  const response = await csrfFetch(
    `/api/factory-shipments/${id}/container-number`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '更新集装箱号失败');
  }

  return response.json();
}

/**
 * 删除厂家发货订单
 */
export async function deleteFactoryShipmentOrder(id: string): Promise<void> {
  const response = await csrfFetch(`/api/factory-shipments/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '删除厂家发货订单失败');
  }
}

/**
 * 取消厂家发货订单
 */
export async function cancelFactoryShipmentOrder(id: string): Promise<void> {
  const response = await csrfFetch(`/api/factory-shipments/${id}/cancel`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '取消厂家发货订单失败');
  }
}

// React Query Hooks

/**
 * 转换 API 响应为客户端期望的数据结构
 * ✅ P0修复: 提取数据转换逻辑，确保 SSR 和客户端使用相同的数据结构
 */
export function transformFactoryShipmentListResponse(rawResponse: {
  data: FactoryShipmentOrder[];
  total: number;
  page: number;
  limit: number;
}) {
  return {
    orders: rawResponse.data,
    pagination: {
      page: rawResponse.page,
      limit: rawResponse.limit,
      totalCount: rawResponse.total,
      totalPages: Math.ceil(rawResponse.total / rawResponse.limit),
    },
  };
}

/**
 * 获取厂家发货订单列表的 Hook
 * ✅ P0修复: 使用数据转换函数，确保返回结构与组件期望一致
 */
export function useFactoryShipmentOrders(
  params: FactoryShipmentOrderListParams
) {
  return useQuery({
    queryKey: queryKeys.factoryShipments.list(params),
    queryFn: async () => {
      const rawData = await getFactoryShipmentOrders(params);
      return transformFactoryShipmentListResponse(rawData);
    },
    staleTime: 5 * 60 * 1000, // 5分钟
  });
}

/**
 * 获取单个厂家发货订单详情的 Hook
 */
export function useFactoryShipmentOrder(id: string) {
  return useQuery({
    queryKey: queryKeys.factoryShipments.detail(id),
    queryFn: () => getFactoryShipmentOrder(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5分钟
  });
}

/**
 * 创建厂家发货订单的 Hook
 */
export function useCreateFactoryShipmentOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFactoryShipmentOrder,
    onSuccess: () => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建发货单后立即看到新记录
      // 刷新所有列表查询（使用 predicate 匹配所有列表查询）
      queryClient.refetchQueries({
        predicate: query =>
          query.queryKey[0] === 'factory-shipments' &&
          query.queryKey[1] === 'list',
        type: 'active',
      });
    },
  });
}

/**
 * 更新厂家发货订单的 Hook
 */
export function useUpdateFactoryShipmentOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateFactoryShipmentOrderData;
    }) => updateFactoryShipmentOrder(id, data),
    onSuccess: (_, { id }) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新发货单后立即看到变化
      // 刷新详情页
      queryClient.refetchQueries({
        queryKey: queryKeys.factoryShipments.detail(id),
        type: 'active',
      });
      // 刷新所有列表查询（使用 predicate 匹配所有列表查询）
      queryClient.refetchQueries({
        predicate: query =>
          query.queryKey[0] === 'factory-shipments' &&
          query.queryKey[1] === 'list',
        type: 'active',
      });

      // ✅ 刷新库存缓存（厂家发货会影响库存）
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });

      // ✅ 刷新仪表盘缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
    },
  });
}

/**
 * 更新厂家发货订单状态的 Hook
 */
export function useUpdateFactoryShipmentOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateFactoryShipmentOrderStatusData;
    }) => updateFactoryShipmentOrderStatus(id, data),
    onSuccess: (_, { id }) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新状态后立即看到变化
      // 刷新详情页
      queryClient.refetchQueries({
        queryKey: queryKeys.factoryShipments.detail(id),
        type: 'active',
      });
      // 刷新所有列表查询（使用 predicate 匹配所有列表查询）
      queryClient.refetchQueries({
        predicate: query =>
          query.queryKey[0] === 'factory-shipments' &&
          query.queryKey[1] === 'list',
        type: 'active',
      });

      // ✅ 刷新库存缓存（厂家发货会影响库存）
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });

      // ✅ 刷新仪表盘缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
    },
  });
}

/**
 * 删除厂家发货订单的 Hook
 */
export function useDeleteFactoryShipmentOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFactoryShipmentOrder,
    onSuccess: () => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户删除发货单后立即看到变化
      // 刷新所有列表查询（使用 predicate 匹配所有列表查询）
      queryClient.refetchQueries({
        predicate: query =>
          query.queryKey[0] === 'factory-shipments' &&
          query.queryKey[1] === 'list',
        type: 'active',
      });
    },
  });
}

/**
 * 更新厂家发货订单集装箱号的 Hook
 */
export function useUpdateFactoryShipmentOrderContainerNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { containerNumber: string };
    }) => updateFactoryShipmentOrderContainerNumber(id, data),
    onSuccess: (_, { id }) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新集装箱号后立即看到变化
      // 刷新详情页
      queryClient.refetchQueries({
        queryKey: queryKeys.factoryShipments.detail(id),
        type: 'active',
      });
      // 刷新所有列表查询（使用 predicate 匹配所有列表查询）
      queryClient.refetchQueries({
        predicate: query =>
          query.queryKey[0] === 'factory-shipments' &&
          query.queryKey[1] === 'list',
        type: 'active',
      });
    },
  });
}

/**
 * 更新厂家发货订单船公司名称
 */
export async function updateFactoryShipmentOrderShippingCompany(
  id: string,
  data: { shippingCompany: string }
): Promise<FactoryShipmentOrder> {
  const response = await fetch(
    `/api/factory-shipments/${id}/shipping-company`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '更新船公司名称失败');
  }

  const result = await response.json();
  return result.data;
}

/**
 * 手动触发运输查询
 */
export async function triggerFactoryShipmentShippingQuery(id: string): Promise<{
  orderId: string;
  nextAvailableAt?: string;
  message?: string;
}> {
  const response = await fetch(`/api/factory-shipments/${id}/shipping-query`, {
    method: 'POST',
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || '手动查询失败，请稍后重试');
  }

  return {
    orderId: payload?.data?.orderId ?? id,
    nextAvailableAt: payload?.data?.nextAvailableAt,
    message: payload?.message,
  };
}

/**
 * 更新厂家发货订单船公司名称的 Hook
 */
export function useUpdateFactoryShipmentOrderShippingCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { shippingCompany: string };
    }) => updateFactoryShipmentOrderShippingCompany(id, data),
    onSuccess: (_, { id }) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新船公司名称后立即看到变化
      // 刷新详情页
      queryClient.refetchQueries({
        queryKey: queryKeys.factoryShipments.detail(id),
        type: 'active',
      });
      // 刷新所有列表查询（使用 predicate 匹配所有列表查询）
      queryClient.refetchQueries({
        predicate: query =>
          query.queryKey[0] === 'factory-shipments' &&
          query.queryKey[1] === 'list',
        type: 'active',
      });
    },
  });
}

/**
 * 手动触发运输查询的 Hook
 */
export function useTriggerFactoryShipmentShippingQuery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => triggerFactoryShipmentShippingQuery(id),
    onSuccess: () => {
      queryClient.refetchQueries({
        predicate: query =>
          query.queryKey[0] === 'factory-shipments' &&
          query.queryKey[1] === 'list',
        type: 'active',
      });
    },
  });
}

/**
 * 取消厂家发货订单的 Hook
 */
export function useCancelFactoryShipmentOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelFactoryShipmentOrder,
    onSuccess: (_, id) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户取消订单后立即看到变化
      // 刷新详情页
      queryClient.refetchQueries({
        queryKey: queryKeys.factoryShipments.detail(id),
        type: 'active',
      });
      // 刷新所有列表查询（使用 predicate 匹配所有列表查询）
      queryClient.refetchQueries({
        predicate: query =>
          query.queryKey[0] === 'factory-shipments' &&
          query.queryKey[1] === 'list',
        type: 'active',
      });
    },
  });
}
