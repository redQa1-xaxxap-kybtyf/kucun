/**
 * 产品API客户端
 * 严格遵循全栈项目统一约定规范
 */

import type { UpdateProductData } from '@/lib/schemas/product';
import type { ApiResponse, PaginatedResponse } from '@/lib/types/api';
import type {
  BatchDeleteProductsInput,
  BatchDeleteResult,
  Product,
  ProductCreateInput,
  ProductQueryParams,
} from '@/lib/types/product';

const API_BASE = '/api/products';

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
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 包含cookies以传递会话信息
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

  if (!data.data) {
    throw new Error('服务器返回数据为空');
  }

  return data.data;
}

/**
 * 创建产品
 */
export async function createProduct(
  productData: ProductCreateInput
): Promise<Product> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 包含cookies以传递会话信息
    body: JSON.stringify(productData),
  });

  if (!response.ok) {
    throw new Error(`创建产品失败: ${response.statusText}`);
  }

  const data: ApiResponse<Product> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '创建产品失败');
  }

  if (!data.data) {
    throw new Error('服务器返回数据为空');
  }

  return data.data;
}

/**
 * 更新产品
 */
export async function updateProduct(
  id: string,
  productData: UpdateProductData
): Promise<Product> {
  // 确保包含id字段用于后端验证
  const dataWithId = {
    id,
    ...productData,
  };

  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 包含cookies以传递会话信息
    body: JSON.stringify(dataWithId),
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

  if (!data.data) {
    throw new Error('服务器返回数据为空');
  }

  return data.data;
}

/**
 * 删除产品
 */
export async function deleteProduct(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 包含cookies以传递会话信息
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
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 包含cookies以传递会话信息
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`批量删除产品失败: ${response.statusText}`);
  }

  const data: ApiResponse<BatchDeleteResult> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '批量删除产品失败');
  }

  if (!data.data) {
    throw new Error('服务器返回数据为空');
  }

  return data.data;
}

// 导出类型以供其他模块使用
export type {
  CreateProductData,
  UpdateProductData,
} from '@/lib/schemas/product';
