// 仪表盘API客户端
// 基于TanStack Query的仪表盘数据获取和管理

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  BusinessOverview,
  CustomerSalesRanking,
  DashboardApiResponse,
  DashboardData,
  DashboardFilters,
  InventoryAlert,
  InventoryTrendData,
  ProductSalesRanking,
  QuickAction,
  SalesTrendData,
  TimeRange,
  TodoItem,
} from '@/lib/types/dashboard';
import { formatTimeAgo } from '@/lib/utils/datetime';

// API基础URL
const API_BASE = '/api/dashboard';

// 查询键工厂
export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  overview: () => [...dashboardQueryKeys.all, 'overview'] as const,
  alerts: () => [...dashboardQueryKeys.all, 'alerts'] as const,
  todos: () => [...dashboardQueryKeys.all, 'todos'] as const,
  salesTrend: (timeRange: TimeRange) =>
    [...dashboardQueryKeys.all, 'sales-trend', timeRange] as const,
  inventoryTrend: (timeRange: TimeRange) =>
    [...dashboardQueryKeys.all, 'inventory-trend', timeRange] as const,
  productRanking: (timeRange: TimeRange) =>
    [...dashboardQueryKeys.all, 'product-ranking', timeRange] as const,
  customerRanking: (timeRange: TimeRange) =>
    [...dashboardQueryKeys.all, 'customer-ranking', timeRange] as const,
  quickActions: () => [...dashboardQueryKeys.all, 'quick-actions'] as const,
  complete: (filters: DashboardFilters) =>
    [...dashboardQueryKeys.all, 'complete', filters] as const,
};

