// 收款管理API客户端
// 基于TanStack Query实现收款记录CRUD、应收账款查询、收款统计等API调用函数

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import type {
  AccountsReceivableQuery,
  AccountsReceivableResponse,
  CreatePaymentRecordData,
  PaymentMethod,
  PaymentRecord,
  PaymentRecordDetail,
  PaymentRecordListResponse,
  PaymentRecordQuery,
  PaymentRecordResponse,
  PaymentStatisticsResponse,
  PaymentStatus,
  UpdatePaymentRecordData,
} from '@/lib/types/payment';
import { formatCurrency as formatCurrencyValue } from '@/lib/utils';
import { csrfFetch } from '@/lib/utils/csrf';
import { formatTimeAgo } from '@/lib/utils/datetime';
import { createFriendlyApiError } from '@/lib/utils/user-friendly-error';

// API基础URL
const API_BASE = '/api/payments';

interface PaymentStatisticsQuery {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  paymentMethod?: PaymentMethod;
  groupBy?: string;
}

// API调用函数
export const paymentsApi = {
  // 获取收款记录列表
  getPaymentRecords: async (
    query: PaymentRecordQuery
  ): Promise<PaymentRecordListResponse['data']> => {
    const params = new URLSearchParams();

    if (query.page) {
      params.append('page', query.page.toString());
    }
    // ✅ P0修复: 统一使用 limit 参数，与后端保持一致
    if (query.pageSize) {
      params.append('limit', query.pageSize.toString());
    }
    if (query.search) {
      params.append('search', query.search);
    }
    if (query.customerId) {
      params.append('customerId', query.customerId);
    }
    if (query.userId) {
      params.append('userId', query.userId);
    }
    if (query.paymentMethod) {
      params.append('paymentMethod', query.paymentMethod);
    }
    if (query.status) {
      params.append('status', query.status);
    }
    if (query.startDate) {
      params.append('startDate', query.startDate);
    }
    if (query.endDate) {
      params.append('endDate', query.endDate);
    }
    if (query.sortBy) {
      params.append('sortBy', query.sortBy);
    }
    if (query.sortOrder) {
      params.append('sortOrder', query.sortOrder);
    }

    const response = await fetch(`${API_BASE}?${params}`);
    if (!response.ok) {
      throw await createFriendlyApiError(response, '获取收款记录失败');
    }

    const result: PaymentRecordListResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取收款记录失败');
    }

    return result.data;
  },

  // 获取收款记录详情
  getPaymentRecord: async (id: string): Promise<PaymentRecordDetail> => {
    const response = await fetch(`${API_BASE}/${id}`);
    if (!response.ok) {
      throw await createFriendlyApiError(response, '获取收款记录详情失败');
    }

    const result: PaymentRecordResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取收款记录详情失败');
    }

    return result.data as PaymentRecordDetail;
  },

  // 创建收款记录
  createPaymentRecord: async (
    data: CreatePaymentRecordData
  ): Promise<PaymentRecord> => {
    const response = await csrfFetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw await createFriendlyApiError(response, '创建收款记录失败');
    }

    const result: PaymentRecordResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || '创建收款记录失败');
    }

    return result.data;
  },

  // 更新收款记录
  updatePaymentRecord: async (
    id: string,
    data: UpdatePaymentRecordData
  ): Promise<PaymentRecord> => {
    const response = await csrfFetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw await createFriendlyApiError(response, '更新收款记录失败');
    }

    const result: PaymentRecordResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || '更新收款记录失败');
    }

    return result.data;
  },

  // 删除收款记录
  deletePaymentRecord: async (id: string): Promise<void> => {
    const response = await csrfFetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw await createFriendlyApiError(response, '删除收款记录失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '删除收款记录失败');
    }
  },

  // 确认收款
  confirmPayment: async (
    id: string,
    notes?: string
  ): Promise<PaymentRecord> => {
    const response = await csrfFetch(`${API_BASE}/${id}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      throw await createFriendlyApiError(response, '确认收款失败');
    }

    const result: PaymentRecordResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || '确认收款失败');
    }

    return result.data;
  },

  // 取消收款
  cancelPayment: async (id: string, notes?: string): Promise<PaymentRecord> => {
    const response = await csrfFetch(`${API_BASE}/${id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      throw await createFriendlyApiError(response, '取消收款失败');
    }

    const result: PaymentRecordResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || '取消收款失败');
    }

    return result.data;
  },

  // 获取应收账款
  getAccountsReceivable: async (
    query: AccountsReceivableQuery
  ): Promise<AccountsReceivableResponse['data']> => {
    const params = new URLSearchParams();

    if (query.page) {
      params.append('page', query.page.toString());
    }
    if (query.pageSize) {
      params.append('pageSize', query.pageSize.toString());
    }
    if (query.search) {
      params.append('search', query.search);
    }
    if (query.customerId) {
      params.append('customerId', query.customerId);
    }
    if (query.paymentStatus) {
      params.append('paymentStatus', query.paymentStatus);
    }
    if (query.startDate) {
      params.append('startDate', query.startDate);
    }
    if (query.endDate) {
      params.append('endDate', query.endDate);
    }
    if (query.sortBy) {
      params.append('sortBy', query.sortBy);
    }
    if (query.sortOrder) {
      params.append('sortOrder', query.sortOrder);
    }

    const response = await fetch(`${API_BASE}/accounts-receivable?${params}`);
    if (!response.ok) {
      throw await createFriendlyApiError(response, '获取应收账款失败');
    }

    const result: AccountsReceivableResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取应收账款失败');
    }

    return result.data;
  },

  // 获取收款统计
  getPaymentStatistics: async (
    query: PaymentStatisticsQuery = {}
  ): Promise<PaymentStatisticsResponse['data']> => {
    const params = new URLSearchParams();

    if (query.startDate) {
      params.append('startDate', query.startDate);
    }
    if (query.endDate) {
      params.append('endDate', query.endDate);
    }
    if (query.customerId) {
      params.append('customerId', query.customerId);
    }
    if (query.paymentMethod) {
      params.append('paymentMethod', query.paymentMethod);
    }
    if (query.groupBy) {
      params.append('groupBy', query.groupBy);
    }

    const response = await fetch(`${API_BASE}/statistics?${params}`);
    if (!response.ok) {
      throw await createFriendlyApiError(response, '获取收款统计失败');
    }

    const result: PaymentStatisticsResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取收款统计失败');
    }

    return result.data;
  },

  // 获取销售订单的收款记录
  getSalesOrderPayments: async (
    salesOrderId: string
  ): Promise<PaymentRecordDetail[]> => {
    const response = await fetch(`${API_BASE}/sales-order/${salesOrderId}`);
    if (!response.ok) {
      throw await createFriendlyApiError(response, '获取销售订单收款记录失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取销售订单收款记录失败');
    }

    return result.data;
  },

  // 获取客户的收款记录
  getCustomerPayments: async (
    customerId: string
  ): Promise<PaymentRecordDetail[]> => {
    const response = await fetch(`${API_BASE}/customer/${customerId}`);
    if (!response.ok) {
      throw await createFriendlyApiError(response, '获取客户收款记录失败');
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取客户收款记录失败');
    }

    return result.data;
  },
};

