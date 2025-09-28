/**
 * 厂家发货订单 API 客户端
 * 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateFactoryShipmentOrderData,
  FactoryShipmentOrderListParams,
  UpdateFactoryShipmentOrderData,
  UpdateFactoryShipmentOrderStatusData,
} from '@/lib/schemas/factory-shipment';
import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';

// Query Keys
export const factoryShipmentQueryKeys = {
  all: ['factory-shipments'] as const,
  lists: () => [...factoryShipmentQueryKeys.all, 'list'] as const,
  list: (params: FactoryShipmentOrderListParams) =>
    [...factoryShipmentQueryKeys.lists(), params] as const,
  details: () => [...factoryShipmentQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...factoryShipmentQueryKeys.details(), id] as const,
};

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

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.status) searchParams.set('status', params.status);
  if (params.customerId) searchParams.set('customerId', params.customerId);
  if (params.containerNumber)
    searchParams.set('containerNumber', params.containerNumber);
  if (params.orderNumber) searchParams.set('orderNumber', params.orderNumber);
  if (params.startDate)
    searchParams.set('startDate', params.startDate.toISOString());
  if (params.endDate) searchParams.set('endDate', params.endDate.toISOString());

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
  const response = await fetch('/api/factory-shipments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '创建厂家发货订单失败');
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
  const response = await fetch(`/api/factory-shipments/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '更新厂家发货订单失败');
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
  const response = await fetch(`/api/factory-shipments/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '更新厂家发货订单状态失败');
  }

  return response.json();
}

/**
 * 删除厂家发货订单
 */
export async function deleteFactoryShipmentOrder(id: string): Promise<void> {
  const response = await fetch(`/api/factory-shipments/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '删除厂家发货订单失败');
  }
}

// React Query Hooks

/**
 * 获取厂家发货订单列表的 Hook
 */
export function useFactoryShipmentOrders(
  params: FactoryShipmentOrderListParams
) {
  return useQuery({
    queryKey: factoryShipmentQueryKeys.list(params),
    queryFn: () => getFactoryShipmentOrders(params),
    staleTime: 5 * 60 * 1000, // 5分钟
  });
}

/**
 * 获取单个厂家发货订单详情的 Hook
 */
export function useFactoryShipmentOrder(id: string) {
  return useQuery({
    queryKey: factoryShipmentQueryKeys.detail(id),
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
      // 刷新列表数据
      queryClient.invalidateQueries({
        queryKey: factoryShipmentQueryKeys.lists(),
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
      // 刷新详情和列表数据
      queryClient.invalidateQueries({
        queryKey: factoryShipmentQueryKeys.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: factoryShipmentQueryKeys.lists(),
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
      // 刷新详情和列表数据
      queryClient.invalidateQueries({
        queryKey: factoryShipmentQueryKeys.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: factoryShipmentQueryKeys.lists(),
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
      // 刷新列表数据
      queryClient.invalidateQueries({
        queryKey: factoryShipmentQueryKeys.lists(),
      });
    },
  });
}
