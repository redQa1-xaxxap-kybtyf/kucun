/**
 * 分类相关的API客户端函数
 * 严格遵循全栈项目统一约定规范
 */

import type { ApiResponse, PaginatedResponse } from '@/lib/types/api';

// 分类类型定义
export interface Category {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  
  // 关联数据
  parent?: Category;
  children?: Category[];
  productCount?: number;
}

// 分类查询参数
export interface CategoryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  parentId?: string;
  status?: 'active' | 'inactive';
  sortBy?: 'name' | 'code' | 'sortOrder' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// 创建分类数据
export interface CreateCategoryData {
  name: string;
  code?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
}

// 更新分类数据
export interface UpdateCategoryData extends Partial<CreateCategoryData> {
  id: string;
  status?: 'active' | 'inactive';
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

  const response = await fetch(`/api/categories?${searchParams.toString()}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * 获取单个分类详情
 */
export async function getCategory(id: string): Promise<ApiResponse<Category>> {
  const response = await fetch(`/api/categories/${id}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * 创建分类
 */
export async function createCategory(data: CreateCategoryData): Promise<ApiResponse<Category>> {
  const response = await fetch('/api/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * 更新分类
 */
export async function updateCategory(data: UpdateCategoryData): Promise<ApiResponse<Category>> {
  const { id, ...updateData } = data;
  
  const response = await fetch(`/api/categories/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * 删除分类
 */
export async function deleteCategory(id: string): Promise<ApiResponse<void>> {
  const response = await fetch(`/api/categories/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * 分类查询键工厂
 */
export const categoryQueryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryQueryKeys.all, 'list'] as const,
  list: (params: CategoryQueryParams) => [...categoryQueryKeys.lists(), params] as const,
  details: () => [...categoryQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...categoryQueryKeys.details(), id] as const,
};
