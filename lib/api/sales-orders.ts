/**
 * 销售订单API
 * 严格遵循全栈项目统一约定规范
 */

import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import type { ApiResponse, PaginatedResponse } from '@/lib/types/api';
import type {
  SalesOrder,
  SalesOrderCreateInput,
  SalesOrderQueryParams,
  SalesOrderStats,
  SalesOrderStatus,
  SalesOrderUpdateInput,
} from '@/lib/types/sales-order';
import { csrfFetch } from '@/lib/utils/csrf';
import { createFriendlyApiError } from '@/lib/utils/user-friendly-error';

/**
 * API基础URL
 */
const API_BASE = '/api/sales-orders';

/**
 * 查询键工厂
 */
export const salesOrderQueryKeys = {
  all: ['sales-orders'] as const,
  lists: () => [...salesOrderQueryKeys.all, 'list'] as const,
  list: (params: SalesOrderQueryParams) =>
    [...salesOrderQueryKeys.lists(), params] as const,
  details: () => [...salesOrderQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...salesOrderQueryKeys.details(), id] as const,
  statistics: () => [...salesOrderQueryKeys.all, 'statistics'] as const,
  customer: (customerId: string) =>
    [...salesOrderQueryKeys.all, 'customer', customerId] as const,
};

export interface SalesOrderImportPreviewRow {
  row: number;
  importOrderNo: string;
  customerName: string;
  orderDate: string;
  productCode: string;
  productName: string;
  specification: string;
  displayUnit: '片' | '件';
  displayQuantity: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  orderRemarks?: string;
  itemRemarks?: string;
}

export interface SalesOrderImportError {
  row: number;
  importOrderNo?: string;
  productCode?: string;
  field?: string;
  message: string;
}

export interface SalesOrderImportDuplicate {
  row: number;
  importOrderNo: string;
  source: 'system';
  existingOrderNumber?: string;
  message: string;
}

export interface SalesOrderImportResult {
  valid: boolean;
  totalRowCount: number;
  totalOrderCount: number;
  validOrderCount: number;
  autoCreateCustomerNames: string[];
  duplicateOrderCount: number;
  errorCount: number;
  previewRows: SalesOrderImportPreviewRow[];
  duplicates: SalesOrderImportDuplicate[];
  errors: SalesOrderImportError[];
  importedCount?: number;
  importedOrders?: Array<{
    id: string;
    orderNumber: string;
    importOrderNo: string;
    customerName: string;
    totalAmount: number;
  }>;
}

export type SalesOrderImportTargetStatus = 'confirmed' | 'shipped';

export interface SalesOrderImportRequestOptions {
  shippedDate?: string;
  targetStatus?: SalesOrderImportTargetStatus;
}

/**
 * 获取销售订单列表
 */
export async function getSalesOrders(
  params: SalesOrderQueryParams
): Promise<PaginatedResponse<SalesOrder>> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const response = await fetch(`${API_BASE}?${searchParams.toString()}`);

  if (!response.ok) {
    throw await createFriendlyApiError(response, '获取销售订单列表失败');
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || '获取销售订单列表失败');
  }

  // API路由返回的数据结构是 { success: true, data: { data: [...], pagination: {...} } }
  // handler返回的 { data, pagination } 被 successResponse 包装
  return {
    data: result.data.data,
    pagination: result.data.pagination,
  };
}

/**
 * 获取销售订单详情
 */
export async function getSalesOrder(id: string): Promise<SalesOrder> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('销售订单不存在');
    }
    throw await createFriendlyApiError(response, '获取销售订单详情失败');
  }

  const data: ApiResponse<SalesOrder> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '获取销售订单详情失败');
  }

  if (!data.data) {
    throw new Error('获取销售订单失败：数据为空');
  }
  return data.data;
}

/**
 * 创建销售订单
 */
export async function createSalesOrder(
  orderData: SalesOrderCreateInput
): Promise<SalesOrder> {
  const response = await csrfFetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderData),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '创建销售订单失败');
  }

  const data: ApiResponse<SalesOrder> = await response.json();

  if (!data.success) {
    throw new Error(data.error || '创建销售订单失败');
  }

  if (!data.data) {
    throw new Error('创建销售订单失败：数据为空');
  }
  return data.data;
}

function parseFilenameFromContentDisposition(headerValue: string | null) {
  if (!headerValue) {
    return '销售记录导入模板.xlsx';
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = headerValue.match(/filename="?([^"]+)"?/i);
  return asciiMatch?.[1] || '销售记录导入模板.xlsx';
}

