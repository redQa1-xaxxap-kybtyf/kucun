/**
 * 缓存失效辅助函数
 * 统一管理常见的缓存刷新模式，避免重复代码
 *
 * @module lib/cache/invalidation-helpers
 */

import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';

/**
 * 刷新销售订单相关缓存
 * 包括：销售订单列表、详情、统计、应收款、仪表盘
 *
 * @param queryClient - TanStack Query Client 实例
 *
 * @example
 * ```typescript
 * import { invalidateSalesOrderCaches } from '@/lib/cache/invalidation-helpers';
 *
 * const mutation = useMutation({
 *   mutationFn: createSalesOrder,
 *   onSuccess: () => {
 *     invalidateSalesOrderCaches(queryClient);
 *   },
 * });
 * ```
 */
export function invalidateSalesOrderCaches(queryClient: QueryClient): void {
  // 刷新销售订单缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.salesOrders.all,
  });

  // 刷新应收款缓存（销售订单会创建应收款）
  queryClient.invalidateQueries({
    queryKey: queryKeys.finance.receivables(),
  });

  // 刷新仪表盘缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.all,
  });
}

/**
 * 刷新采购订单相关缓存
 * 包括：采购订单列表、详情、统计、应付款、仪表盘
 *
 * @param queryClient - TanStack Query Client 实例
 *
 * @example
 * ```typescript
 * import { invalidatePurchaseOrderCaches } from '@/lib/cache/invalidation-helpers';
 *
 * const mutation = useMutation({
 *   mutationFn: createPurchaseOrder,
 *   onSuccess: () => {
 *     invalidatePurchaseOrderCaches(queryClient);
 *   },
 * });
 * ```
 */
export function invalidatePurchaseOrderCaches(queryClient: QueryClient): void {
  // 刷新采购订单缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.purchaseOrders.all,
  });

  // 刷新应付款缓存（采购订单会创建应付款）
  queryClient.invalidateQueries({
    queryKey: queryKeys.finance.payables(),
  });

  // 刷新仪表盘缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.all,
  });
}

/**
 * 刷新财务相关缓存
 * 包括：应收款、应付款、收款、付款、仪表盘
 *
 * @param queryClient - TanStack Query Client 实例
 *
 * @example
 * ```typescript
 * import { invalidateFinanceCaches } from '@/lib/cache/invalidation-helpers';
 *
 * const mutation = useMutation({
 *   mutationFn: createPayment,
 *   onSuccess: () => {
 *     invalidateFinanceCaches(queryClient);
 *   },
 * });
 * ```
 */
export function invalidateFinanceCaches(queryClient: QueryClient): void {
  // 刷新应收款缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.finance.receivables(),
  });

  // 刷新应付款缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.finance.payables(),
  });

  // 刷新收款缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.finance.paymentsIn(),
  });

  // 刷新付款缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.finance.paymentsOut(),
  });

  // 刷新财务报表缓存（月报 / 年报 / 盈亏分析）
  queryClient.invalidateQueries({
    queryKey: queryKeys.finance.reports(),
    exact: false,
  });

  // 刷新仪表盘缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.all,
  });
}

/**
 * 刷新库存相关缓存
 * 包括：库存列表、统计、仪表盘
 *
 * @param queryClient - TanStack Query Client 实例
 *
 * @example
 * ```typescript
 * import { invalidateInventoryCaches } from '@/lib/cache/invalidation-helpers';
 *
 * const mutation = useMutation({
 *   mutationFn: adjustInventory,
 *   onSuccess: () => {
 *     invalidateInventoryCaches(queryClient);
 *   },
 * });
 * ```
 */
export function invalidateInventoryCaches(queryClient: QueryClient): void {
  // 刷新库存缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.inventory.all,
  });

  // 刷新仪表盘缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.all,
  });
}

/**
 * 刷新仪表盘缓存
 * 包括：仪表盘所有数据
 *
 * @param queryClient - TanStack Query Client 实例
 *
 * @example
 * ```typescript
 * import { invalidateDashboardCaches } from '@/lib/cache/invalidation-helpers';
 *
 * const mutation = useMutation({
 *   mutationFn: someAction,
 *   onSuccess: () => {
 *     invalidateDashboardCaches(queryClient);
 *   },
 * });
 * ```
 */
export function invalidateDashboardCaches(queryClient: QueryClient): void {
  queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.all,
  });
}

/**
 * 刷新客户直发订单相关缓存
 * 包括：销售订单、采购订单、应收款、应付款、仪表盘
 *
 * 客户直发订单会同时创建销售订单和采购订单，因此需要刷新两者的缓存
 *
 * @param queryClient - TanStack Query Client 实例
 *
 * @example
 * ```typescript
 * import { invalidateCustomerDirectShipmentCaches } from '@/lib/cache/invalidation-helpers';
 *
 * const mutation = useMutation({
 *   mutationFn: createCustomerDirectShipmentOrder,
 *   onSuccess: () => {
 *     invalidateCustomerDirectShipmentCaches(queryClient);
 *   },
 * });
 * ```
 */
export function invalidateCustomerDirectShipmentCaches(
  queryClient: QueryClient
): void {
  // 刷新销售订单缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.salesOrders.all,
  });

  // 刷新采购订单缓存（客户直发会自动创建采购订单）
  queryClient.invalidateQueries({
    queryKey: queryKeys.purchaseOrders.all,
  });

  // 刷新应收款缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.finance.receivables(),
  });

  // 刷新应付款缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.finance.payables(),
  });

  // 刷新仪表盘缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.dashboard.all,
  });
}

/**
 * 刷新产品相关缓存
 * 包括：产品列表、详情、分类
 *
 * @param queryClient - TanStack Query Client 实例
 *
 * @example
 * ```typescript
 * import { invalidateProductCaches } from '@/lib/cache/invalidation-helpers';
 *
 * const mutation = useMutation({
 *   mutationFn: createProduct,
 *   onSuccess: () => {
 *     invalidateProductCaches(queryClient);
 *   },
 * });
 * ```
 */
export function invalidateProductCaches(queryClient: QueryClient): void {
  // 刷新产品缓存
  queryClient.invalidateQueries({
    queryKey: queryKeys.products.all,
  });

  // 刷新分类缓存（产品属于某个分类）
  queryClient.invalidateQueries({
    queryKey: queryKeys.categories.all,
  });
}
