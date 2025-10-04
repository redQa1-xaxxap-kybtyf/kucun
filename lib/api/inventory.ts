/**
 * 库存管理API
 * 严格遵循全栈项目统一约定规范
 */

import { queryKeys } from '@/lib/queryKeys';
import type { ApiResponse, PaginatedResponse } from '@/lib/types/api';
import type {
  InboundCreateInput,
  Inventory,
  InventoryAdjustInput,
  InventoryAlert,
  InventoryQueryParams,
  OutboundCreateInput,
} from '@/lib/types/inventory';

/**
 * API基础URL
 */
const API_BASE = '/api/inventory';

/**
 * 导出兼容的查询键（使用集中管理的 queryKeys）
 */
export const inventoryQueryKeys = queryKeys.inventory;

/**
 * 获取库存列表
 */
export async function getInventories(
  params: InventoryQueryParams
): Promise<PaginatedResponse<Inventory>> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const response = await fetch(`${API_BASE}?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`获取库存列表失败: ${response.statusText}`);
  }

  const data: ApiResponse<PaginatedResponse<Inventory>> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '获取库存列表失败');
  }

  if (!data.data) {
    throw new Error('获取库存列表失败：数据为空');
  }

  return data.data;
}

/**
 * 获取库存详情
 */
export async function getInventory(productId: string): Promise<Inventory> {
  const response = await fetch(`${API_BASE}/${productId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('库存记录不存在');
    }
    throw new Error(`获取库存详情失败: ${response.statusText}`);
  }

  const data: ApiResponse<Inventory> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '获取库存详情失败');
  }

  if (!data.data) {
    throw new Error('获取库存详情失败：数据为空');
  }

  return data.data;
}

/**
 * 入库操作
 */
export async function createInbound(
  inboundData: InboundCreateInput
): Promise<Inventory> {
  const response = await fetch(`${API_BASE}/inbound`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(inboundData),
  });

  if (!response.ok) {
    throw new Error(`入库操作失败: ${response.statusText}`);
  }

  const data: ApiResponse<Inventory> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '入库操作失败');
  }

  if (!data.data) {
    throw new Error('入库操作失败：数据为空');
  }

  return data.data;
}

/**
 * 出库操作
 */
export async function createOutbound(
  outboundData: OutboundCreateInput
): Promise<Inventory> {
  const response = await fetch(`${API_BASE}/outbound`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(outboundData),
  });

  if (!response.ok) {
    throw new Error(`出库操作失败: ${response.statusText}`);
  }

  const data: ApiResponse<Inventory> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '出库操作失败');
  }

  if (!data.data) {
    throw new Error('出库操作失败：数据为空');
  }

  return data.data;
}

/**
 * 库存调整
 */
export async function adjustInventory(
  adjustData: InventoryAdjustInput
): Promise<Inventory> {
  const response = await fetch(`${API_BASE}/adjust`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(adjustData),
  });

  if (!response.ok) {
    throw new Error(`库存调整失败: ${response.statusText}`);
  }

  const data: ApiResponse<Inventory> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '库存调整失败');
  }

  if (!data.data) {
    throw new Error('库存调整失败：数据为空');
  }

  return data.data;
}

/**
 * 获取库存警报
 */
export async function getInventoryAlerts(): Promise<InventoryAlert[]> {
  const response = await fetch(`${API_BASE}/alerts`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`获取库存警报失败: ${response.statusText}`);
  }

  const data: ApiResponse<InventoryAlert[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '获取库存警报失败');
  }

  if (!data.data) {
    throw new Error('获取库存警报失败：数据为空');
  }

  return data.data;
}

/**
 * 检查库存可用性
 */
export async function checkInventoryAvailability(
  productId: string,
  quantity: number,
  colorCode?: string,
  productionDate?: string
): Promise<{ available: boolean; currentStock: number; message?: string }> {
  const response = await fetch(`${API_BASE}/check-availability`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId, quantity, colorCode, productionDate }),
  });

  if (!response.ok) {
    throw new Error(`检查库存可用性失败: ${response.statusText}`);
  }

  const data: ApiResponse<{
    available: boolean;
    currentStock: number;
    message?: string;
  }> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '检查库存可用性失败');
  }

  if (!data.data) {
    throw new Error('检查库存可用性失败：数据为空');
  }

  return data.data;
}

/**
 * 获取产品的批次库存信息
 */
export async function getProductBatches(
  productId: string,
  variantId?: string
): Promise<Inventory[]> {
  const params = new URLSearchParams({
    productId,
    includeVariants: 'true',
    limit: '100',
  });

  if (variantId) {
    params.append('variantId', variantId);
  }

  const response = await fetch(`${API_BASE}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`获取批次库存失败: ${response.statusText}`);
  }

  const data: ApiResponse<PaginatedResponse<Inventory>> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '获取批次库存失败');
  }

  if (!data.data) {
    throw new Error('获取批次库存失败：数据为空');
  }

  return data.data.data;
}

/**
 * 批次库存可用性检查
 */
export async function checkBatchAvailability(
  inventoryId: string,
  quantity: number
): Promise<{
  available: boolean;
  availableQuantity: number;
  message?: string;
}> {
  const response = await fetch(`${API_BASE}/batch-availability`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inventoryId, quantity }),
  });

  if (!response.ok) {
    throw new Error(`检查批次可用性失败: ${response.statusText}`);
  }

  const data: ApiResponse<{
    available: boolean;
    availableQuantity: number;
    message?: string;
  }> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '检查批次可用性失败');
  }

  if (!data.data) {
    throw new Error('检查批次可用性失败：数据为空');
  }

  return data.data;
}
