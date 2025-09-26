/**
 * 销售订单API
 * 严格遵循全栈项目统一约定规范
 */

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

  // API路由返回的数据结构是 { success: true, data: [...], pagination: {...} }
  // 需要转换为 PaginatedResponse 格式
  return {
    data: result.data,
    pagination: result.pagination,
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
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderData),
  });

  if (!response.ok) {
    throw new Error(`创建销售订单失败: ${response.statusText}`);
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

  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
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
  const response = await fetch(`${API_BASE}/${id}`, {
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
export async function updateSalesOrderStatus(
  id: string,
  status: SalesOrderStatus,
  remarks?: string
): Promise<ApiResponse<SalesOrder>> {
  const response = await fetch(`${API_BASE}/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, remarks }),
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

  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);
  if (params?.customerId) searchParams.set('customerId', params.customerId);
  if (params?.userId) searchParams.set('userId', params.userId);

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

  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.status) searchParams.set('status', params.status);

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
  const response = await fetch(`${API_BASE}/${id}/copy`, {
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
  const response = await fetch(`${API_BASE}/batch/status`, {
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
  const response = await fetch(`${API_BASE}/batch`, {
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
  if (params.search) searchParams.set('search', params.search);
  if (params.status) searchParams.set('status', params.status);
  if (params.customerId) searchParams.set('customerId', params.customerId);
  if (params.userId) searchParams.set('userId', params.userId);
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);

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
