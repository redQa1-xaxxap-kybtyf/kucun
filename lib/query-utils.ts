/**
 * Query 工具函数
 *
 * 提供常用的 Query 操作辅助函数，确保类型安全和代码复用
 */

import type { QueryKey } from '@tanstack/react-query';
import { QueryClient, queryOptions } from '@tanstack/react-query';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 分页响应类型
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * API 响应类型
 */
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

// ============================================================================
// Query Options 工厂函数
// ============================================================================

/**
 * 创建带有默认配置的 Query Options
 *
 * @param queryKey - Query Key
 * @param queryFn - Query Function
 * @param options - 额外的配置选项
 * @returns Query Options
 *
 * @example
 * ```ts
 * const options = createQueryOptions(
 *   queryKeys.products.detail(id),
 *   () => fetchProduct(id),
 *   { staleTime: 5 * 60 * 1000 }
 * );
 *
 * useQuery(options);
 * ```
 */
export function createQueryOptions<TData>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: {
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
    retry?: number | boolean;
  }
) {
  return queryOptions({
    queryKey,
    queryFn,
    staleTime: options?.staleTime ?? 60 * 1000, // 默认 1 分钟
    gcTime: options?.cacheTime ?? 5 * 60 * 1000, // 默认 5 分钟
    enabled: options?.enabled ?? true,
    retry: options?.retry ?? 3,
  });
}

// ============================================================================
// 缓存操作辅助函数
// ============================================================================

/**
 * 失效多个相关的查询
 *
 * @param queryClient - Query Client 实例
 * @param queryKeys - 要失效的 Query Keys 数组
 *
 * @example
 * ```ts
 * invalidateMultipleQueries(queryClient, [
 *   queryKeys.products.lists(),
 *   queryKeys.products.detail(id),
 * ]);
 * ```
 */
export async function invalidateMultipleQueries(
  queryClient: QueryClient,
  queryKeys: QueryKey[]
): Promise<void> {
  await Promise.all(
    queryKeys.map(queryKey => queryClient.invalidateQueries({ queryKey }))
  );
}

/**
 * 移除多个查询的缓存
 *
 * @param queryClient - Query Client 实例
 * @param queryKeys - 要移除的 Query Keys 数组
 *
 * @example
 * ```ts
 * removeMultipleQueries(queryClient, [
 *   queryKeys.products.detail(id1),
 *   queryKeys.products.detail(id2),
 * ]);
 * ```
 */
export function removeMultipleQueries(
  queryClient: QueryClient,
  queryKeys: QueryKey[]
): void {
  queryKeys.forEach(queryKey => {
    queryClient.removeQueries({ queryKey });
  });
}

/**
 * 预取多个查询
 *
 * @param queryClient - Query Client 实例
 * @param queries - 查询配置数组
 *
 * @example
 * ```ts
 * await prefetchMultipleQueries(queryClient, [
 *   { queryKey: queryKeys.products.list({ page: 1 }), queryFn: () => fetchProducts({ page: 1 }) },
 *   { queryKey: queryKeys.customers.list({ page: 1 }), queryFn: () => fetchCustomers({ page: 1 }) },
 * ]);
 * ```
 */
export async function prefetchMultipleQueries(
  queryClient: QueryClient,
  queries: Array<{ queryKey: QueryKey; queryFn: () => Promise<unknown> }>
): Promise<void> {
  await Promise.all(
    queries.map(({ queryKey, queryFn }) =>
      queryClient.prefetchQuery({ queryKey, queryFn })
    )
  );
}

// ============================================================================
// 数据转换辅助函数
// ============================================================================

/**
 * 从 API 响应中提取数据
 *
 * @param response - API 响应
 * @returns 提取的数据
 * @throws 如果响应包含错误
 *
 * @example
 * ```ts
 * const data = extractApiData(await fetch('/api/products'));
 * ```
 */
