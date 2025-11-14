// 产品入库API客户端
// 使用 TanStack Query 集成的完整CRUD操作

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  INVENTORY_ACTIVITY_GC_TIME_MS,
  INVENTORY_ACTIVITY_STALE_TIME_MS,
} from '@/lib/constants/cache';
import { queryKeys } from '@/lib/queryKeys';
import type {
  CreateInboundRequest,
  InboundListResponse,
  InboundQueryParams,
  InboundRecord,
  InboundStats,
  ProductOption,
  UpdateInboundRequest,
} from '@/lib/types/inbound';

// API基础URL
const API_BASE = '/api/inventory/inbound';
const PRODUCTS_API = '/api/products';

/**
 * 获取入库记录列表
 *
 * ✅ Next.js 15.4 最佳实践：
 * - 服务端通过 HydrationBoundary 预取数据
 * - 客户端使用相同的 queryKey 获取缓存数据
 * - 配置短 staleTime 与 Redis TTL 对齐，确保跨会话刷新
 */
export function useInboundRecords(params: InboundQueryParams = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.inboundsList(params),
    queryFn: async (): Promise<InboundListResponse> => {
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });

      const response = await fetch(`${API_BASE}?${searchParams}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errorMessage = error.error || error.message || '获取入库记录失败';
        throw new Error(
          typeof errorMessage === 'string'
            ? errorMessage
            : JSON.stringify(errorMessage)
        );
      }

      const result = await response.json();

      // 检查响应格式 - API直接返回数据而不是包装在success字段中
      if (result.data && result.pagination) {
        return {
          data: result.data,
          pagination: result.pagination,
        };
      }

      if (!result.success) {
        throw new Error(result.error || '获取入库记录失败');
      }

      return {
        data: result.data,
        pagination: result.pagination,
      };
    },
    staleTime: INVENTORY_ACTIVITY_STALE_TIME_MS,
    gcTime: INVENTORY_ACTIVITY_GC_TIME_MS,
    refetchOnWindowFocus: true,
    placeholderData: previousData => previousData, // 保持上一页数据
  });
}

// 获取单个入库记录
export function useInboundRecord(id: string) {
  return useQuery({
    queryKey: queryKeys.inventory.inbound(id),
    queryFn: async (): Promise<InboundRecord> => {
      const response = await fetch(`${API_BASE}/${id}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errorMessage = error.error || error.message || '获取入库记录失败';
        throw new Error(
          typeof errorMessage === 'string'
            ? errorMessage
            : JSON.stringify(errorMessage)
        );
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
        // 正确提取错误消息
        const errorMessage =
          error.error || error.message || error.details || '创建入库记录失败';
        throw new Error(
          typeof errorMessage === 'string'
            ? errorMessage
            : JSON.stringify(errorMessage)
        );
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '创建入库记录失败');
      }

      return result.data;
    },
    onSuccess: () => {
      // ✅ 刷新入库记录列表（立即刷新）
      queryClient.refetchQueries({
        predicate: query =>
          query.queryKey[0] === 'inventory' &&
          query.queryKey[1] === 'inbounds' &&
          query.queryKey[2] === 'list',
        type: 'active',
      });

      // ✅ 刷新库存缓存（入库会影响库存）
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });

      // ✅ 刷新采购订单缓存（入库可能关联采购订单）
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.all,
      });

      // ✅ 刷新仪表盘缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });

      // ✅ 刷新产品搜索缓存，确保入库后搜索显示最新库存
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
      });
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
        const errorMessage =
          error.error || error.message || error.details || '更新入库记录失败';
        throw new Error(
          typeof errorMessage === 'string'
            ? errorMessage
            : JSON.stringify(errorMessage)
        );
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '更新入库记录失败');
      }

      return result.data;
    },
    onSuccess: (data, variables) => {
      // ✅ 更新缓存中的记录详情
      queryClient.setQueryData(queryKeys.inventory.inbound(variables.id), data);

      // ✅ 刷新入库记录列表（立即刷新）
      queryClient.refetchQueries({
        predicate: query =>
          query.queryKey[0] === 'inventory' &&
          query.queryKey[1] === 'inbounds' &&
          query.queryKey[2] === 'list',
        type: 'active',
      });

      // ✅ 刷新库存缓存（更新数量会影响库存）
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });

      // ✅ 刷新采购订单缓存（入库可能关联采购订单）
      queryClient.invalidateQueries({
        queryKey: queryKeys.purchaseOrders.all,
      });

      // ✅ 刷新仪表盘缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
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
        const errorMessage =
          error.error || error.message || error.details || '删除入库记录失败';
        throw new Error(
          typeof errorMessage === 'string'
            ? errorMessage
            : JSON.stringify(errorMessage)
        );
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '删除入库记录失败');
      }
    },
    onSuccess: (_, id) => {
      // ✅ 移除缓存中的记录详情
      queryClient.removeQueries({ queryKey: queryKeys.inventory.inbound(id) });

      // ✅ 刷新入库记录列表（立即刷新）
      queryClient.refetchQueries({
        predicate: query =>
          query.queryKey[0] === 'inventory' &&
          query.queryKey[1] === 'inbounds' &&
          query.queryKey[2] === 'list',
        type: 'active',
      });

      // ✅ 刷新库存缓存（删除入库会影响库存）
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });

      // ✅ 刷新仪表盘缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all,
      });
    },
  });
}

// 搜索产品
export function useProductSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.products.search(query),
    queryFn: async (): Promise<ProductOption[]> => {
      if (!query.trim()) {
        return [];
      }

      // ✅ 性能优化：使用 includeBatchSpecs=true 一次性获取所有数据
      // 从 41 次请求（1 + 20 + 20）减少到 1 次请求
      const searchParams = new URLSearchParams({
        search: query.trim(),
        limit: '20',
        includeInventory: 'true', // 包含库存信息
        includeBatchSpecs: 'true', // ✅ 包含批次规格数据
      });

      const response = await fetch(`${PRODUCTS_API}?${searchParams}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const errorMessage = error.error || error.message || '搜索产品失败';
        throw new Error(
          typeof errorMessage === 'string'
            ? errorMessage
            : JSON.stringify(errorMessage)
        );
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || '搜索产品失败');
      }

      // 转换 API 返回的产品数据为 ProductOption 格式
      const products = Array.isArray(result.data?.data)
        ? result.data.data
        : Array.isArray(result.data)
          ? result.data
          : [];

      // ✅ 数据已经在后端一次性获取，直接转换格式即可
      return products.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (product: Record<string, any>) => ({
          value: product.id,
          label: product.name,
          code: product.code,
          unit: product.unit || 'piece',
          piecesPerUnit: product.piecesPerUnit || 1,
          specification: product.specification,
          currentStock: product.inventory?.totalQuantity || 0,
          batchSpecs: product.batchSpecs || [],
        })
      );
    },
    enabled: !!query.trim(),
    staleTime: 5 * 60 * 1000, // 5分钟内认为数据是新鲜的
  });
}

// 获取入库统计数据
export function useInboundStats() {
  return useQuery({
    queryKey: queryKeys.inventory.inboundStats(),
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
          (sum: number, record: { quantity: number }) => sum + record.quantity,
          0
        ),
        recentRecords: recentData,
      };
    },
    staleTime: 5 * 60 * 1000, // 5分钟（与全局策略一致）
  });
}