// React Query Hooks
export const usePaymentRecords = (query: PaymentRecordQuery) =>
  useQuery({
    queryKey: queryKeys.payments.list(query),
    queryFn: () => paymentsApi.getPaymentRecords(query),
    staleTime: 5 * 60 * 1000, // 5分钟
  });

export const usePaymentRecord = (id: string) =>
  useQuery({
    queryKey: queryKeys.payments.detail(id),
    queryFn: () => paymentsApi.getPaymentRecord(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

export const useAccountsReceivable = (query: AccountsReceivableQuery) =>
  useQuery({
    queryKey: queryKeys.payments.accountsReceivableList(query),
    queryFn: () => paymentsApi.getAccountsReceivable(query),
    staleTime: 5 * 60 * 1000,
  });

export const usePaymentStatistics = (query: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: queryKeys.payments.statisticsData(query),
    queryFn: () => paymentsApi.getPaymentStatistics(query),
    staleTime: 5 * 60 * 1000, // 5分钟（与全局策略一致）
  });

export const useSalesOrderPayments = (salesOrderId: string) =>
  useQuery({
    queryKey: queryKeys.payments.salesOrderPayments(salesOrderId),
    queryFn: () => paymentsApi.getSalesOrderPayments(salesOrderId),
    enabled: !!salesOrderId,
    staleTime: 5 * 60 * 1000,
  });

export const useCustomerPayments = (customerId: string) =>
  useQuery({
    queryKey: queryKeys.payments.customerPayments(customerId),
    queryFn: () => paymentsApi.getCustomerPayments(customerId),
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000,
  });

// Mutation Hooks
export const useCreatePaymentRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentsApi.createPaymentRecord,
    onSuccess: () => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建收款后立即看到新记录
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.accountsReceivable(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.statistics(),
        type: 'active',
      });
    },
  });
};

