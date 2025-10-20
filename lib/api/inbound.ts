// 产品入库API客户端
// 使用 TanStack Query 集成的完整CRUD操作

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
 * - 配置 staleTime=Infinity 防止首次渲染时重新请求
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
    staleTime: Infinity, // 防止客户端重复请求服务端已预取的数据
    gcTime: 10 * 60 * 1000, // 10分钟
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
      // 刷新入库记录列表
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.inbounds(),
      });
      // 刷新库存数据
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
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
      // 更新缓存中的记录详情
      queryClient.setQueryData(queryKeys.inventory.inbound(variables.id), data);
      // 刷新入库记录列表
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.inbounds(),
      });
      // 刷新库存数据
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
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
      // 移除缓存中的记录详情
      queryClient.removeQueries({ queryKey: queryKeys.inventory.inbound(id) });
      // 刷新入库记录列表
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.inbounds(),
      });
      // 刷新库存数据
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
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

      const searchParams = new URLSearchParams({
        search: query.trim(),
        limit: '20',
        includeInventory: 'true', // 包含库存信息
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

      // 并行获取每个产品的批次信息
      const productsWithBatches = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        products.map(async (product: Record<string, any>) => {
          try {
            // 1. 获取该产品的库存列表
            const inventoryResponse = await fetch(
              `/api/inventory?productId=${product.id}&limit=100`
            );

            if (inventoryResponse.ok) {
              const inventoryResult = await inventoryResponse.json();

              // 处理库存 API 响应格式
              let inventoryData = [];
              if (
                inventoryResult.data &&
                Array.isArray(inventoryResult.data.inventories)
              ) {
                inventoryData = inventoryResult.data.inventories;
              } else if (
                inventoryResult.data &&
                Array.isArray(inventoryResult.data.data)
              ) {
                inventoryData = inventoryResult.data.data;
              } else if (Array.isArray(inventoryResult.data)) {
                inventoryData = inventoryResult.data;
              }

              // 2. 获取该产品的所有批次规格
              const batchSpecResponse = await fetch(
                `/api/batch-specifications?productId=${product.id}`
              );

              const batchSpecifications: Record<string, number> = {};
              if (batchSpecResponse.ok) {
                const batchSpecResult = await batchSpecResponse.json();
                const specs = batchSpecResult.data || [];
                // 构建批次号到每件片数的映射
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                specs.forEach((spec: Record<string, any>) => {
                  batchSpecifications[spec.batchNumber] = spec.piecesPerUnit;
                });
              }

              // 3. 按批次号+每件片数分组统计
              const batchSpecMap = new Map<
                string,
                { batchNumber: string; piecesPerUnit: number; quantity: number }
              >();

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              inventoryData.forEach((inv: Record<string, any>) => {
                if (inv.batchNumber) {
                  // 优先使用批次规格的 piecesPerUnit，否则使用产品默认值
                  const piecesPerUnit =
                    batchSpecifications[inv.batchNumber] ||
                    inv.product?.piecesPerUnit ||
                    product.piecesPerUnit ||
                    1;
                  // 使用特殊分隔符避免与批次号中的 - 冲突
                  const key = `${inv.batchNumber}|||${piecesPerUnit}`;
                  const existing = batchSpecMap.get(key);
                  if (existing) {
                    existing.quantity += inv.quantity || 0;
                  } else {
                    batchSpecMap.set(key, {
                      batchNumber: inv.batchNumber,
                      piecesPerUnit,
                      quantity: inv.quantity || 0,
                    });
                  }
                }
              });

              // 4. 转换为数组格式
              const batchSpecs = Array.from(batchSpecMap.values());

              return {
                value: product.id,
                label: product.name,
                code: product.code,
                unit: product.unit || 'piece',
                piecesPerUnit: product.piecesPerUnit || 1,
                specification: product.specification,
                currentStock: product.inventory?.totalQuantity || 0,
                batchSpecs,
              };
            }
          } catch {
            // 静默失败，返回不含批次的数据
          }

          // 如果获取批次失败，返回不含批次的数据
          return {
            value: product.id,
            label: product.name,
            code: product.code,
            unit: product.unit || 'piece',
            piecesPerUnit: product.piecesPerUnit || 1,
            specification: product.specification,
            currentStock: product.inventory?.totalQuantity || 0,
            batchSpecs: [],
          };
        })
      );

      return productsWithBatches;
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
