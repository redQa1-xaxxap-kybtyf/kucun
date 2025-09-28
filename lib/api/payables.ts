// 应付款管理API客户端
// 基于TanStack Query实现应付款记录CRUD、付款记录管理、应付款统计等API调用函数

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

// API基础URL
const PAYABLES_API_BASE = '/api/finance/payables';
const PAYMENTS_OUT_API_BASE = '/api/finance/payments-out';

// 查询键工厂
export const payableQueryKeys = {
  all: ['payables'] as const,
  lists: () => [...payableQueryKeys.all, 'list'] as const,
  list: (query: PayableRecordQuery) =>
    [...payableQueryKeys.lists(), query] as const,
  details: () => [...payableQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...payableQueryKeys.details(), id] as const,
  statistics: () => [...payableQueryKeys.all, 'statistics'] as const,
};

export const paymentOutQueryKeys = {
  all: ['payments-out'] as const,
  lists: () => [...paymentOutQueryKeys.all, 'list'] as const,
  list: (query: PaymentOutRecordQuery) =>
    [...paymentOutQueryKeys.lists(), query] as const,
  details: () => [...paymentOutQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentOutQueryKeys.details(), id] as const,
  byPayable: (payableId: string) =>
    [...paymentOutQueryKeys.all, 'by-payable', payableId] as const,
};

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
      throw new Error(`获取应付款记录失败: ${response.statusText}`);
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
      throw new Error(`获取应付款记录详情失败: ${response.statusText}`);
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
    const response = await fetch(PAYABLES_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`创建应付款记录失败: ${response.statusText}`);
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
    const response = await fetch(`${PAYABLES_API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`更新应付款记录失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '更新应付款记录失败');
    }

    return result.data;
  },

  deletePayableRecord: async (id: string): Promise<void> => {
    const response = await fetch(`${PAYABLES_API_BASE}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`删除应付款记录失败: ${response.statusText}`);
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
      throw new Error(`获取应付款统计失败: ${response.statusText}`);
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
      throw new Error(`获取付款记录失败: ${response.statusText}`);
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
      throw new Error(`获取付款记录详情失败: ${response.statusText}`);
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
    const response = await fetch(PAYMENTS_OUT_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`创建付款记录失败: ${response.statusText}`);
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
    const response = await fetch(`${PAYMENTS_OUT_API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`更新付款记录失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '更新付款记录失败');
    }

    return result.data;
  },

  deletePaymentOutRecord: async (id: string): Promise<void> => {
    const response = await fetch(`${PAYMENTS_OUT_API_BASE}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`删除付款记录失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '删除付款记录失败');
    }
  },
};

// React Query Hooks
export const usePayableRecords = (query: PayableRecordQuery) =>
  useQuery({
    queryKey: payableQueryKeys.list(query),
    queryFn: () => payablesApi.getPayableRecords(query),
    staleTime: 5 * 60 * 1000, // 5分钟
  });

export const usePayableRecord = (id: string) =>
  useQuery({
    queryKey: payableQueryKeys.detail(id),
    queryFn: () => payablesApi.getPayableRecord(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

export const usePayableStatistics = () =>
  useQuery({
    queryKey: payableQueryKeys.statistics(),
    queryFn: () => payablesApi.getPayableStatistics(),
    staleTime: 10 * 60 * 1000, // 10分钟
  });

export const usePaymentOutRecords = (query: PaymentOutRecordQuery) =>
  useQuery({
    queryKey: paymentOutQueryKeys.list(query),
    queryFn: () => payablesApi.getPaymentOutRecords(query),
    staleTime: 5 * 60 * 1000,
  });

export const usePaymentOutRecord = (id: string) =>
  useQuery({
    queryKey: paymentOutQueryKeys.detail(id),
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
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.statistics() });
    },
  });
};

export const useUpdatePayableRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePayableRecordData }) =>
      payablesApi.updatePayableRecord(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.statistics() });
    },
  });
};

export const useDeletePayableRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payablesApi.deletePayableRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.statistics() });
    },
  });
};

export const useCreatePaymentOutRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payablesApi.createPaymentOutRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentOutQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.statistics() });
    },
  });
};

export const useUpdatePaymentOutRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePaymentOutRecordData }) =>
      payablesApi.updatePaymentOutRecord(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: paymentOutQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: paymentOutQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.statistics() });
    },
  });
};

export const useDeletePaymentOutRecord = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: payablesApi.deletePaymentOutRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentOutQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.statistics() });
    },
  });
};
