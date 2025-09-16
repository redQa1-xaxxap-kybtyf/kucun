// 采购订单 API 客户端
// 使用 TanStack Query 进行服务器状态管理

import type {
  PurchaseOrderQueryParams,
  PurchaseOrderResponse,
  PurchaseOrderListResponse,
  PurchaseOrderCreateInput,
  PurchaseOrderUpdateInput,
  PurchaseOrderStatsResponse,
  Supplier } from '@/lib/types/purchase-order';
import {
  PurchaseOrder,
  PurchaseOrderStats
} from '@/lib/types/purchase-order';

// API 基础配置
const API_BASE_URL = '/api/purchase-orders';

// 通用请求函数
async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

// 查询键工厂
export const purchaseOrderQueryKeys = {
  all: ['purchase-orders'] as const,
  lists: () => [...purchaseOrderQueryKeys.all, 'list'] as const,
  list: (params: PurchaseOrderQueryParams) =>
    [...purchaseOrderQueryKeys.lists(), params] as const,
  details: () => [...purchaseOrderQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseOrderQueryKeys.details(), id] as const,
  stats: () => [...purchaseOrderQueryKeys.all, 'stats'] as const,
  suppliers: () => ['suppliers'] as const,
  suppliersList: () => [...purchaseOrderQueryKeys.suppliers(), 'list'] as const,
  supplier: (id: string) =>
    [...purchaseOrderQueryKeys.suppliers(), id] as const,
};

// 获取采购订单列表
export async function getPurchaseOrders(
  params: PurchaseOrderQueryParams = {}
): Promise<PurchaseOrderListResponse> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const url = `${API_BASE_URL}?${searchParams.toString()}`;
  return apiRequest<PurchaseOrderListResponse>(url);
}

// 获取采购订单详情
export async function getPurchaseOrder(
  id: string
): Promise<PurchaseOrderResponse> {
  return apiRequest<PurchaseOrderResponse>(`${API_BASE_URL}/${id}`);
}

// 创建采购订单
export async function createPurchaseOrder(
  data: PurchaseOrderCreateInput
): Promise<PurchaseOrderResponse> {
  return apiRequest<PurchaseOrderResponse>(API_BASE_URL, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 更新采购订单
export async function updatePurchaseOrder(
  id: string,
  data: PurchaseOrderUpdateInput
): Promise<PurchaseOrderResponse> {
  return apiRequest<PurchaseOrderResponse>(`${API_BASE_URL}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// 删除采购订单
export async function deletePurchaseOrder(
  id: string
): Promise<{ success: boolean; message?: string }> {
  return apiRequest<{ success: boolean; message?: string }>(
    `${API_BASE_URL}/${id}`,
    {
      method: 'DELETE',
    }
  );
}

// 更新采购订单状态
export async function updatePurchaseOrderStatus(
  id: string,
  status: string,
  actualDeliveryDate?: string,
  remarks?: string
): Promise<PurchaseOrderResponse> {
  return apiRequest<PurchaseOrderResponse>(`${API_BASE_URL}/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, actualDeliveryDate, remarks }),
  });
}

// 确认采购订单
export async function confirmPurchaseOrder(
  id: string
): Promise<PurchaseOrderResponse> {
  return updatePurchaseOrderStatus(id, 'confirmed');
}

// 标记采购订单为已收货
export async function receivePurchaseOrder(
  id: string,
  actualDeliveryDate: string,
  remarks?: string
): Promise<PurchaseOrderResponse> {
  return updatePurchaseOrderStatus(id, 'received', actualDeliveryDate, remarks);
}

// 完成采购订单
export async function completePurchaseOrder(
  id: string,
  remarks?: string
): Promise<PurchaseOrderResponse> {
  return updatePurchaseOrderStatus(id, 'completed', undefined, remarks);
}

// 取消采购订单
export async function cancelPurchaseOrder(
  id: string,
  remarks?: string
): Promise<PurchaseOrderResponse> {
  return updatePurchaseOrderStatus(id, 'cancelled', undefined, remarks);
}

// 复制采购订单
export async function duplicatePurchaseOrder(
  id: string
): Promise<PurchaseOrderResponse> {
  return apiRequest<PurchaseOrderResponse>(`${API_BASE_URL}/${id}/duplicate`, {
    method: 'POST',
  });
}

// 获取采购订单统计信息
export async function getPurchaseOrderStats(): Promise<PurchaseOrderStatsResponse> {
  return apiRequest<PurchaseOrderStatsResponse>(`${API_BASE_URL}/stats`);
}

