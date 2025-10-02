// 收款管理API客户端
// 基于TanStack Query实现收款记录CRUD、应收账款查询、收款统计等API调用函数

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
import { formatTimeAgo } from '@/lib/utils/datetime';

// API基础URL
const API_BASE = '/api/payments';

// 查询键工厂
export const paymentQueryKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentQueryKeys.all, 'list'] as const,
  list: (query: PaymentRecordQuery) =>
    [...paymentQueryKeys.lists(), query] as const,
  details: () => [...paymentQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentQueryKeys.details(), id] as const,
  accountsReceivable: () =>
    [...paymentQueryKeys.all, 'accounts-receivable'] as const,
  accountsReceivableList: (query: AccountsReceivableQuery) =>
    [...paymentQueryKeys.accountsReceivable(), query] as const,
  statistics: () => [...paymentQueryKeys.all, 'statistics'] as const,
  statisticsData: (query: any) =>
    [...paymentQueryKeys.statistics(), query] as const,
  salesOrderPayments: (salesOrderId: string) =>
    [...paymentQueryKeys.all, 'sales-order', salesOrderId] as const,
  customerPayments: (customerId: string) =>
    [...paymentQueryKeys.all, 'customer', customerId] as const,
};

// API调用函数
export const paymentsApi = {
  // 获取收款记录列表
  getPaymentRecords: async (
    query: PaymentRecordQuery
  ): Promise<PaymentRecordListResponse['data']> => {
    const params = new URLSearchParams();

    if (query.page) {params.append('page', query.page.toString());}
    if (query.pageSize) {params.append('pageSize', query.pageSize.toString());}
    if (query.search) {params.append('search', query.search);}
    if (query.customerId) {params.append('customerId', query.customerId);}
    if (query.userId) {params.append('userId', query.userId);}
    if (query.paymentMethod)
      {params.append('paymentMethod', query.paymentMethod);}
    if (query.status) {params.append('status', query.status);}
    if (query.startDate) {params.append('startDate', query.startDate);}
    if (query.endDate) {params.append('endDate', query.endDate);}
    if (query.sortBy) {params.append('sortBy', query.sortBy);}
    if (query.sortOrder) {params.append('sortOrder', query.sortOrder);}

    const response = await fetch(`${API_BASE}?${params}`);
    if (!response.ok) {
      throw new Error(`获取收款记录失败: ${response.statusText}`);
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
      throw new Error(`获取收款记录详情失败: ${response.statusText}`);
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
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`创建收款记录失败: ${response.statusText}`);
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
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`更新收款记录失败: ${response.statusText}`);
    }

    const result: PaymentRecordResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || '更新收款记录失败');
    }

    return result.data;
  },

  // 删除收款记录
  deletePaymentRecord: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`删除收款记录失败: ${response.statusText}`);
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
    const response = await fetch(`${API_BASE}/${id}/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      throw new Error(`确认收款失败: ${response.statusText}`);
    }

    const result: PaymentRecordResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || '确认收款失败');
    }

    return result.data;
  },

  // 取消收款
  cancelPayment: async (id: string, notes?: string): Promise<PaymentRecord> => {
    const response = await fetch(`${API_BASE}/${id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      throw new Error(`取消收款失败: ${response.statusText}`);
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

    if (query.page) {params.append('page', query.page.toString());}
    if (query.pageSize) {params.append('pageSize', query.pageSize.toString());}
    if (query.search) {params.append('search', query.search);}
    if (query.customerId) {params.append('customerId', query.customerId);}
    if (query.paymentStatus)
      {params.append('paymentStatus', query.paymentStatus);}
    if (query.startDate) {params.append('startDate', query.startDate);}
    if (query.endDate) {params.append('endDate', query.endDate);}
    if (query.sortBy) {params.append('sortBy', query.sortBy);}
    if (query.sortOrder) {params.append('sortOrder', query.sortOrder);}

    const response = await fetch(`${API_BASE}/accounts-receivable?${params}`);
    if (!response.ok) {
      throw new Error(`获取应收账款失败: ${response.statusText}`);
    }

    const result: AccountsReceivableResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取应收账款失败');
    }

    return result.data;
  },

  // 获取收款统计
  getPaymentStatistics: async (
    query: any = {}
  ): Promise<PaymentStatisticsResponse['data']> => {
    const params = new URLSearchParams();

    if (query.startDate) {params.append('startDate', query.startDate);}
    if (query.endDate) {params.append('endDate', query.endDate);}
    if (query.customerId) {params.append('customerId', query.customerId);}
    if (query.paymentMethod)
      {params.append('paymentMethod', query.paymentMethod);}
    if (query.groupBy) {params.append('groupBy', query.groupBy);}

    const response = await fetch(`${API_BASE}/statistics?${params}`);
    if (!response.ok) {
      throw new Error(`获取收款统计失败: ${response.statusText}`);
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
      throw new Error(`获取销售订单收款记录失败: ${response.statusText}`);
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
      throw new Error(`获取客户收款记录失败: ${response.statusText}`);
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
    queryKey: paymentQueryKeys.list(query),
    queryFn: () => paymentsApi.getPaymentRecords(query),
    staleTime: 5 * 60 * 1000, // 5分钟
  });

