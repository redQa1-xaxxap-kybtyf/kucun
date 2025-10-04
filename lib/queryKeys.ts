/**
 * Query Keys 集中管理
 *
 * 遵循 TanStack Query v5 最佳实践：
 * 1. 使用 Query Key Factory 模式
 * 2. 实体查询: ['entity', id]
 * 3. 列表查询: ['list', filters]
 * 4. 所有 Keys 集中定义，确保类型安全
 *
 * @see https://tanstack.com/query/v5/docs/framework/react/community/tkdodos-blog
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 分页参数类型
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  limit?: number; // 兼容旧代码
}

/**
 * 排序参数类型
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 搜索参数类型
 */
export interface SearchParams {
  search?: string;
}

/**
 * 基础过滤参数类型
 */
export type BaseFilters = PaginationParams & SortParams & SearchParams;

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * 产品相关的 Query Keys
 */
export const productKeys = {
  // 所有产品相关的查询
  all: ['products'] as const,

  // 产品列表查询
  lists: () => [...productKeys.all, 'list'] as const,
  list: (
    filters?: BaseFilters & {
      status?: string;
      categoryId?: string;
      ids?: string;
    }
  ) => [...productKeys.lists(), filters] as const,

  // 单个产品查询
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,

  // 产品库存查询
  inventory: (id: string) => [...productKeys.detail(id), 'inventory'] as const,

  // 产品变体查询
  variants: (id: string) => [...productKeys.detail(id), 'variants'] as const,

  // 变体库存汇总
  variantInventorySummary: (variantId: string) =>
    ['variant-inventory-summary', variantId] as const,

  // 产品搜索
  search: (query: string) => [...productKeys.all, 'search', query] as const,
} as const;

/**
 * 客户相关的 Query Keys
 */
export const customerKeys = {
  all: ['customers'] as const,

  lists: () => [...customerKeys.all, 'list'] as const,
  list: (
    filters?: BaseFilters & {
      type?: string;
      level?: string;
      excludeId?: string;
    }
  ) => [...customerKeys.lists(), filters] as const,

  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,

  // 客户层级关系
  hierarchy: (id: string) => [...customerKeys.detail(id), 'hierarchy'] as const,

  // 客户账单
  statements: (id: string) =>
    [...customerKeys.detail(id), 'statements'] as const,

  // 客户价格历史
  priceHistory: (params?: {
    customerId?: string;
    productId?: string;
    priceType?: string;
  }) => ['customer-price-history', params] as const,
} as const;

/**
 * 供应商相关的 Query Keys
 */
export const supplierKeys = {
  all: ['suppliers'] as const,

  lists: () => [...supplierKeys.all, 'list'] as const,
  list: (filters?: BaseFilters & { status?: string }) =>
    [...supplierKeys.lists(), filters] as const,

  details: () => [...supplierKeys.all, 'detail'] as const,
  detail: (id: string) => [...supplierKeys.details(), id] as const,

  // 供应商价格历史
  priceHistory: (params?: { supplierId?: string; productId?: string }) =>
    ['supplier-price-history', params] as const,
} as const;

/**
 * 销售订单相关的 Query Keys
 */
export const salesOrderKeys = {
  all: ['sales-orders'] as const,

  lists: () => [...salesOrderKeys.all, 'list'] as const,
  list: (filters?: BaseFilters & { status?: string; customerId?: string }) =>
    [...salesOrderKeys.lists(), filters] as const,

  details: () => [...salesOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...salesOrderKeys.details(), id] as const,

  // 订单统计
  stats: () => [...salesOrderKeys.all, 'stats'] as const,
} as const;

/**
 * 退货订单相关的 Query Keys
 */
export const returnOrderKeys = {
  all: ['return-orders'] as const,

  lists: () => [...returnOrderKeys.all, 'list'] as const,
  list: (filters?: BaseFilters & { status?: string }) =>
    [...returnOrderKeys.lists(), filters] as const,

  details: () => [...returnOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...returnOrderKeys.details(), id] as const,
} as const;

/**
 * 库存相关的 Query Keys
 */
