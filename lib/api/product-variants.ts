/**
 * 产品变体API客户端
 * 严格遵循全栈项目统一约定规范
 */

import type { ApiResponse } from '@/lib/types/api';
// import type { PaginatedResponse } from '@/lib/types/api'; // 将在未来版本中使用
import type {
  ProductVariant,
  ProductVariantCreateInput,
  ProductVariantUpdateInput,
} from '@/lib/types/product';

const API_BASE = '/api/product-variants';

/**
 * 查询键工厂
 */
export const productVariantQueryKeys = {
  all: ['product-variants'] as const,
  lists: () => [...productVariantQueryKeys.all, 'list'] as const,
  list: (productId: string) =>
    [...productVariantQueryKeys.lists(), productId] as const,
  details: () => [...productVariantQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...productVariantQueryKeys.details(), id] as const,
};

/**
 * 获取产品的所有变体
 */
export async function getProductVariants(
  productId: string
): Promise<ProductVariant[]> {
  const response = await fetch(`${API_BASE}?productId=${productId}`);

  if (!response.ok) {
    throw new Error(`获取产品变体失败: ${response.statusText}`);
  }

  const data: ApiResponse<ProductVariant[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '获取产品变体失败');
  }

  return data.data!;
}

/**
 * 获取单个产品变体详情
 */
export async function getProductVariant(id: string): Promise<ProductVariant> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    throw new Error(`获取产品变体详情失败: ${response.statusText}`);
  }

  const data: ApiResponse<ProductVariant> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '获取产品变体详情失败');
  }

  return data.data!;
}

/**
 * 创建产品变体
 */
export async function createProductVariant(
  productId: string,
  input: ProductVariantCreateInput
): Promise<ProductVariant> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId, ...input }),
  });

  if (!response.ok) {
    throw new Error(`创建产品变体失败: ${response.statusText}`);
  }

  const data: ApiResponse<ProductVariant> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '创建产品变体失败');
  }

  return data.data!;
}

/**
 * 更新产品变体
 */
export async function updateProductVariant(
  input: ProductVariantUpdateInput
): Promise<ProductVariant> {
  const response = await fetch(`${API_BASE}/${input.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`更新产品变体失败: ${response.statusText}`);
  }

  const data: ApiResponse<ProductVariant> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '更新产品变体失败');
  }

  return data.data!;
}

/**
 * 删除产品变体
 */
export async function deleteProductVariant(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`删除产品变体失败: ${response.statusText}`);
  }

  const data: ApiResponse<void> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '删除产品变体失败');
  }
}

/**
 * 批量创建产品变体
 */
export async function batchCreateProductVariants(
  productId: string,
  variants: ProductVariantCreateInput[]
): Promise<ProductVariant[]> {
  const response = await fetch(`${API_BASE}/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productId, variants }),
  });

  if (!response.ok) {
    throw new Error(`批量创建产品变体失败: ${response.statusText}`);
  }

  const data: ApiResponse<ProductVariant[]> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '批量创建产品变体失败');
  }

  return data.data!;
}

/**
 * 生成SKU
 */
export async function generateSKU(
  productCode: string,
  colorCode: string
): Promise<string> {
  const response = await fetch(`${API_BASE}/generate-sku`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productCode, colorCode }),
  });

  if (!response.ok) {
    throw new Error(`生成SKU失败: ${response.statusText}`);
  }

  const data: ApiResponse<{ sku: string }> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '生成SKU失败');
  }

  return data.data!.sku;
}

/**
 * 检查SKU是否可用
 */
export async function checkSKUAvailability(
  sku: string,
  excludeId?: string
): Promise<boolean> {
  const params = new URLSearchParams({ sku });
  if (excludeId) {
    params.append('excludeId', excludeId);
  }

  const response = await fetch(`${API_BASE}/check-sku?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`检查SKU可用性失败: ${response.statusText}`);
  }

  const data: ApiResponse<{ available: boolean }> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '检查SKU可用性失败');
  }

  return data.data!.available;
}

/**
 * 获取产品变体的库存汇总
 */
export async function getVariantInventorySummary(variantId: string): Promise<{
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  locations: Array<{
    location: string;
    quantity: number;
  }>;
}> {
  const response = await fetch(`${API_BASE}/${variantId}/inventory-summary`);

  if (!response.ok) {
    throw new Error(`获取变体库存汇总失败: ${response.statusText}`);
  }

  const data: ApiResponse<{
    totalQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    locations: Array<{
      location: string;
      quantity: number;
    }>;
  }> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '获取变体库存汇总失败');
  }

  return data.data!;
}