// API调用函数
export const dashboardApi = {
  // 获取完整仪表盘数据
  getDashboardData: async (
    filters: DashboardFilters
  ): Promise<DashboardData> => {
    const params = new URLSearchParams({
      timeRange: filters.timeRange,
      ...(filters.productCategory && {
        productCategory: filters.productCategory,
      }),
      ...(filters.customerType && { customerType: filters.customerType }),
      ...(filters.salesChannel && { salesChannel: filters.salesChannel }),
      ...(filters.region && { region: filters.region }),
    });

    const response = await fetch(`${API_BASE}?${params}`);
    if (!response.ok) {
      throw new Error(`获取仪表盘数据失败: ${response.statusText}`);
    }

    const result: DashboardApiResponse = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取仪表盘数据失败');
    }

    return result.data;
  },

  // 获取业务概览
  getBusinessOverview: async (
    timeRange: TimeRange
  ): Promise<BusinessOverview> => {
    const response = await fetch(`${API_BASE}/overview?timeRange=${timeRange}`);
    if (!response.ok) {
      throw new Error(`获取业务概览失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取业务概览失败');
    }

    return result.data;
  },

  // 获取库存预警
  getInventoryAlerts: async (): Promise<InventoryAlert[]> => {
    const response = await fetch(`${API_BASE}/alerts`);
    if (!response.ok) {
      throw new Error(`获取库存预警失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取库存预警失败');
    }

    return result.data;
  },

  // 获取待办事项
  getTodoItems: async (): Promise<TodoItem[]> => {
    const response = await fetch(`${API_BASE}/todos`);
    if (!response.ok) {
      throw new Error(`获取待办事项失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取待办事项失败');
    }

    return result.data;
  },

  // 获取销售趋势
  getSalesTrend: async (timeRange: TimeRange): Promise<SalesTrendData> => {
    const response = await fetch(
      `${API_BASE}/sales-trend?timeRange=${timeRange}`
    );
    if (!response.ok) {
      throw new Error(`获取销售趋势失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取销售趋势失败');
    }

    return result.data;
  },

  // 获取库存趋势
  getInventoryTrend: async (
    timeRange: TimeRange
  ): Promise<InventoryTrendData> => {
    const response = await fetch(
      `${API_BASE}/inventory-trend?timeRange=${timeRange}`
    );
    if (!response.ok) {
      throw new Error(`获取库存趋势失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取库存趋势失败');
    }

    return result.data;
  },

  // 获取产品销售排行
  getProductRanking: async (
    timeRange: TimeRange
  ): Promise<ProductSalesRanking[]> => {
    const response = await fetch(
      `${API_BASE}/product-ranking?timeRange=${timeRange}`
    );
    if (!response.ok) {
      throw new Error(`获取产品排行失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取产品排行失败');
    }

    return result.data;
  },

  // 获取客户销售排行
  getCustomerRanking: async (
    timeRange: TimeRange
  ): Promise<CustomerSalesRanking[]> => {
    const response = await fetch(
      `${API_BASE}/customer-ranking?timeRange=${timeRange}`
    );
    if (!response.ok) {
      throw new Error(`获取客户排行失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取客户排行失败');
    }

    return result.data;
  },

  // 获取快速操作
  getQuickActions: async (): Promise<QuickAction[]> => {
    const response = await fetch(`${API_BASE}/quick-actions`);
    if (!response.ok) {
      throw new Error(`获取快速操作失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '获取快速操作失败');
    }

    return result.data;
  },

  // 标记待办事项完成
  completeTodoItem: async (todoId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/todos/${todoId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`标记待办事项完成失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '标记待办事项完成失败');
    }
  },

  // 忽略库存预警
  dismissAlert: async (alertId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/alerts/${alertId}/dismiss`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`忽略预警失败: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '忽略预警失败');
    }
  },
};

// React Query Hooks
export const useDashboardData = (filters: DashboardFilters) =>
  useQuery({
    queryKey: dashboardQueryKeys.complete(filters),
    queryFn: () => dashboardApi.getDashboardData(filters),
    staleTime: 5 * 60 * 1000, // 5分钟
    refetchInterval: 30 * 1000, // 30秒自动刷新
  });

export const useBusinessOverview = (timeRange: TimeRange) =>
  useQuery({
    queryKey: dashboardQueryKeys.overview(),
    queryFn: () => dashboardApi.getBusinessOverview(timeRange),
    staleTime: 5 * 60 * 1000,
  });

export const useInventoryAlerts = () =>
  useQuery({
    queryKey: dashboardQueryKeys.alerts(),
    queryFn: dashboardApi.getInventoryAlerts,
    staleTime: 2 * 60 * 1000, // 2分钟
    refetchInterval: 60 * 1000, // 1分钟自动刷新
  });

export const useTodoItems = () =>
  useQuery({
    queryKey: dashboardQueryKeys.todos(),
    queryFn: dashboardApi.getTodoItems,
    staleTime: 5 * 60 * 1000,
  });

export const useSalesTrend = (timeRange: TimeRange) =>
  useQuery({
    queryKey: dashboardQueryKeys.salesTrend(timeRange),
    queryFn: () => dashboardApi.getSalesTrend(timeRange),
    staleTime: 10 * 60 * 1000, // 10分钟
  });

export const useInventoryTrend = (timeRange: TimeRange) =>
  useQuery({
    queryKey: dashboardQueryKeys.inventoryTrend(timeRange),
    queryFn: () => dashboardApi.getInventoryTrend(timeRange),
    staleTime: 10 * 60 * 1000,
  });

export const useProductRanking = (timeRange: TimeRange) =>
  useQuery({
    queryKey: dashboardQueryKeys.productRanking(timeRange),
    queryFn: () => dashboardApi.getProductRanking(timeRange),
    staleTime: 15 * 60 * 1000, // 15分钟
  });

export const useCustomerRanking = (timeRange: TimeRange) =>
  useQuery({
    queryKey: dashboardQueryKeys.customerRanking(timeRange),
    queryFn: () => dashboardApi.getCustomerRanking(timeRange),
    staleTime: 15 * 60 * 1000,
  });

export const useQuickActions = () =>
  useQuery({
    queryKey: dashboardQueryKeys.quickActions(),
    queryFn: dashboardApi.getQuickActions,
    staleTime: 60 * 60 * 1000, // 1小时
  });

// Mutation Hooks
export const useCompleteTodoItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dashboardApi.completeTodoItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.todos() });
    },
  });
};

export const useDismissAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dashboardApi.dismissAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.alerts() });
    },
  });
};

// 工具函数
export const dashboardUtils = {
  formatCurrency: (amount: number): string =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount),

  formatNumber: (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  },

  formatPercentage: (percent: number): string =>
    `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`,

  calculateGrowth: (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  },

  getAlertColor: (level: InventoryAlert['alertLevel']): string => {
    switch (level) {
      case 'warning':
        return 'yellow';
      case 'danger':
        return 'orange';
      case 'critical':
        return 'red';
      default:
        return 'gray';
    }
  },

  getPriorityColor: (priority: TodoItem['priority']): string => {
    switch (priority) {
      case 'urgent':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'green';
      default:
        return 'gray';
    }
  },

  formatTimeAgo: (date: string): string =>
    // 使用统一的时间格式化函数
    formatTimeAgo(date),
};