export function extractApiData<T>(response: ApiResponse<T>): T {
  if (response.error) {
    throw new Error(response.error);
  }
  return response.data;
}

/**
 * 创建分页响应
 *
 * @param items - 数据项数组
 * @param total - 总数
 * @param page - 当前页码
 * @param pageSize - 每页大小
 * @returns 分页响应对象
 *
 * @example
 * ```ts
 * const response = createPaginatedResponse(products, 100, 1, 20);
 * ```
 */
export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============================================================================
// Query Key 辅助函数
// ============================================================================

/**
 * 检查两个 Query Key 是否匹配
 *
 * @param key1 - 第一个 Query Key
 * @param key2 - 第二个 Query Key
 * @returns 是否匹配
 *
 * @example
 * ```ts
 * const matches = matchQueryKey(
 *   queryKeys.products.all,
 *   queryKeys.products.list({ page: 1 })
 * ); // true，因为 list 是 all 的子集
 * ```
 */
export function matchQueryKey(key1: QueryKey, key2: QueryKey): boolean {
  if (key1.length > key2.length) {
    return false;
  }

  return key1.every((part, index) => {
    const otherPart = key2[index];
    if (typeof part === 'object' && typeof otherPart === 'object') {
      return JSON.stringify(part) === JSON.stringify(otherPart);
    }
    return part === otherPart;
  });
}

/**
 * 从 Query Key 中提取 ID
 *
 * @param queryKey - Query Key
 * @returns ID 或 undefined
 *
 * @example
 * ```ts
 * const id = extractIdFromQueryKey(queryKeys.products.detail('123')); // '123'
 * ```
 */
export function extractIdFromQueryKey(queryKey: QueryKey): string | undefined {
  // 假设 ID 总是在最后一个位置
  const lastPart = queryKey[queryKey.length - 1];
  return typeof lastPart === 'string' ? lastPart : undefined;
}

// ============================================================================
// 错误处理辅助函数
// ============================================================================

/**
 * 创建标准化的错误对象
 *
 * @param message - 错误消息
 * @param code - 错误代码
 * @returns Error 对象
 *
 * @example
 * ```ts
 * throw createQueryError('产品不存在', 'PRODUCT_NOT_FOUND');
 * ```
 */
export function createQueryError(message: string, code?: string): Error {
  const error = new Error(message);
  if (code) {
    (error as Error & { code: string }).code = code;
  }
  return error;
}

/**
 * 判断错误是否为网络错误
 *
 * @param error - 错误对象
 * @returns 是否为网络错误
 *
 * @example
 * ```ts
 * if (isNetworkError(error)) {
 *   console.log('网络连接失败');
 * }
 * ```
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch')
    );
  }
  return false;
}

/**
 * 从错误对象中提取用户友好的错误消息
 *
 * @param error - 错误对象
 * @returns 用户友好的错误消息
 *
 * @example
 * ```ts
 * const message = getErrorMessage(error);
 * toast.error(message);
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '发生未知错误';
}

// ============================================================================
// 重试策略辅助函数
// ============================================================================

/**
 * 创建自定义重试函数
 *
 * @param maxRetries - 最大重试次数
 * @param retryDelay - 重试延迟（毫秒）
 * @returns 重试函数
 *
 * @example
 * ```ts
 * useQuery({
 *   queryKey: queryKeys.products.detail(id),
 *   queryFn: () => fetchProduct(id),
 *   retry: createRetryFn(3, 1000),
 * });
 * ```
 */
export function createRetryFn(maxRetries: number, retryDelay: number) {
  return (failureCount: number, error: Error) => {
    // 不重试 4xx 错误
    if (error.message.includes('4')) {
      return false;
    }

    // 达到最大重试次数
    if (failureCount >= maxRetries) {
      return false;
    }

    // 指数退避
    const delay = retryDelay * Math.pow(2, failureCount);
    return delay;
  };
}
