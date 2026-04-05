import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import type {
  BatchSpecification,
  BatchSpecificationListResponse,
  BatchSpecificationQueryParams,
  CreateBatchSpecificationRequest,
  UpdateBatchSpecificationRequest,
} from '@/lib/types/batch-specification';

const API_BASE = '/api/batch-specifications';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_SORT_BY: NonNullable<BatchSpecificationQueryParams['sortBy']> =
  'createdAt';
const DEFAULT_SORT_ORDER: NonNullable<
  BatchSpecificationQueryParams['sortOrder']
> = 'desc';

function buildQueryString(params: BatchSpecificationQueryParams = {}): string {
  const query = new URLSearchParams();

  const page = params.page ?? DEFAULT_PAGE;
  const limit = params.limit ?? DEFAULT_LIMIT;
  const sortBy = params.sortBy ?? DEFAULT_SORT_BY;
  const sortOrder = params.sortOrder ?? DEFAULT_SORT_ORDER;

  query.set('page', String(page));
  query.set('limit', String(limit));
  query.set('sortBy', sortBy);
  query.set('sortOrder', sortOrder);

  if (params.search) {
    query.set('search', params.search);
  }
  if (params.productId) {
    query.set('productId', params.productId);
  }
  if (params.variantId) {
    query.set('variantId', params.variantId);
  }
  if (params.batchNumber) {
    query.set('batchNumber', params.batchNumber);
  }

  return query.toString();
}

async function handleResponse<T>(
  response: Response,
  errorMessage: string
): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.error ?? payload?.message ?? response.statusText ?? errorMessage;
    throw new Error(message);
  }

  const payload = await response.json();
  if (payload?.success === false) {
    throw new Error(payload?.error || errorMessage);
  }
  return payload as T;
}

export async function fetchBatchSpecifications(
  params: BatchSpecificationQueryParams = {}
): Promise<BatchSpecificationListResponse> {
  const queryString = buildQueryString(params);
  const response = await fetch(
    queryString ? `${API_BASE}?${queryString}` : API_BASE,
    {
      credentials: 'include',
    }
  );
  return handleResponse<BatchSpecificationListResponse>(
    response,
    '获取批次规格参数失败'
  );
}

export async function createBatchSpecification(
  data: CreateBatchSpecificationRequest
): Promise<BatchSpecification> {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  const payload = await handleResponse<{
    success: boolean;
    data: BatchSpecification;
    message?: string;
  }>(response, '保存批次规格参数失败');

  return payload.data;
}

export async function updateBatchSpecification(
  id: string,
  data: UpdateBatchSpecificationRequest
): Promise<BatchSpecification> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  const payload = await handleResponse<{
    success: boolean;
    data: BatchSpecification;
    message?: string;
  }>(response, '更新批次规格参数失败');

  return payload.data;
}

export async function deleteBatchSpecification(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  await handleResponse<{ success: boolean; message?: string }>(
    response,
    '删除批次规格参数失败'
  );
}

export const batchSpecificationApi = {
  fetchList: fetchBatchSpecifications,
  create: createBatchSpecification,
  update: updateBatchSpecification,
  delete: deleteBatchSpecification,
};

export function useBatchSpecifications(
  params: BatchSpecificationQueryParams = {}
) {
  return useQuery({
    queryKey: queryKeys.inventory.batchSpecificationsList(params),
    queryFn: () => fetchBatchSpecifications(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateBatchSpecification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBatchSpecification,
    onSuccess: () => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建批量规格后立即看到新记录
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.batchSpecifications(),
        type: 'active',
      });
    },
  });
}

export function useUpdateBatchSpecification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateBatchSpecificationRequest;
    }) => updateBatchSpecification(id, data),
    onSuccess: result => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新批量规格后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.batchSpecifications(),
        type: 'active',
      });
      if (result?.id) {
        queryClient.refetchQueries({
          queryKey: queryKeys.inventory.batchSpecification(result.id),
          type: 'active',
        });
      }
    },
  });
}

export function useDeleteBatchSpecification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteBatchSpecification,
    onSuccess: () => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户删除批量规格后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.batchSpecifications(),
        type: 'active',
      });
    },
  });
}