export const inventoryKeys = {
  all: ['inventory'] as const,

  lists: () => [...inventoryKeys.all, 'list'] as const,
  list: (filters?: BaseFilters & { alertType?: string }) =>
    [...inventoryKeys.lists(), filters] as const,

  // 库存详情
  details: () => [...inventoryKeys.all, 'detail'] as const,
  detail: (productId: string) =>
    [...inventoryKeys.details(), productId] as const,

  // 库存统计
  stats: () => [...inventoryKeys.all, 'stats'] as const,

  // 库存预警
  alerts: () => [...inventoryKeys.all, 'alerts'] as const,

  // 库存调整记录
  adjustments: () => [...inventoryKeys.all, 'adjustments'] as const,
  adjustment: (id: string) => [...inventoryKeys.adjustments(), id] as const,

  // 入库记录
  inbounds: () => [...inventoryKeys.all, 'inbounds'] as const,
  inboundsList: (params?: BaseFilters) =>
    [...inventoryKeys.inbounds(), 'list', params] as const,
  inbound: (id: string) => [...inventoryKeys.inbounds(), id] as const,
  inboundStats: () => [...inventoryKeys.inbounds(), 'stats'] as const,

  // 出库记录
  outbounds: () => [...inventoryKeys.all, 'outbounds'] as const,
  outbound: (id: string) => [...inventoryKeys.outbounds(), id] as const,

  // 库存可用性检查
  availability: (productId: string, variantId?: string) =>
    [...inventoryKeys.all, 'availability', productId, variantId] as const,
} as const;

/**
 * 财务相关的 Query Keys
 */
export const financeKeys = {
  all: ['finance'] as const,

  // 应收款
  receivables: () => [...financeKeys.all, 'receivables'] as const,
  receivablesList: (filters?: BaseFilters & { status?: string }) =>
    [...financeKeys.receivables(), 'list', filters] as const,
  receivable: (id: string) => [...financeKeys.receivables(), id] as const,

  // 应付款
  payables: () => [...financeKeys.all, 'payables'] as const,
  payable: (id: string) => [...financeKeys.payables(), id] as const,

  // 收款记录
  paymentsIn: () => [...financeKeys.all, 'payments-in'] as const,
  paymentIn: (id: string) => [...financeKeys.paymentsIn(), id] as const,

  // 付款记录
  paymentsOut: () => [...financeKeys.all, 'payments-out'] as const,
  paymentOut: (id: string) => [...financeKeys.paymentsOut(), id] as const,

  // 账单
  statements: () => [...financeKeys.all, 'statements'] as const,
  statementsList: (
    filters?: BaseFilters & { type?: string; status?: string }
  ) => [...financeKeys.statements(), 'list', filters] as const,
  statement: (id: string) => [...financeKeys.statements(), id] as const,

  // 退款记录
  refunds: () => [...financeKeys.all, 'refunds'] as const,
  refundsList: (filters?: BaseFilters & { status?: string }) =>
    [...financeKeys.refunds(), 'list', filters] as const,
  refund: (id: string) => [...financeKeys.refunds(), id] as const,

  // 财务统计
  stats: () => [...financeKeys.all, 'stats'] as const,
  overview: () => [...financeKeys.all, 'overview'] as const,
} as const;

/**
 * 厂家发货相关的 Query Keys
 */
export const factoryShipmentKeys = {
  all: ['factory-shipments'] as const,

  lists: () => [...factoryShipmentKeys.all, 'list'] as const,
  list: (filters?: BaseFilters & { status?: string }) =>
    [...factoryShipmentKeys.lists(), filters] as const,

  details: () => [...factoryShipmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...factoryShipmentKeys.details(), id] as const,

  // 厂家发货订单
  orders: () => [...factoryShipmentKeys.all, 'orders'] as const,
  ordersList: (filters?: BaseFilters & { status?: string }) =>
    [...factoryShipmentKeys.orders(), 'list', filters] as const,
  order: (id: string) => [...factoryShipmentKeys.orders(), id] as const,
} as const;

/**
 * 仪表盘相关的 Query Keys
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,

  // 业务概览
  overview: () => [...dashboardKeys.all, 'overview'] as const,

  // 核心指标
  metrics: () => [...dashboardKeys.all, 'metrics'] as const,

  // 最近活动
  activities: () => [...dashboardKeys.all, 'activities'] as const,

  // 导航徽章
  navigationBadges: () => ['navigation-badges'] as const,
} as const;

/**
 * 用户相关的 Query Keys
 */