export const usePaymentRecord = (id: string) =>
  useQuery({
    queryKey: paymentQueryKeys.detail(id),
    queryFn: () => paymentsApi.getPaymentRecord(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

export const useAccountsReceivable = (query: AccountsReceivableQuery) =>
  useQuery({
    queryKey: paymentQueryKeys.accountsReceivableList(query),
    queryFn: () => paymentsApi.getAccountsReceivable(query),
    staleTime: 5 * 60 * 1000,
  });

export const usePaymentStatistics = (query: any = {}) =>
  useQuery({
    queryKey: paymentQueryKeys.statisticsData(query),
    queryFn: () => paymentsApi.getPaymentStatistics(query),
    staleTime: 10 * 60 * 1000, // 10分钟
  });

export const useSalesOrderPayments = (salesOrderId: string) =>
  useQuery({
    queryKey: paymentQueryKeys.salesOrderPayments(salesOrderId),
    queryFn: () => paymentsApi.getSalesOrderPayments(salesOrderId),
    enabled: !!salesOrderId,
    staleTime: 5 * 60 * 1000,
  });

export const useCustomerPayments = (customerId: string) =>
  useQuery({
    queryKey: paymentQueryKeys.customerPayments(customerId),
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
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.accountsReceivable(),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.statistics(),
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
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.accountsReceivable(),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.statistics(),
      });
    },
  });
};

export const useDeletePaymentRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: paymentsApi.deletePaymentRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.accountsReceivable(),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.statistics(),
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
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.accountsReceivable(),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.statistics(),
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
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: paymentQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.accountsReceivable(),
      });
      queryClient.invalidateQueries({
        queryKey: paymentQueryKeys.statistics(),
      });
    },
  });
};

// 工具函数
export const paymentUtils = {
  formatAmount: (amount: number): string =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount),

  formatPaymentMethod: (method: PaymentMethod): string => {
    const methodMap = {
      cash: '现金',
      bank_transfer: '银行转账',
      check: '支票',
      other: '其他',
    };
    return methodMap[method] || method;
  },

  formatPaymentStatus: (status: PaymentStatus): string => {
    const statusMap = {
      pending: '待确认',
      confirmed: '已确认',
      cancelled: '已取消',
    };
    return statusMap[status] || status;
  },

  calculatePaymentRate: (totalAmount: number, paidAmount: number): number => {
    if (totalAmount === 0) {return 0;}
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
      confirmed: 'green',
      cancelled: 'red',
    };
    return colorMap[status] || 'gray';
  },

  getPaymentMethodIcon: (method: PaymentMethod): string => {
    const iconMap = {
      cash: '💵',
      bank_transfer: '🏦',
      check: '📝',
      other: '💳',
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