export const useUpdatePaymentRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePaymentRecordData }) =>
      paymentsApi.updatePaymentRecord(id, data),
    onSuccess: (_, { id }) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新收款后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.detail(id),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.accountsReceivable(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.statistics(),
        type: 'active',
      });
    },
  });
};

export const useDeletePaymentRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentsApi.deletePaymentRecord,
    onSuccess: () => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户删除收款后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.accountsReceivable(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.statistics(),
        type: 'active',
      });
    },
  });
};

export const useConfirmPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      paymentsApi.confirmPayment(id, notes),
    onSuccess: (_, { id }) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户确认收款后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.detail(id),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.accountsReceivable(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.statistics(),
        type: 'active',
      });
    },
  });
};

export const useCancelPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      paymentsApi.cancelPayment(id, notes),
    onSuccess: (_, { id }) => {
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户取消收款后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.detail(id),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.lists(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.accountsReceivable(),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.payments.statistics(),
        type: 'active',
      });
    },
  });
};

// 工具函数
export const paymentUtils = {
  formatAmount: (amount: number): string => formatCurrencyValue(amount),

  formatPaymentMethod: (method: PaymentMethod): string => {
    const methodMap: Record<PaymentMethod, string> = {
      cash: '现金',
      wechat_transfer: '微信转账',
      abc_qr: '农行码',
      icbc_qr: '工行码',
      ccb_qr: '建行码',
      cib_qr: '兴业码',
    };
    return methodMap[method] || method;
  },

  formatPaymentStatus: (status: PaymentStatus): string => {
    const statusMap = {
      pending: '待确认到账',
      applied: '已冲抵',
      confirmed: '已到账',
      cancelled: '已取消',
    };
    return statusMap[status] || status;
  },

  calculatePaymentRate: (totalAmount: number, paidAmount: number): number => {
    if (totalAmount === 0) {
      return 0;
    }
    return Math.round((paidAmount / totalAmount) * 100);
  },

  calculateOverdueDays: (dueDate: string): number => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = now.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  },

  getPaymentStatusColor: (status: PaymentStatus): string => {
    const colorMap = {
      pending: 'yellow',
      applied: 'blue',
      confirmed: 'green',
      cancelled: 'red',
    };
    return colorMap[status] || 'gray';
  },

  getPaymentMethodIcon: (method: PaymentMethod): string => {
    const iconMap: Record<PaymentMethod, string> = {
      cash: '💵',
      wechat_transfer: '💬',
      abc_qr: '🏦',
      icbc_qr: '🏦',
      ccb_qr: '🏦',
      cib_qr: '🏦',
    };
    return iconMap[method] || '💳';
  },

  generatePaymentNumber: (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = now.getTime().toString().slice(-6);
    return `PAY-${year}${month}${day}-${timestamp}`;
  },

  validatePaymentAmount: (amount: number, maxAmount: number): boolean =>
    amount > 0 && amount <= maxAmount,

  formatTimeAgo: (date: string): string =>
    // 使用统一的时间格式化函数
    formatTimeAgo(date),
};
