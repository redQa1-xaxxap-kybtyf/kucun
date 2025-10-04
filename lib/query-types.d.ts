/**
 * TanStack Query 全局类型增强
 *
 * 通过 TypeScript 的模块增强功能，为整个应用提供类型安全的 Query Keys
 *
 * @see https://tanstack.com/query/v5/docs/framework/react/typescript
 */

import '@tanstack/react-query';

/**
 * Query Key 的基础类型
 *
 * 所有 Query Keys 必须以特定的模块名称开头，确保类型安全
 */
type QueryKeyPrefix =
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'sales-orders'
  | 'return-orders'
  | 'inventory'
  | 'finance'
  | 'factory-shipments'
  | 'dashboard'
  | 'users'
  | 'categories'
  | 'payments'
  | 'payables'
  | 'payments-out'
  | 'refunds'
  | 'receivables'
  | 'statements'
  | 'adjustments'
  | 'inbound'
  | 'outbound'
  | 'system-logs'
  | 'product-search'
  | 'navigation-badges'
  | 'customer-price-history'
  | 'supplier-price-history'
  | 'variant-inventory-summary'
  | 'factory-shipment-orders'
  | 'factory-shipment-order'
  | 'outbound-records'
  | 'settings';

/**
 * 全局 Query Key 类型
 *
 * 所有 Query Keys 必须以 QueryKeyPrefix 开头，后面可以跟任意数量的参数
 */
type GlobalQueryKey = readonly [QueryKeyPrefix, ...ReadonlyArray<unknown>];

/**
 * 全局 Mutation Key 类型
 *
 * 所有 Mutation Keys 也遵循相同的命名规范
 */
type GlobalMutationKey = readonly [QueryKeyPrefix, ...ReadonlyArray<unknown>];

/**
 * 全局 Meta 类型
 *
 * 用于在 Query 和 Mutation 中存储额外的元数据
 */
interface GlobalMeta extends Record<string, unknown> {
  /**
   * 操作描述，用于日志记录
   */
  description?: string;

  /**
   * 是否需要认证
   */
  requiresAuth?: boolean;

  /**
   * 缓存时间（毫秒）
   */
  cacheTime?: number;

  /**
   * 是否在后台自动重新验证
   */
  revalidateInBackground?: boolean;
}

/**
 * 模块增强：注册全局类型
 */
declare module '@tanstack/react-query' {
  interface Register {
    /**
     * 全局 Query Key 类型
     *
     * 所有 useQuery、useMutation 等 hooks 都会使用这个类型
     */
    queryKey: GlobalQueryKey;

    /**
     * 全局 Mutation Key 类型
     */
    mutationKey: GlobalMutationKey;

    /**
     * 全局 Meta 类型
     *
     * 可以在 Query 和 Mutation 的 meta 字段中使用
     */
    queryMeta: GlobalMeta;
    mutationMeta: GlobalMeta;

    /**
     * 默认错误类型
     *
     * 所有 Query 和 Mutation 的错误都会使用这个类型
     */
    defaultError: Error;
  }
}

/**
 * 导出类型供其他文件使用
 */
export type { GlobalMeta, GlobalMutationKey, GlobalQueryKey, QueryKeyPrefix };
