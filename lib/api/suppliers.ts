import type { ApiResponse, PaginatedResponse } from '@/lib/types/api';
import type {
  Supplier,
  SupplierCreateInput,
  SupplierUpdateInput,
  SupplierQueryParams,
  BatchDeleteSuppliersInput,
  BatchDeleteSuppliersResult,
  BatchUpdateSupplierStatusInput,
  BatchUpdateSupplierStatusResult,
} from '@/lib/types/supplier';

const API_BASE = '/api/suppliers';

/**
 * 获取供应商列表
 */
export async function getSuppliers(
  params: SupplierQueryParams = {}
): Promise<PaginatedResponse<Supplier>> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const url = `${API_BASE}?${searchParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`获取供应商列表失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 获取单个供应商详情
 */
export async function getSupplier(id: string): Promise<ApiResponse<Supplier>> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    throw new Error(`获取供应商详情失败: ${response.statusText}`);
  }

  return response.json();
}

/**
 * 创建新供应商
 */
export async function createSupplier(
  data: SupplierCreateInput
): Promise<ApiResponse<Supplier>> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    // 处理 Zod 验证错误
    if (Array.isArray(errorData) && errorData[0]?.message) {
      throw new Error(errorData[0].message);
    }

    throw new Error(
      errorData.error || errorData.message || `创建供应商失败: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * 更新供应商信息
 */
export async function updateSupplier(
  id: string,
  data: SupplierUpdateInput
): Promise<ApiResponse<Supplier>> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `更新供应商失败: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * 删除供应商
 */
export async function deleteSupplier(id: string): Promise<ApiResponse<void>> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `删除供应商失败: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * 批量删除供应商
 */
export async function batchDeleteSuppliers(
  data: BatchDeleteSuppliersInput
): Promise<BatchDeleteSuppliersResult> {
  const response = await fetch(`${API_BASE}/batch`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `批量删除供应商失败: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * 批量更新供应商状态
 */
export async function batchUpdateSupplierStatus(
  data: BatchUpdateSupplierStatusInput
): Promise<BatchUpdateSupplierStatusResult> {
  const response = await fetch(`${API_BASE}/batch/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `批量更新供应商状态失败: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * 供应商查询键工厂
 */
export const supplierQueryKeys = {
  all: ['suppliers'] as const,
  lists: () => [...supplierQueryKeys.all, 'list'] as const,
  list: (params: SupplierQueryParams) =>
    [...supplierQueryKeys.lists(), params] as const,
  details: () => [...supplierQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierQueryKeys.details(), id] as const,
};
