// 财务管理API客户端
// 基于TanStack Query实现财务管理相关的API调用函数

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CreateRefundRecordData,
  RefundRecord,
  RefundRecordDetail,
  RefundRecordQuery,
  RefundStatistics,
  UpdateRefundRecordData,
} from '@/lib/types/refund';
import type {
  AccountStatementDetail,
  AgingAnalysis,
  ReconciliationStatement,
  StatementQuery,
  StatementStatistics,
} from '@/lib/types/statement';

// 应收货款相关类型
interface AccountsReceivable {
  id: string;
  orderId: string;
  customerName: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  createdAt: string;
  updatedAt: string;
}

interface PaymentStatistics {
  totalReceivables: number;
  totalPaid: number;
  totalOverdue: number;
  monthlyCollection: number;
  growthRate: number;
}

// 查询参数类型
interface ReceivablesQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
}

// 分页响应类型
interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// 账龄分析查询参数
interface AgingAnalysisQuery {
  customerId?: string;
  asOfDate?: string;
}

// 对账查询参数
interface ReconciliationQuery {
  startDate: string;
  endDate: string;
  includeTransactions?: boolean;
}

// 退款处理数据
interface ProcessRefundData {
  action: 'approve' | 'reject';
  reason?: string;
  refundMethod?: string;
  refundAccount?: string;
  notes?: string;
}

// API基础URL
const API_BASE = '/api/finance';

// 查询键工厂
export const financeQueryKeys = {
  all: ['finance'] as const,

  // 应收货款相关
  receivables: () => [...financeQueryKeys.all, 'receivables'] as const,
  receivablesList: (query: ReceivablesQuery) =>
    [...financeQueryKeys.receivables(), 'list', query] as const,
  receivablesStats: () => [...financeQueryKeys.receivables(), 'stats'] as const,

  // 应退货款相关
  refunds: () => [...financeQueryKeys.all, 'refunds'] as const,
  refundsList: (query: RefundRecordQuery) =>
    [...financeQueryKeys.refunds(), 'list', query] as const,
  refundsDetail: (id: string) =>
    [...financeQueryKeys.refunds(), 'detail', id] as const,
  refundsStats: () => [...financeQueryKeys.refunds(), 'stats'] as const,

  // 往来账单相关
  statements: () => [...financeQueryKeys.all, 'statements'] as const,
  statementsList: (query: StatementQuery) =>
    [...financeQueryKeys.statements(), 'list', query] as const,
  statementsDetail: (id: string) =>
    [...financeQueryKeys.statements(), 'detail', id] as const,
  statementsStats: () => [...financeQueryKeys.statements(), 'stats'] as const,
  agingAnalysis: (query: AgingAnalysisQuery) =>
    [...financeQueryKeys.statements(), 'aging', query] as const,
  reconciliation: (id: string, query: ReconciliationQuery) =>
    [...financeQueryKeys.statements(), 'reconciliation', id, query] as const,
};

