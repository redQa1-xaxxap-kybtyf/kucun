/**
 * 采购订单 API 客户端
 * 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式
 */

import { queryKeys } from '@/lib/queryKeys';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@/lib/types/purchase-order';

// 导出 Query Keys（从 queryKeys 中获取）
export const purchaseOrderQueryKeys = queryKeys.purchaseOrders;

// 列表查询参数
export interface PurchaseOrderListParams {
  page?: number;
  limit?: number;
  status?: PurchaseOrderStatus;
  supplierId?: string;
  containerNumber?: string;
  orderNumber?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 获取采购订单列表
 */
export async function getPurchaseOrders(
  params: PurchaseOrderListParams
): Promise<{
  data: PurchaseOrder[];
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
  if (params.supplierId) {
    searchParams.set('supplierId', params.supplierId);
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
  if (params.sortBy) {
    searchParams.set('sortBy', params.sortBy);
  }
  if (params.sortOrder) {
    searchParams.set('sortOrder', params.sortOrder);
  }

  const response = await fetch(`/api/purchase-orders?${searchParams}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '获取采购订单列表失败');
  }

  return response.json();
}

/**
 * 获取单个采购订单详情
 */
export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const response = await fetch(`/api/purchase-orders/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || '获取采购订单详情失败');
  }

  const result = await response.json();
  return result.data;
}