export async function downloadSalesOrderImportTemplate(): Promise<{
  blob: Blob;
  filename: string;
}> {
  const response = await fetch(`${API_BASE}/import/template`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('下载销售记录导入模板失败');
  }

  return {
    blob: await response.blob(),
    filename: parseFilenameFromContentDisposition(
      response.headers.get('content-disposition')
    ),
  };
}

async function sendSalesOrderImportRequest(
  file: File,
  mode: 'dry-run' | 'import',
  options: SalesOrderImportRequestOptions = {}
): Promise<SalesOrderImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);
  formData.append(
    'targetStatus',
    options.targetStatus === 'shipped' ? 'shipped' : 'confirmed'
  );

  if (options.shippedDate?.trim()) {
    formData.append('shippedDate', options.shippedDate.trim());
  }

  const response = await csrfFetch(`${API_BASE}/import`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const body = (await response.json()) as ApiResponse<SalesOrderImportResult>;

  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error || '销售记录导入失败');
  }

  return body.data;
}

export function previewSalesOrderImport(
  file: File,
  options: SalesOrderImportRequestOptions = {}
) {
  return sendSalesOrderImportRequest(file, 'dry-run', options);
}

export function importSalesOrders(
  file: File,
  options: SalesOrderImportRequestOptions = {}
) {
  return sendSalesOrderImportRequest(file, 'import', options);
}

// 更新销售订单
export async function updateSalesOrder(
  data: SalesOrderUpdateInput
): Promise<ApiResponse<SalesOrder>> {
  const { id, ...updateData } = data;

  const response = await csrfFetch(`${API_BASE}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '更新销售订单失败');
  }

  return response.json();
}

// 删除销售订单
export async function deleteSalesOrder(
  id: string
): Promise<ApiResponse<{ id: string }>> {
  const response = await csrfFetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '删除销售订单失败');
  }

  return response.json();
}

// 更新订单状态
export async function updateSalesOrderStatus(payload: {
  id: string;
  status: SalesOrderStatus;
  remarks?: string;
  idempotencyKey: string;
}): Promise<ApiResponse<SalesOrder>> {
  const { id, ...body } = payload;
  const response = await csrfFetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '更新订单状态失败');
  }

  return response.json();
}

// 获取销售订单统计信息
export async function getSalesOrderStats(params?: {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  userId?: string;
}): Promise<ApiResponse<SalesOrderStats>> {
  const searchParams = new URLSearchParams();

  if (params?.startDate) {
    searchParams.set('startDate', params.startDate);
  }
  if (params?.endDate) {
    searchParams.set('endDate', params.endDate);
  }
  if (params?.customerId) {
    searchParams.set('customerId', params.customerId);
  }
  if (params?.userId) {
    searchParams.set('userId', params.userId);
  }

  const url = `${API_BASE}/stats?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '获取销售订单统计失败');
  }

  return response.json();
}

// 获取客户的历史订单
export async function getCustomerOrders(
  customerId: string,
  params?: { limit?: number; status?: SalesOrderStatus }
): Promise<ApiResponse<SalesOrder[]>> {
  const searchParams = new URLSearchParams();
  searchParams.set('customerId', customerId);

  if (params?.limit) {
    searchParams.set('limit', params.limit.toString());
  }
  if (params?.status) {
    searchParams.set('status', params.status);
  }

  const url = `${API_BASE}?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '获取客户历史订单失败');
  }

  const result = await response.json();
  return {
    success: result.success,
    data: result.data.salesOrders,
    message: result.message,
  };
}

// 复制订单
export async function copySalesOrder(
  id: string
): Promise<ApiResponse<SalesOrder>> {
  const response = await csrfFetch(`${API_BASE}/${id}/copy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '复制销售订单失败');
  }

  return response.json();
}

// 批量更新订单状态
export async function batchUpdateSalesOrderStatus(
  ids: string[],
  status: SalesOrderStatus,
  remarks?: string
): Promise<ApiResponse<{ updated: number; failed: string[] }>> {
  const response = await csrfFetch(`${API_BASE}/batch/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids, status, remarks }),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '批量更新订单状态失败');
  }

  return response.json();
}

// 批量删除订单
export async function batchDeleteSalesOrders(
  ids: string[]
): Promise<ApiResponse<{ deleted: number; failed: string[] }>> {
  const response = await csrfFetch(`${API_BASE}/batch`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '批量删除订单失败');
  }

  return response.json();
}

// 导出订单数据
export async function exportSalesOrders(
  params: SalesOrderQueryParams = {}
): Promise<Blob> {
  const searchParams = new URLSearchParams();

  // 构建查询参数
  if (params.search) {
    searchParams.set('search', params.search);
  }
  if (params.status) {
    searchParams.set('status', params.status);
  }
  if (params.customerId) {
    searchParams.set('customerId', params.customerId);
  }
  if (params.userId) {
    searchParams.set('userId', params.userId);
  }
  if (params.startDate) {
    searchParams.set('startDate', params.startDate);
  }
  if (params.endDate) {
    searchParams.set('endDate', params.endDate);
  }

  const url = `${API_BASE}/export?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '导出销售订单失败');
  }

  return response.blob();
}