export const userKeys = {
  all: ['users'] as const,

  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters?: BaseFilters & { role?: string; status?: string }) =>
    [...userKeys.lists(), filters] as const,

  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,

  // 当前用户
  current: () => [...userKeys.all, 'current'] as const,
} as const;

/**
 * 分类相关的 Query Keys
 */
export const categoryKeys = {
  all: ['categories'] as const,

  lists: () => [...categoryKeys.all, 'list'] as const,
  list: (filters?: BaseFilters & { status?: string; exclude?: string }) =>
    [...categoryKeys.lists(), filters] as const,

  details: () => [...categoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...categoryKeys.details(), id] as const,
} as const;

/**
 * 分类相关的 Query Keys (已存在但未导出)
 */
export const categoriesKeys = categoryKeys;

/**
 * 收款记录相关的 Query Keys
 */
export const paymentKeys = {
  all: ['payments'] as const,

  lists: () => [...paymentKeys.all, 'list'] as const,
  list: (filters?: BaseFilters & { status?: string; paymentMethod?: string }) =>
    [...paymentKeys.lists(), filters] as const,

  details: () => [...paymentKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentKeys.details(), id] as const,

  // 应收账款
  accountsReceivable: () =>
    [...paymentKeys.all, 'accounts-receivable'] as const,

  // 统计数据
  statistics: () => [...paymentKeys.all, 'statistics'] as const,

  // 销售订单的收款记录
  salesOrderPayments: (salesOrderId: string) =>
    [...paymentKeys.all, 'sales-order', salesOrderId] as const,

  // 客户的收款记录
  customerPayments: (customerId: string) =>
    [...paymentKeys.all, 'customer', customerId] as const,
} as const;

/**
 * 应付款相关的 Query Keys
 */
export const payableKeys = {
  all: ['payables'] as const,

  lists: () => [...payableKeys.all, 'list'] as const,
  list: (filters?: BaseFilters & { status?: string }) =>
    [...payableKeys.lists(), filters] as const,

  details: () => [...payableKeys.all, 'detail'] as const,
  detail: (id: string) => [...payableKeys.details(), id] as const,

  // 统计数据
  statistics: () => [...payableKeys.all, 'statistics'] as const,
} as const;

/**
 * 付款记录相关的 Query Keys
 */
export const paymentOutKeys = {
  all: ['payments-out'] as const,

  lists: () => [...paymentOutKeys.all, 'list'] as const,
  list: (filters?: BaseFilters & { status?: string }) =>
    [...paymentOutKeys.lists(), filters] as const,

  details: () => [...paymentOutKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentOutKeys.details(), id] as const,
} as const;

/**
 * 系统设置相关的 Query Keys
 */
export const settingsKeys = {
  all: ['settings'] as const,

  // 基本设置
  basic: () => [...settingsKeys.all, 'basic'] as const,

  // 系统日志
  logs: () => [...settingsKeys.all, 'logs'] as const,

  // 系统配置
  config: () => [...settingsKeys.all, 'config'] as const,

  // 存储配置
  storage: () => [...settingsKeys.all, 'storage'] as const,
} as const;

// ============================================================================
// 导出所有 Query Keys
// ============================================================================

/**
 * 所有 Query Keys 的集合
 *
 * 使用示例：
 * ```ts
 * import { queryKeys } from '@/lib/queryKeys';
 *
 * // 查询产品列表
 * useQuery({
 *   queryKey: queryKeys.products.list({ page: 1, pageSize: 20 }),
 *   queryFn: fetchProducts,
 * });
 *
 * // 查询单个产品
 * useQuery({
 *   queryKey: queryKeys.products.detail('product-id'),
 *   queryFn: () => fetchProduct('product-id'),
 * });
 *
 * // 失效产品相关的所有查询
 * queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
 * ```
 */
export const queryKeys = {
  products: productKeys,
  customers: customerKeys,
  suppliers: supplierKeys,
  salesOrders: salesOrderKeys,
  returnOrders: returnOrderKeys,
  inventory: inventoryKeys,
  finance: financeKeys,
  factoryShipments: factoryShipmentKeys,
  dashboard: dashboardKeys,
  users: userKeys,
  categories: categoriesKeys,
  payments: paymentKeys,
  payables: payableKeys,
  paymentsOut: paymentOutKeys,
  settings: settingsKeys,
} as const;