// API调用函数
export const financeApi = {
  // 应收货款相关
  getReceivables: async (
    query: ReceivablesQuery
  ): Promise<{
    data: AccountsReceivable[];
    pagination: PaginationResponse;
  }> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`${API_BASE}/receivables?${params}`);
    if (!response.ok) {
      throw new Error(`获取应收账款失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取应收账款失败');
    }

    return result.data;
  },

  getReceivablesStatistics: async (): Promise<PaymentStatistics> => {
    const response = await fetch(`${API_BASE}/receivables/statistics`);
    if (!response.ok) {
      throw new Error(`获取应收账款统计失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取应收账款统计失败');
    }

    return result.data;
  },

  // 应退货款相关
  getRefunds: async (
    query: RefundRecordQuery
  ): Promise<{
    data: RefundRecordDetail[];
    pagination: PaginationResponse;
  }> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`${API_BASE}/refunds?${params}`);
    if (!response.ok) {
      throw new Error(`获取退款记录失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取退款记录失败');
    }

    return result.data;
  },

  getRefund: async (id: string): Promise<RefundRecordDetail> => {
    const response = await fetch(`${API_BASE}/refunds/${id}`);
    if (!response.ok) {
      throw new Error(`获取退款详情失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取退款详情失败');
    }

    return result.data;
  },

  createRefund: async (data: CreateRefundRecordData): Promise<RefundRecord> => {
    const response = await fetch(`${API_BASE}/refunds`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`创建退款记录失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '创建退款记录失败');
    }

    return result.data;
  },

  updateRefund: async (
    id: string,
    data: UpdateRefundRecordData
  ): Promise<RefundRecord> => {
    const response = await fetch(`${API_BASE}/refunds/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`更新退款记录失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '更新退款记录失败');
    }

    return result.data;
  },

  processRefund: async (
    id: string,
    data: ProcessRefundData
  ): Promise<RefundRecord> => {
    const response = await fetch(`${API_BASE}/refunds/${id}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`处理退款失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '处理退款失败');
    }

    return result.data;
  },

  getRefundsStatistics: async (): Promise<RefundStatistics> => {
    const response = await fetch(`${API_BASE}/refunds/statistics`);
    if (!response.ok) {
      throw new Error(`获取退款统计失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取退款统计失败');
    }

    return result.data;
  },

  // 往来账单相关
  getStatements: async (
    query: StatementQuery
  ): Promise<{
    data: AccountStatementDetail[];
    pagination: PaginationResponse;
  }> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`${API_BASE}/statements?${params}`);
    if (!response.ok) {
      throw new Error(`获取往来账单失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取往来账单失败');
    }

    return result.data;
  },

  getStatement: async (id: string): Promise<AccountStatementDetail> => {
    const response = await fetch(`${API_BASE}/statements/${id}`);
    if (!response.ok) {
      throw new Error(`获取账单详情失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取账单详情失败');
    }

    return result.data;
  },

  getStatementsStatistics: async (): Promise<StatementStatistics> => {
    const response = await fetch(`${API_BASE}/statements/statistics`);
    if (!response.ok) {
      throw new Error(`获取账单统计失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取账单统计失败');
    }

    return result.data;
  },

  getAgingAnalysis: async (
    query: AgingAnalysisQuery
  ): Promise<AgingAnalysis[]> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`${API_BASE}/statements/aging?${params}`);
    if (!response.ok) {
      throw new Error(`获取账龄分析失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取账龄分析失败');
    }

    return result.data;
  },

  generateReconciliation: async (
    id: string,
    query: ReconciliationQuery
  ): Promise<ReconciliationStatement> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const response = await fetch(
      `${API_BASE}/statements/${id}/reconciliation?${params}`
    );
    if (!response.ok) {
      throw new Error(`生成对账单失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '生成对账单失败');
    }

    return result.data;
  },
};

// React Query Hooks
export const useReceivables = (query: ReceivablesQuery) =>
  useQuery({
    queryKey: financeQueryKeys.receivablesList(query),
    queryFn: () => financeApi.getReceivables(query),
    staleTime: 5 * 60 * 1000, // 5分钟
  });

export const useReceivablesStatistics = () =>
  useQuery({
    queryKey: financeQueryKeys.receivablesStats(),
    queryFn: () => financeApi.getReceivablesStatistics(),
    staleTime: 10 * 60 * 1000, // 10分钟
  });

export const useRefunds = (query: RefundRecordQuery) =>
  useQuery({
    queryKey: financeQueryKeys.refundsList(query),
    queryFn: () => financeApi.getRefunds(query),
    staleTime: 5 * 60 * 1000,
  });

export const useRefund = (id: string) =>
  useQuery({
    queryKey: financeQueryKeys.refundsDetail(id),
    queryFn: () => financeApi.getRefund(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

export const useRefundsStatistics = () =>
  useQuery({
    queryKey: financeQueryKeys.refundsStats(),
    queryFn: () => financeApi.getRefundsStatistics(),
    staleTime: 10 * 60 * 1000,
  });

export const useStatements = (query: StatementQuery) =>
  useQuery({
    queryKey: financeQueryKeys.statementsList(query),
    queryFn: () => financeApi.getStatements(query),
    staleTime: 5 * 60 * 1000,
  });

export const useStatement = (id: string) =>
  useQuery({
    queryKey: financeQueryKeys.statementsDetail(id),
    queryFn: () => financeApi.getStatement(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

export const useStatementsStatistics = () =>
  useQuery({
    queryKey: financeQueryKeys.statementsStats(),
    queryFn: () => financeApi.getStatementsStatistics(),
    staleTime: 10 * 60 * 1000,
  });

export const useAgingAnalysis = (query: AgingAnalysisQuery) =>
  useQuery({
    queryKey: financeQueryKeys.agingAnalysis(query),
    queryFn: () => financeApi.getAgingAnalysis(query),
    staleTime: 10 * 60 * 1000,
  });

// Mutation Hooks
export const useCreateRefund = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: financeApi.createRefund,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.refunds() });
      queryClient.invalidateQueries({
        queryKey: financeQueryKeys.refundsStats(),
      });
    },
  });
};

export const useUpdateRefund = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRefundRecordData }) =>
      financeApi.updateRefund(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: financeQueryKeys.refundsDetail(id),
      });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.refunds() });
      queryClient.invalidateQueries({
        queryKey: financeQueryKeys.refundsStats(),
      });
    },
  });
};

export const useProcessRefund = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProcessRefundData }) =>
      financeApi.processRefund(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({
        queryKey: financeQueryKeys.refundsDetail(id),
      });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.refunds() });
      queryClient.invalidateQueries({
        queryKey: financeQueryKeys.refundsStats(),
      });
    },
  });
};