// 获取订单打印数据
export async function getSalesOrderPrintData(id: string): Promise<
  ApiResponse<{
    order: SalesOrder;
    printTemplate: string;
  }>
> {
  const response = await fetch(`${API_BASE}/${id}/print`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw await createFriendlyApiError(response, '获取销售订单打印数据失败');
  }

  return response.json();
}

// ============================================================================
// TanStack Query Mutation Hooks
// ============================================================================

/**
 * 创建销售订单 Mutation Hook
 */
export function useCreateSalesOrder(
  options?: UseMutationOptions<
    SalesOrder,
    Error,
    SalesOrderCreateInput,
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSalesOrder,
    onSuccess: () => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all,
      });
    },
    ...options,
  });
}

/**
 * 更新销售订单 Mutation Hook
 */
export function useUpdateSalesOrder(
  options?: UseMutationOptions<
    ApiResponse<SalesOrder>,
    Error,
    SalesOrderUpdateInput,
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSalesOrder,
    onSuccess: (_, { id }) => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.detail(id),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all,
      });
    },
    ...options,
  });
}

/**
 * 删除销售订单 Mutation Hook
 */
export function useDeleteSalesOrder(
  options?: UseMutationOptions<
    ApiResponse<{ id: string }>,
    Error,
    string,
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSalesOrder,
    onSuccess: (_, id) => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // 移除详情缓存
      queryClient.removeQueries({
        queryKey: salesOrderQueryKeys.detail(id),
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all,
      });
    },
    ...options,
  });
}

/**
 * 更新销售订单状态 Mutation Hook
 */
export function useUpdateSalesOrderStatus(
  options?: UseMutationOptions<
    ApiResponse<SalesOrder>,
    Error,
    {
      id: string;
      status: SalesOrderStatus;
      remarks?: string;
      idempotencyKey: string;
    },
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSalesOrderStatus,
    // 先应用外部传入的配置（可能包含 onError、retry 等）
    ...options,
    // 统一的成功处理：先做内部缓存刷新，再调用外部传入的 onSuccess
    onSuccess: (data, variables, onMutateResult, context) => {
      const { id } = variables;

      // 先将销售订单相关缓存整体标记为过期，避免返回列表时读到旧状态。
      queryClient.invalidateQueries({
        queryKey: salesOrderQueryKeys.all,
      });

      // 立即刷新当前模块缓存（详情、列表、统计）。
      // 列表需要覆盖 inactive 缓存，因为用户常从详情页返回列表。
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.detail(id),
        type: 'all',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'all',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'all',
      });

      // 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all,
      });

      // 调用外部自定义 onSuccess（如果有）
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    // 其它配置（onError / onSettled / retry 等）保持由外部传入
  });
}

/**
 * 复制销售订单 Mutation Hook
 */
export function useCopySalesOrder(
  options?: UseMutationOptions<ApiResponse<SalesOrder>, Error, string, unknown>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: copySalesOrder,
    onSuccess: () => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all,
      });
    },
    ...options,
  });
}

/**
 * 批量更新销售订单状态 Mutation Hook
 */
export function useBatchUpdateSalesOrderStatus(
  options?: UseMutationOptions<
    ApiResponse<{ updated: number; failed: string[] }>,
    Error,
    { ids: string[]; status: SalesOrderStatus; remarks?: string },
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, status, remarks }) =>
      batchUpdateSalesOrderStatus(ids, status, remarks),
    onSuccess: () => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all,
      });
    },
    ...options,
  });
}

/**
 * 批量删除销售订单 Mutation Hook
 */
export function useBatchDeleteSalesOrders(
  options?: UseMutationOptions<
    ApiResponse<{ deleted: number; failed: string[] }>,
    Error,
    string[],
    unknown
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: batchDeleteSalesOrders,
    onSuccess: () => {
      // ✅ 立即刷新当前模块缓存
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'active',
      });

      // ✅ 延迟刷新跨模块缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.all,
      });
    },
    ...options,
  });
}
