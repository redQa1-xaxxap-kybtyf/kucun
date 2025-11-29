import type { ApiResponse, PaginatedResponse } from '@/lib/types/api';
import type {
  BatchDeleteSuppliersInput,
  BatchDeleteSuppliersResult,
  BatchUpdateSupplierStatusInput,
  BatchUpdateSupplierStatusResult,
  Supplier,
  SupplierCreateInput,
  SupplierQueryParams,
  SupplierUpdateInput,
} from '@/lib/types/supplier';
import { csrfFetch } from '@/lib/utils/csrf';

const API_BASE = '/api/suppliers';

function extractErrorMessage(
  errorData: unknown,
  fallbackMessage: string
): string {
  if (!errorData) {
    return fallbackMessage;
  }

  if (Array.isArray(errorData) && errorData.length > 0) {
    const first = errorData[0] as unknown;
    if (typeof first === 'string' && first.trim()) {
      return first;
    }
    if (
      first &&
      typeof first === 'object' &&
      typeof (first as Record<string, unknown>).message === 'string'
    ) {
      return (first as Record<string, unknown>).message as string;
    }
  }

  if (typeof errorData === 'string' && errorData.trim()) {
    return errorData;
  }

  if (typeof errorData === 'object') {
    const data = errorData as Record<string, unknown>;
    const nestedError = data.error;

    if (typeof nestedError === 'string' && nestedError.trim()) {
      return nestedError;
    }

    if (
      nestedError &&
      typeof nestedError === 'object' &&
      typeof (nestedError as Record<string, unknown>).message === 'string'
    ) {
      const nestedMessage = (nestedError as Record<string, unknown>)
        .message as string;
      if (nestedMessage.trim()) {
        return nestedMessage;
      }
    }

    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
  }

  return fallbackMessage;
}

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
  const response = await csrfFetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    const message = extractErrorMessage(
      errorData,
      `创建供应商失败: ${response.statusText}`
    );
    throw new Error(message);
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
  const response = await csrfFetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = extractErrorMessage(
      errorData,
      `更新供应商失败: ${response.statusText}`
    );
    throw new Error(message);
  }

  return response.json();
}

/**
 * 删除供应商
 */
export async function deleteSupplier(id: string): Promise<ApiResponse<void>> {
  const response = await csrfFetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = extractErrorMessage(
      errorData,
      `删除供应商失败: ${response.statusText}`
    );
    throw new Error(message);
  }

  return response.json();
}

/**
 * 批量删除供应商
 */
export async function batchDeleteSuppliers(
  data: BatchDeleteSuppliersInput
): Promise<BatchDeleteSuppliersResult> {
  const response = await csrfFetch(`${API_BASE}/batch`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = extractErrorMessage(
      errorData,
      `批量删除供应商失败: ${response.statusText}`
    );
    throw new Error(message);
  }

  return response.json();
}

/**
 * 批量更新供应商状态
 */
export async function batchUpdateSupplierStatus(
  data: BatchUpdateSupplierStatusInput
): Promise<BatchUpdateSupplierStatusResult> {
  const response = await csrfFetch(`${API_BASE}/batch/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = extractErrorMessage(
      errorData,
      `批量更新供应商状态失败: ${response.statusText}`
    );
    throw new Error(message);
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
