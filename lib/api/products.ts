/**
 * 产品API客户端
 * 严格遵循全栈项目统一约定规范
 */

import { queryKeys } from '@/lib/queryKeys';
import type { ApiResponse, PaginatedResponse } from '@/lib/types/api';
import type {
  Product,
  ProductImage,
  ProductQueryParams,
} from '@/lib/types/product';
import { csrfFetch } from '@/lib/utils/csrf';
import { createFriendlyApiError } from '@/lib/utils/user-friendly-error';
import type {
  ProductImageImportKind,
  ProductCreateFormData,
  ProductUpdateFormData,
} from '@/lib/validations/product';

export type ProductListQueryParams = ProductQueryParams & {
  includeInventory?: boolean;
  includeStatistics?: boolean;
  includeBatchSpecs?: boolean;
  includeImages?: boolean;
};

export interface ProductImportPreviewRow {
  row: number;
  code: string;
  name: string;
  specification: string;
  categoryName: string;
  thickness?: number;
  status: 'active' | 'inactive';
}

export interface ProductImportError {
  row: number;
  productCode?: string;
  field?: string;
  message: string;
}

export interface ProductImportDuplicate {
  row: number;
  productCode?: string;
  source: 'file' | 'system';
  message: string;
}

export interface ProductImportResult {
  valid: boolean;
  totalCount: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
  previewRows: ProductImportPreviewRow[];
  duplicates: ProductImportDuplicate[];
  errors: ProductImportError[];
  importedCount?: number;
  importedProducts?: Array<{
    id: string;
    code: string;
    name: string;
    specification?: string;
    status: 'active' | 'inactive';
  }>;
}

export interface ProductImageImportMatchInput {
  clientId: string;
  fileName: string;
  inferredCode: string;
  kind: ProductImageImportKind;
}

export interface ProductImageImportMatchItem
  extends ProductImageImportMatchInput {
  status: 'matched' | 'not_found';
  product: {
    id: string;
    code: string;
    name: string;
    specification: string | null;
    thumbnailUrl: string | null;
  } | null;
}

export interface ProductImageImportMatchResult {
  totalCount: number;
  matchedCount: number;
  unmatchedCount: number;
  items: ProductImageImportMatchItem[];
}

export interface ProductImageImportSaveInput {
  productId: string;
  thumbnailUrl?: string | null;
  appendImages?: ProductImage[];
}

export interface ProductImageImportSaveResult {
  totalCount: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    productId: string;
    status: 'success' | 'error';
    error?: string;
  }>;
}

const API_BASE = '/api/products';

/**
 * 导出兼容的查询键（使用集中管理的 queryKeys）
 */
export const productQueryKeys = queryKeys.products;

/**
 * 获取产品列表
 */
export async function getProducts(
  params: ProductListQueryParams = {},
  signal?: AbortSignal
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
    signal,
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '获取产品列表失败');
  }

  const apiResponse: ApiResponse<PaginatedResponse<Product>> =
    await response.json();

  if (!apiResponse.success || !apiResponse.data) {
    throw new Error(apiResponse.error || '获取产品列表失败');
  }

  return apiResponse.data;
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
    throw await createFriendlyApiError(response, '获取产品详情失败');
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
  productData: ProductCreateFormData
): Promise<Product> {
  const response = await csrfFetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 包含cookies以传递会话信息
    body: JSON.stringify(productData),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '创建产品失败');
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

function parseFilenameFromContentDisposition(headerValue: string | null) {
  if (!headerValue) {
    return '产品基础信息导入模板.xlsx';
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = headerValue.match(/filename="?([^"]+)"?/i);
  return asciiMatch?.[1] || '产品基础信息导入模板.xlsx';
}

export async function downloadProductImportTemplate(): Promise<{
  blob: Blob;
  filename: string;
}> {
  const response = await fetch(`${API_BASE}/import/template`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('下载导入模板失败');
  }

  return {
    blob: await response.blob(),
    filename: parseFilenameFromContentDisposition(
      response.headers.get('content-disposition')
    ),
  };
}

async function sendProductImportRequest(
  file: File,
  mode: 'dry-run' | 'import'
): Promise<ProductImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);

  const response = await csrfFetch(`${API_BASE}/import`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const body = (await response.json()) as ApiResponse<ProductImportResult>;

  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error || '产品导入失败');
  }

  return body.data;
}

export function previewProductImport(file: File) {
  return sendProductImportRequest(file, 'dry-run');
}

export function importProducts(file: File) {
  return sendProductImportRequest(file, 'import');
}

/**
 * 更新产品
 */
export async function updateProduct(
  id: string,
  productData: ProductUpdateFormData
): Promise<Product> {
  const response = await csrfFetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // 包含cookies以传递会话信息
    body: JSON.stringify(productData),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('产品不存在');
    }
    throw await createFriendlyApiError(response, '更新产品失败');
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
 * 快速更新产品缩略图
 */
export async function updateProductThumbnail(
  id: string,
  thumbnailUrl: string | null
): Promise<Product> {
  const response = await csrfFetch(`${API_BASE}/${id}/thumbnail`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ thumbnailUrl }),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('产品不存在');
    }
    throw await createFriendlyApiError(response, '更新缩略图失败');
  }

  const data: ApiResponse<Product> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '更新缩略图失败');
  }

  if (!data.data) {
    throw new Error('服务器返回数据为空');
  }

  return data.data;
}

export async function matchProductImagesForImport(
  items: ProductImageImportMatchInput[]
): Promise<ProductImageImportMatchResult> {
  const response = await csrfFetch(`${API_BASE}/image-import/match`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '图片匹配失败');
  }

  const data: ApiResponse<ProductImageImportMatchResult> =
    await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || '图片匹配失败');
  }

  return data.data;
}

export async function updateProductMedia(
  id: string,
  data: {
    thumbnailUrl?: string | null;
    appendImages?: ProductImage[];
  }
): Promise<Product> {
  const response = await csrfFetch(`${API_BASE}/${id}/images`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('产品不存在');
    }
    throw await createFriendlyApiError(response, '保存产品图片失败');
  }

  const body: ApiResponse<Product> = await response.json();

  if (!body.success || !body.data) {
    throw new Error(body.error || '保存产品图片失败');
  }

  return body.data;
}

export async function saveProductImagesForImport(
  items: ProductImageImportSaveInput[]
): Promise<ProductImageImportSaveResult> {
  const response = await csrfFetch(`${API_BASE}/image-import/save`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '批量保存产品图片失败');
  }

  const body: ApiResponse<ProductImageImportSaveResult> = await response.json();

  if (!body.success || !body.data) {
    throw new Error(body.error || '批量保存产品图片失败');
  }

  return body.data;
}

/**
 * 删除产品
 */
export async function deleteProduct(id: string): Promise<void> {
  const response = await csrfFetch(`${API_BASE}/${id}`, {
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
    throw await createFriendlyApiError(response, '删除产品失败');
  }

  const data: ApiResponse<void> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '删除产品失败');
  }
}

// 导出类型以供其他模块使用
export type {
  ProductImageImportKind,
  ProductCreateFormData,
  ProductUpdateFormData,
} from '@/lib/validations/product';
