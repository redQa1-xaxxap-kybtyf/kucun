// 客户对账单API客户端
// 基于TanStack Query实现客户对账单查询、详情、统计等API调用函数

import { useQuery } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';

import type {
  CustomerStatementDetail,
  CustomerStatementDetailResponse,
  CustomerStatementListItem,
  CustomerStatementListResponse,
  CustomerStatementQuery,
  CustomerStatementStatistics,
  CustomerStatementStatisticsResponse,
} from '@/lib/types/customer-statement';

// API基础路径
const API_BASE = '/api/finance/customer-statements';

/**
 * 查询键工厂
 */
export const customerStatementQueryKeys = {
  all: ['customer-statements'] as const satisfies QueryKey,

  lists: () =>
    [...customerStatementQueryKeys.all, 'list'] as const satisfies QueryKey,
  list: (query: CustomerStatementQuery) =>
    [
      ...customerStatementQueryKeys.lists(),
      query,
    ] as const satisfies QueryKey,

  details: () =>
    [...customerStatementQueryKeys.all, 'detail'] as const satisfies QueryKey,
  detail: (customerId: string, startDate: string, endDate: string) =>
    [
      ...customerStatementQueryKeys.details(),
      customerId,
      startDate,
      endDate,
    ] as const satisfies QueryKey,

  statistics: () =>
    [
      ...customerStatementQueryKeys.all,
      'statistics',
    ] as const satisfies QueryKey,
};

/**
 * API调用函数
 */
export const customerStatementApi = {
  /**
   * 获取客户对账单列表
   */
  getStatements: async (
    query: CustomerStatementQuery
  ): Promise<{
    statements: CustomerStatementListItem[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }> => {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`${API_BASE}?${params}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`获取客户对账单列表失败: ${response.statusText}`);
    }

    const result: CustomerStatementListResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || '获取客户对账单列表失败');
    }

    return result.data;
  },

  /**
   * 获取客户对账单详情
   */
  getStatementDetail: async (
    customerId: string,
    startDate: string,
    endDate: string
  ): Promise<CustomerStatementDetail> => {
    const params = new URLSearchParams({
      startDate,
      endDate,
    });

    const response = await fetch(`${API_BASE}/${customerId}?${params}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('客户不存在');
      }
      throw new Error(`获取客户对账单详情失败: ${response.statusText}`);
    }

    const result: CustomerStatementDetailResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || '获取客户对账单详情失败');
    }

    return result.data;
  },

  /**
   * 获取客户对账单统计数据
   */
  getStatistics: async (): Promise<CustomerStatementStatistics> => {
    const response = await fetch(`${API_BASE}/statistics`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`获取统计数据失败: ${response.statusText}`);
    }

    const result: CustomerStatementStatisticsResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || '获取统计数据失败');
    }

    return result.data;
  },

  /**
   * 导出客户对账单
   */
  exportStatement: async (
    customerId: string,
    startDate: string,
    endDate: string,
    format: 'excel' | 'pdf' = 'excel'
  ): Promise<Blob> => {
    const params = new URLSearchParams({
      startDate,
      endDate,
      format,
    });

    const response = await fetch(
      `${API_BASE}/${customerId}/export?${params}`,
      {
        credentials: 'include',
      }
    );

    if (!response.ok) {
      throw new Error(`导出对账单失败: ${response.statusText}`);
    }

    return await response.blob();
  },
};

/**
 * React Query Hooks
 */

/**
 * 获取客户对账单列表
 */
export const useCustomerStatements = (
  query: CustomerStatementQuery,
  options?: {
    enabled?: boolean;
  }
) =>
  useQuery({
    queryKey: customerStatementQueryKeys.list(query),
    queryFn: () => customerStatementApi.getStatements(query),
    staleTime: 5 * 60 * 1000, // 5分钟
    enabled: options?.enabled,
  });

/**
 * 获取客户对账单详情
 */
export const useCustomerStatementDetail = (
  customerId: string,
  startDate: string,
  endDate: string,
  options?: {
    enabled?: boolean;
  }
) =>
  useQuery({
    queryKey: customerStatementQueryKeys.detail(customerId, startDate, endDate),
    queryFn: () =>
      customerStatementApi.getStatementDetail(customerId, startDate, endDate),
    staleTime: 5 * 60 * 1000, // 5分钟
    enabled:
      (options?.enabled ?? true) && !!customerId && !!startDate && !!endDate,
  });

/**
 * 获取客户对账单统计数据
 */
export const useCustomerStatementStatistics = () =>
  useQuery({
    queryKey: customerStatementQueryKeys.statistics(),
    queryFn: () => customerStatementApi.getStatistics(),
    staleTime: 5 * 60 * 1000, // 5分钟
  });
