/**
 * 分类相关的API客户端函数
 * 严格遵循全栈项目统一约定规范
 *
 * 类型定义已迁移到 lib/types/category-unified.ts
 */

import type { ApiResponse, PaginatedResponse } from '@/lib/types/api';
import type {
  Category,
  CategorySummary,
  CategoryQueryParams,
  CreateCategoryData,
  UpdateCategoryData,
} from '@/lib/types/category-unified';

// 重新导出类型以保持向后兼容
export type {
  Category,
  CategorySummary,
  CategoryQueryParams,
  CreateCategoryData,
  UpdateCategoryData,
};

/**
 * 获取 API 基础 URL
 * 在服务器端使用绝对 URL，在客户端使用相对 URL
 */
function getApiBaseUrl(): string {
  // 服务器端环境
  if (typeof window === 'undefined') {
    // 优先使用环境变量中的 URL
    if (process.env.NEXTAUTH_URL) {
      return process.env.NEXTAUTH_URL;
    }
    // 开发环境默认使用 localhost:3000
    const port = process.env.PORT || 3000;
    return `http://localhost:${port}`;
  }
  // 客户端环境使用相对路径
  return '';
}

/**
 * 获取分类列表
 */
export async function getCategories(
  params: CategoryQueryParams = {}
): Promise<PaginatedResponse<Category>> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/categories?${searchParams.toString()}`
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

/**
 * 获取所有活跃分类选项（用于筛选器）
 */
export async function getCategoryOptions(): Promise<Category[]> {
  const response = await getCategories({
    limit: 100, // 获取所有分类（最大100个）
    sortBy: 'name',
    sortOrder: 'asc',
  });

  return response.data || [];
}

/**
 * TanStack Query 查询键
 */
export const categoryQueryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryQueryKeys.all, 'list'] as const,
  list: (params: CategoryQueryParams) =>
    [...categoryQueryKeys.lists(), params] as const,
  details: () => [...categoryQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...categoryQueryKeys.details(), id] as const,
  options: () => [...categoryQueryKeys.all, 'options'] as const,
};

/**
 * 获取单个分类详情
 */
export async function getCategory(id: string): Promise<ApiResponse<Category>> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/categories/${id}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

/**
 * 创建分类
 */
export async function createCategory(data: {
  name: string;
  code?: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}): Promise<ApiResponse<Category>> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/categories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

/**
 * 更新分类
 */
export async function updateCategory(data: {
  id: string;
  name?: string;
  code?: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}): Promise<ApiResponse<Category>> {
  const { id, ...updateData } = data;

  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/categories/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

/**
 * 删除分类
 */
export async function deleteCategory(id: string): Promise<ApiResponse<void>> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/categories/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}

/**
 * 更新分类状态
 */
export async function updateCategoryStatus(
  id: string,
  status: 'active' | 'inactive'
): Promise<ApiResponse<Category>> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/categories/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP error! status: ${response.status}`
    );
  }

  return response.json();
}
