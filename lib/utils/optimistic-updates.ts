/**
 * Optimistic Updates 工具函数
 *
 * 提供通用的乐观更新模式，用于 TanStack Query mutations
 *
 * @module lib/utils/optimistic-updates
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
 */

import type {
  QueryClient,
  QueryKey,
  UseMutationOptions,
} from '@tanstack/react-query';

/**
 * 分页响应类型
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 乐观更新上下文
 */
export interface OptimisticContext<T> {
  previousData: T | undefined;
}

/**
 * 创建列表项的乐观更新配置
 *
 * @template TData - API 返回的数据类型
 * @template TVariables - Mutation 的输入参数类型
 * @template TItem - 列表项类型
 *
 * @param queryClient - QueryClient 实例（通过 useQueryClient() 获取）
 * @param options - 配置选项
 * @param options.queryKey - 要更新的 Query Key
 * @param options.generateTempItem - 生成临时列表项的函数
 * @param options.position - 插入位置（'start' | 'end'），默认 'start'
 *
 * @returns Mutation 配置对象（包含 onMutate、onError、onSettled）
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 * const createMutation = useMutation({
 *   mutationFn: createSalesOrder,
 *   ...createOptimisticListMutation(queryClient, {
 *     queryKey: queryKeys.salesOrders.lists(),
 *     generateTempItem: (data) => ({
 *       ...data,
 *       id: `temp-${Date.now()}`,
 *       status: 'draft',
 *       createdAt: new Date().toISOString(),
 *     }),
 *   }),
 * });
 * ```
 */
export function createOptimisticListMutation<
  TData,
  TVariables,
  TItem extends { id: string },
>(
  queryClient: QueryClient,
  {
    queryKey,
    generateTempItem,
    position = 'start',
  }: {
    queryKey: QueryKey;
    generateTempItem: (variables: TVariables) => TItem;
    position?: 'start' | 'end';
  }
): Pick<
  UseMutationOptions<TData, Error, TVariables>,
  'onMutate' | 'onError' | 'onSettled'
> {
  return {
    onMutate: async (variables: TVariables) => {
      // 1. 取消正在进行的查询，避免覆盖乐观更新
      await queryClient.cancelQueries({ queryKey });

      // 2. 保存当前数据（用于回滚）
      const previousData =
        queryClient.getQueryData<PaginatedResponse<TItem>>(queryKey);

      // 3. 乐观更新缓存
      if (previousData) {
        const tempItem = generateTempItem(variables);

        queryClient.setQueryData<PaginatedResponse<TItem>>(queryKey, {
          ...previousData,
          data:
            position === 'start'
              ? [tempItem, ...previousData.data]
              : [...previousData.data, tempItem],
          pagination: {
            ...previousData.pagination,
            total: previousData.pagination.total + 1,
            totalPages: Math.ceil(
              (previousData.pagination.total + 1) /
                previousData.pagination.limit
            ),
          },
        });
      }

      // 4. 返回回滚上下文
      return { previousData };
    },

    onError: (_err, _variables, context) => {
      // 失败时回滚到之前的数据
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },

    onSettled: () => {
      // 无论成功或失败，都重新获取数据以确保一致性
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * 创建更新列表项的乐观更新配置
 *
 * @template TData - API 返回的数据类型
 * @template TVariables - Mutation 的输入参数类型
 * @template TItem - 列表项类型
 *
 * @param queryClient - QueryClient 实例（通过 useQueryClient() 获取）
 * @param options - 配置选项
 * @param options.queryKey - 要更新的 Query Key
 * @param options.getItemId - 从 variables 中获取项目 ID 的函数
 * @param options.updateItem - 更新列表项的函数
 *
 * @returns Mutation 配置对象（包含 onMutate、onError、onSettled）
 *
 * @example
 * ```typescript
 * const queryClient = useQueryClient();
 * const updateMutation = useMutation({
 *   mutationFn: updateOrderStatus,
 *   ...createOptimisticUpdateMutation(queryClient, {
 *     queryKey: queryKeys.salesOrders.lists(),
 *     getItemId: (vars) => vars.orderId,
 *     updateItem: (item, vars) => ({
 *       ...item,
 *       status: vars.status,
 *       updatedAt: new Date().toISOString(),
 *     }),
 *   }),
 * });
 * ```
 */
export function createOptimisticUpdateMutation<
  TData,
  TVariables,
  TItem extends { id: string },
>(
  queryClient: QueryClient,
  {
    queryKey,
    getItemId,
    updateItem,
  }: {
    queryKey: QueryKey;
    getItemId: (variables: TVariables) => string;
    updateItem: (item: TItem, variables: TVariables) => TItem;
  }
): Pick<
  UseMutationOptions<TData, Error, TVariables>,
  'onMutate' | 'onError' | 'onSettled'
> {
  return {
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData =
        queryClient.getQueryData<PaginatedResponse<TItem>>(queryKey);

      if (previousData) {
        const itemId = getItemId(variables);

        queryClient.setQueryData<PaginatedResponse<TItem>>(queryKey, {
          ...previousData,
          data: previousData.data.map(item =>
            item.id === itemId ? updateItem(item, variables) : item
          ),
        });
      }

      return { previousData };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * 创建删除列表项的乐观更新配置
 *
 * @template TData - API 返回的数据类型
 * @template TVariables - Mutation 的输入参数类型
 * @template TItem - 列表项类型
 *
 * @param options - 配置选项
 * @param options.queryKey - 要更新的 Query Key
 * @param options.getItemId - 从 variables 中获取项目 ID 的函数
 *
 * @returns Mutation 配置对象（包含 onMutate、onError、onSettled）
 *
 * @example
 * ```typescript
 * const deleteMutation = useMutation({
 *   mutationFn: deleteOrder,
 *   ...createOptimisticDeleteMutation({
 *     queryKey: queryKeys.salesOrders.lists(),
 *     getItemId: (vars) => vars.orderId,
 *   }),
 * });
 * ```
 */
export function createOptimisticDeleteMutation<
  TData,
  TVariables,
  TItem extends { id: string },
>(
  queryClient: QueryClient,
  {
    queryKey,
    getItemId,
  }: {
    queryKey: QueryKey;
    getItemId: (variables: TVariables) => string;
  }
): Pick<
  UseMutationOptions<TData, Error, TVariables>,
  'onMutate' | 'onError' | 'onSettled'
> {
  return {
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey });

      const previousData =
        queryClient.getQueryData<PaginatedResponse<TItem>>(queryKey);

      if (previousData) {
        const itemId = getItemId(variables);

        queryClient.setQueryData<PaginatedResponse<TItem>>(queryKey, {
          ...previousData,
          data: previousData.data.filter(item => item.id !== itemId),
          pagination: {
            ...previousData.pagination,
            total: previousData.pagination.total - 1,
            totalPages: Math.ceil(
              (previousData.pagination.total - 1) /
                previousData.pagination.limit
            ),
          },
        });
      }

      return { previousData };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  };
}