// 导出采购订单
export async function exportPurchaseOrders(
  params: PurchaseOrderQueryParams = {}
): Promise<Blob> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const response = await fetch(
    `${API_BASE_URL}/export?${searchParams.toString()}`
  );

  if (!response.ok) {
    throw new Error(`导出失败: ${response.status}`);
  }

  return response.blob();
}

// 批量操作采购订单
export async function batchOperatePurchaseOrders(
  orderIds: string[],
  operation: 'confirm' | 'cancel' | 'delete',
  reason?: string
): Promise<{ success: boolean; message?: string; results?: any[] }> {
  return apiRequest<{ success: boolean; message?: string; results?: any[] }>(
    `${API_BASE_URL}/batch`,
    {
      method: 'POST',
      body: JSON.stringify({ orderIds, operation, reason }),
    }
  );
}

// 供应商相关 API（简化版）
export async function getSuppliers(): Promise<{
  success: boolean;
  data: Supplier[];
}> {
  return apiRequest<{ success: boolean; data: Supplier[] }>('/api/suppliers');
}

export async function getSupplier(
  id: string
): Promise<{ success: boolean; data: Supplier }> {
  return apiRequest<{ success: boolean; data: Supplier }>(
    `/api/suppliers/${id}`
  );
}

export async function createSupplier(data: {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}): Promise<{ success: boolean; data: Supplier }> {
  return apiRequest<{ success: boolean; data: Supplier }>('/api/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateSupplier(
  id: string,
  data: {
    name?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    status?: 'active' | 'inactive';
  }
): Promise<{ success: boolean; data: Supplier }> {
  return apiRequest<{ success: boolean; data: Supplier }>(
    `/api/suppliers/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    }
  );
}

export async function deleteSupplier(
  id: string
): Promise<{ success: boolean; message?: string }> {
  return apiRequest<{ success: boolean; message?: string }>(
    `/api/suppliers/${id}`,
    {
      method: 'DELETE',
    }
  );
}

// 搜索供应商
export async function searchSuppliers(
  query: string
): Promise<{ success: boolean; data: Supplier[] }> {
  const searchParams = new URLSearchParams({ search: query });
  return apiRequest<{ success: boolean; data: Supplier[] }>(
    `/api/suppliers/search?${searchParams.toString()}`
  );
}

// 获取供应商的采购历史
export async function getSupplierPurchaseHistory(
  supplierId: string,
  params: { page?: number; limit?: number } = {}
): Promise<PurchaseOrderListResponse> {
  const searchParams = new URLSearchParams({ supplierId, ...params } as any);
  return apiRequest<PurchaseOrderListResponse>(
    `${API_BASE_URL}?${searchParams.toString()}`
  );
}

// 获取产品的采购历史
export async function getProductPurchaseHistory(
  productId: string,
  params: { page?: number; limit?: number } = {}
): Promise<PurchaseOrderListResponse> {
  const searchParams = new URLSearchParams();
  searchParams.append('productId', productId);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  return apiRequest<PurchaseOrderListResponse>(
    `${API_BASE_URL}?${searchParams.toString()}`
  );
}

// 获取采购订单的入库记录
export async function getPurchaseOrderInboundRecords(id: string): Promise<{
  success: boolean;
  data: Array<{
    id: string;
    recordNumber: string;
    productId: string;
    colorCode?: string;
    productionDate?: string;
    quantity: number;
    createdAt: string;
    product?: {
      name: string;
      code: string;
      unit: string;
    };
  }>;
}> {
  return apiRequest<any>(`${API_BASE_URL}/${id}/inbound-records`);
}

// 创建采购订单入库记录
export async function createPurchaseOrderInbound(
  purchaseOrderId: string,
  items: Array<{
    productId: string;
    colorCode?: string;
    productionDate?: string;
    quantity: number;
    unitCost?: number;
  }>
): Promise<{ success: boolean; message?: string }> {
  return apiRequest<{ success: boolean; message?: string }>(
    `${API_BASE_URL}/${purchaseOrderId}/inbound`,
    {
      method: 'POST',
      body: JSON.stringify({ items }),
    }
  );
}

// 检查采购订单是否可以删除
export async function checkPurchaseOrderDeletable(id: string): Promise<{
  success: boolean;
  deletable: boolean;
  reason?: string;
}> {
  return apiRequest<{
    success: boolean;
    deletable: boolean;
    reason?: string;
  }>(`${API_BASE_URL}/${id}/check-deletable`);
}

// 获取采购订单的状态历史
export async function getPurchaseOrderStatusHistory(id: string): Promise<{
  success: boolean;
  data: Array<{
    id: string;
    status: string;
    remarks?: string;
    createdAt: string;
    user?: {
      name: string;
    };
  }>;
}> {
  return apiRequest<any>(`${API_BASE_URL}/${id}/status-history`);
}
