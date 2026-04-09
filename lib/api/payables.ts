// 应付款管理API客户端
// 基于TanStack Query实现应付款记录CRUD、付款记录管理、应付款统计等API调用函数

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import type {
  CreatePayableRecordData,
  CreatePaymentOutRecordData,
  PayableRecordDetail,
  PayableRecordListResponse,
  PayableRecordQuery,
  PayableStatistics,
  PaymentOutRecordDetail,
  PaymentOutRecordListResponse,
  PaymentOutRecordQuery,
  UpdatePayableRecordData,
  UpdatePaymentOutRecordData,
} from '@/lib/types/payable';
import { csrfFetch } from '@/lib/utils/csrf';
import { createFriendlyApiError } from '@/lib/utils/user-friendly-error';

// API基础URL
const PAYABLES_API_BASE = '/api/finance/payables';
const PAYMENTS_OUT_API_BASE = '/api/finance/payments-out';

// API调用函数
export const payablesApi = {
  // 应付款记录相关
  getPayableRecords: async (
    query: PayableRecordQuery
  ): Promise<PayableRecordListResponse> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`${PAYABLES_API_BASE}?${params}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw await createFriendlyApiError(response, '获取应付款记录失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取应付款记录失败');
    }

    return result.data;
  },

  getPayableRecord: async (id: string): Promise<PayableRecordDetail> => {
    const response = await fetch(`${PAYABLES_API_BASE}/${id}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw await createFriendlyApiError(response, '获取应付款记录详情失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取应付款记录详情失败');
    }

    return result.data;
  },

  createPayableRecord: async (
    data: CreatePayableRecordData
  ): Promise<PayableRecordDetail> => {
    const response = await csrfFetch(PAYABLES_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw await createFriendlyApiError(response, '创建应付款记录失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '创建应付款记录失败');
    }

    return result.data;
  },

  updatePayableRecord: async (
    id: string,
    data: UpdatePayableRecordData
  ): Promise<PayableRecordDetail> => {
    const response = await csrfFetch(`${PAYABLES_API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw await createFriendlyApiError(response, '更新应付款记录失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '更新应付款记录失败');
    }

    return result.data;
  },

  deletePayableRecord: async (id: string): Promise<void> => {
    const response = await csrfFetch(`${PAYABLES_API_BASE}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw await createFriendlyApiError(response, '删除应付款记录失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '删除应付款记录失败');
    }
  },

  getPayableStatistics: async (): Promise<PayableStatistics> => {
    const response = await fetch(`${PAYABLES_API_BASE}/statistics`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw await createFriendlyApiError(response, '获取应付款统计失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取应付款统计失败');
    }

    return result.data;
  },

  // 付款记录相关
  getPaymentOutRecords: async (
    query: PaymentOutRecordQuery
  ): Promise<PaymentOutRecordListResponse> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`${PAYMENTS_OUT_API_BASE}?${params}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw await createFriendlyApiError(response, '获取付款记录失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取付款记录失败');
    }

    return result.data;
  },

  getPaymentOutRecord: async (id: string): Promise<PaymentOutRecordDetail> => {
    const response = await fetch(`${PAYMENTS_OUT_API_BASE}/${id}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw await createFriendlyApiError(response, '获取付款记录详情失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取付款记录详情失败');
    }

    return result.data;
  },

  createPaymentOutRecord: async (
    data: CreatePaymentOutRecordData
  ): Promise<PaymentOutRecordDetail> => {
    const response = await csrfFetch(PAYMENTS_OUT_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw await createFriendlyApiError(response, '创建付款记录失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '创建付款记录失败');
    }

    return result.data;
  },

  updatePaymentOutRecord: async (
    id: string,
    data: UpdatePaymentOutRecordData
  ): Promise<PaymentOutRecordDetail> => {
    const response = await csrfFetch(`${PAYMENTS_OUT_API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw await createFriendlyApiError(response, '更新付款记录失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '更新付款记录失败');
    }

    return result.data;
  },

  deletePaymentOutRecord: async (id: string): Promise<void> => {
    const response = await csrfFetch(`${PAYMENTS_OUT_API_BASE}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw await createFriendlyApiError(response, '删除付款记录失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '删除付款记录失败');
    }
  },
};

// React Query Hooks
export const usePayableRecords = (
  query: PayableRecordQuery,
  options?: {
    initialData?: PayableRecordListResponse;
  }
) =>
  useQuery({
    queryKey: queryKeys.payables.list(query),
    queryFn: () => payablesApi.getPayableRecords(query),
    staleTime: 5 * 60 * 1000, // 5分钟
    initialData: options?.initialData,
  });

export const usePayableRecord = (id: string) =>
  useQuery({
    queryKey: queryKeys.payables.detail(id),
    queryFn: () => payablesApi.getPayableRecord(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

export const usePayableStatistics = () =>
  useQuery({
    queryKey: queryKeys.payables.statistics(),
    queryFn: () => payablesApi.getPayableStatistics(),
    staleTime: 5 * 60 * 1000, // 5分钟（与全局策略一致）
  });

export const usePaymentOutRecords = (query: PaymentOutRecordQuery) =>
  useQuery({
    queryKey: queryKeys.paymentsOut.list(query),
    queryFn: () => payablesApi.getPaymentOutRecords(query),
    staleTime: 5 * 60 * 1000,
  });

export const usePaymentOutRecord = (id: string) =>
  useQuery({
    queryKey: queryKeys.paymentsOut.detail(id),
    queryFn: () => payablesApi.getPaymentOutRecord(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

// Mutation Hooks
export const useCreatePayableRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payablesApi.createPayableRecord,
    onSuccess: () => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建应付款后立即看到新记录
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.statistics(),
        type: 'active',
      });
    },
  });
};

export const useUpdatePayableRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePayableRecordData }) =>
      payablesApi.updatePayableRecord(id, data),
    onSuccess: (_, { id }) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新应付款后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.detail(id),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.statistics(),
        type: 'active',
      });
    },
  });
};

export const useDeletePayableRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payablesApi.deletePayableRecord,
    onSuccess: () => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户删除应付款后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.statistics(),
        type: 'active',
      });
    },
  });
};

export const useCreatePaymentOutRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payablesApi.createPaymentOutRecord,
    onSuccess: () => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建付款后立即看到新记录
      queryClient.refetchQueries({
        queryKey: queryKeys.paymentsOut.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.statistics(),
        type: 'active',
      });
    },
  });
};

export const useUpdatePaymentOutRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdatePaymentOutRecordData;
    }) => payablesApi.updatePaymentOutRecord(id, data),
    onSuccess: (_, { id }) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新付款后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.paymentsOut.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.paymentsOut.detail(id),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.statistics(),
        type: 'active',
      });
    },
  });
};

export const useDeletePaymentOutRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payablesApi.deletePaymentOutRecord,
    onSuccess: () => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户删除付款后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.paymentsOut.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payables.statistics(),
        type: 'active',
      });
    },
  });
};
