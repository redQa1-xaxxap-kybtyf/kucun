// 产品入库API客户端
// 使用 TanStack Query 集成的完整CRUD操作

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  InboundRecord,
  InboundListResponse,
  InboundQueryParams,
  CreateInboundRequest,
  UpdateInboundRequest,
  InboundStats,
  ProductOption,
} from '@/lib/types/inbound';

// API基础URL
const API_BASE = '/api/inventory/inbound';
const PRODUCTS_API = '/api/products/search';

// 查询键工厂
export const inboundKeys = {
  all: ['inbound'] as const,
  lists: () => [...inboundKeys.all, 'list'] as const,
  list: (params: InboundQueryParams) =>
    [...inboundKeys.lists(), params] as const,
  details: () => [...inboundKeys.all, 'detail'] as const,
  detail: (id: string) => [...inboundKeys.details(), id] as const,
  stats: () => [...inboundKeys.all, 'stats'] as const,
};

// 产品搜索查询键
export const productSearchKeys = {
  all: ['product-search'] as const,
  search: (query: string) => [...productSearchKeys.all, query] as const,
};

// 获取入库记录列表
export function useInboundRecords(params: InboundQueryParams = {}) {
  return useQuery({
    queryKey: inboundKeys.list(params),
    queryFn: async (): Promise<InboundListResponse> => {
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });

      const response = await fetch(`${API_BASE}?${searchParams}`);
      if (!response.ok) {
        throw new Error('获取入库记录失败');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '获取入库记录失败');
      }

      return {
        data: result.data,
        pagination: result.pagination,
      };
    },
    staleTime: 30 * 1000, // 30秒内认为数据是新鲜的
  });
}

// 获取单个入库记录
export function useInboundRecord(id: string) {
  return useQuery({
    queryKey: inboundKeys.detail(id),
    queryFn: async (): Promise<InboundRecord> => {
      const response = await fetch(`${API_BASE}/${id}`);
      if (!response.ok) {
        throw new Error('获取入库记录失败');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '获取入库记录失败');
      }

      return result.data;
    },
    enabled: !!id,
  });
}

// 创建入库记录
export function useCreateInboundRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateInboundRequest): Promise<InboundRecord> => {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建入库记录失败');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '创建入库记录失败');
      }

      return result.data;
    },
    onSuccess: () => {
      // 刷新入库记录列表
      queryClient.invalidateQueries({ queryKey: inboundKeys.lists() });
      // 刷新库存数据
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

// 更新入库记录
export function useUpdateInboundRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateInboundRequest;
    }): Promise<InboundRecord> => {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新入库记录失败');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '更新入库记录失败');
      }

      return result.data;
    },
    onSuccess: (data, variables) => {
      // 更新缓存中的记录详情
      queryClient.setQueryData(inboundKeys.detail(variables.id), data);
      // 刷新入库记录列表
      queryClient.invalidateQueries({ queryKey: inboundKeys.lists() });
      // 刷新库存数据
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

// 删除入库记录
export function useDeleteInboundRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除入库记录失败');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '删除入库记录失败');
      }
    },
    onSuccess: (_, id) => {
      // 移除缓存中的记录详情
      queryClient.removeQueries({ queryKey: inboundKeys.detail(id) });
      // 刷新入库记录列表
      queryClient.invalidateQueries({ queryKey: inboundKeys.lists() });
      // 刷新库存数据
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

// 搜索产品
export function useProductSearch(query: string) {
  return useQuery({
    queryKey: productSearchKeys.search(query),
    queryFn: async (): Promise<ProductOption[]> => {
      if (!query.trim()) {
        return [];
      }

      const searchParams = new URLSearchParams({
        search: query.trim(),
        limit: '20',
      });

      const response = await fetch(`${PRODUCTS_API}?${searchParams}`);
      if (!response.ok) {
        throw new Error('搜索产品失败');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '搜索产品失败');
      }

      return result.data;
    },
    enabled: !!query.trim(),
    staleTime: 5 * 60 * 1000, // 5分钟内认为数据是新鲜的
  });
}

// 获取入库统计数据
export function useInboundStats() {
  return useQuery({
    queryKey: inboundKeys.stats(),
    queryFn: async (): Promise<InboundStats> => {
      // 这里可以创建专门的统计API，暂时使用列表API模拟
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [todayRecords, monthRecords, recentRecords] = await Promise.all([
        // 今日记录
        fetch(
          `${API_BASE}?startDate=${today.toISOString().split('T')[0]}&limit=1000`
        ).then(r => r.json()),
        // 本月记录
        fetch(
          `${API_BASE}?startDate=${startOfMonth.toISOString().split('T')[0]}&limit=1000`
        ).then(r => r.json()),
        // 最近记录
        fetch(`${API_BASE}?limit=5&sortBy=createdAt&sortOrder=desc`).then(r =>
          r.json()
        ),
      ]);

      const todayData = todayRecords.success ? todayRecords.data : [];
      const monthData = monthRecords.success ? monthRecords.data : [];
      const recentData = recentRecords.success ? recentRecords.data : [];

      return {
        todayCount: todayData.length,
        monthCount: monthData.length,
        totalQuantity: monthData.reduce(
          (sum: number, record: any) => sum + record.quantity,
          0
        ),
        recentRecords: recentData,
      };
    },
    staleTime: 60 * 1000, // 1分钟内认为数据是新鲜的
  });
}
