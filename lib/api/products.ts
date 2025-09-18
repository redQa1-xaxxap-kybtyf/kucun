/**
 * 产品API客户端
 * 严格遵循全栈项目统一约定规范
 */

import type { ApiResponse, PaginatedResponse } from '@/lib/types/api';
import type {
  BatchDeleteProductsInput,
  BatchDeleteResult,
  Product,
  ProductCreateInput,
  ProductQueryParams,
  ProductUpdateInput,
} from '@/lib/types/product';

const API_BASE = '/api/products';

/**
 * 统一API配置
 */
const API_CONFIG = {
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include' as RequestCredentials,
};

/**
 * 查询键工厂
 */
export const productQueryKeys = {
  all: ['products'] as const,
  lists: () => [...productQueryKeys.all, 'list'] as const,
  list: (params: ProductQueryParams) =>
    [...productQueryKeys.lists(), params] as const,
  details: () => [...productQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...productQueryKeys.details(), id] as const,
};

/**
 * 获取产品列表
 */
export async function getProducts(
  params: ProductQueryParams = {}
): Promise<PaginatedResponse<Product>> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const url = `${API_BASE}?${searchParams.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    ...API_CONFIG,
  });

  if (!response.ok) {
    throw new Error(`获取产品列表失败: ${response.statusText}`);
  }

  const data: PaginatedResponse<Product> = await response.json();

  return data;
}

/**
 * 获取产品详情
 */
export async function getProduct(id: string): Promise<Product> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 包含cookies以传递会话信息
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('产品不存在');
    }
    throw new Error(`获取产品详情失败: ${response.statusText}`);
  }

  const data: ApiResponse<Product> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '获取产品详情失败');
  }

  return data.data!;
}

/**
 * 创建产品
 */
export async function createProduct(
  productData: ProductCreateInput
): Promise<Product> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    ...API_CONFIG,
    body: JSON.stringify(productData),
  });

  if (!response.ok) {
    throw new Error(`创建产品失败: ${response.statusText}`);
  }

  const data: ApiResponse<Product> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '创建产品失败');
  }

  return data.data!;
}

/**
 * 更新产品
 */
export async function updateProduct(
  id: string,
  productData: ProductUpdateInput
): Promise<Product> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    ...API_CONFIG,
    body: JSON.stringify(productData),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('产品不存在');
    }
    throw new Error(`更新产品失败: ${response.statusText}`);
  }

  const data: ApiResponse<Product> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '更新产品失败');
  }

  return data.data!;
}

/**
 * 删除产品
 */
export async function deleteProduct(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    ...API_CONFIG,
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('产品不存在');
    }
    throw new Error(`删除产品失败: ${response.statusText}`);
  }

  const data: ApiResponse<void> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '删除产品失败');
  }
}

/**
 * 批量删除产品
 */
export async function batchDeleteProducts(
  input: BatchDeleteProductsInput
): Promise<BatchDeleteResult> {
  const response = await fetch(`${API_BASE}/batch`, {
    method: 'DELETE',
    ...API_CONFIG,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`批量删除产品失败: ${response.statusText}`);
  }

  const data: ApiResponse<BatchDeleteResult> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '批量删除产品失败');
  }

  return data.data!;
}
