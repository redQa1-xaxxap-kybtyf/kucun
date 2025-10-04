/**
 * 缓存标签定义
 * 集中管理所有缓存标签，便于维护和失效管理
 *
 * 使用说明：
 * - 服务器组件使用 Next.js cache() + revalidateTag()
 * - 客户端使用 TanStack Query + Redis 缓存
 * - Redis 用于跨进程缓存同步和 Pub/Sub
 */

/**
 * 缓存标签类型定义
 * 格式: 'resource' | 'resource:id' | 'resource:relation'
 */
export const CacheTags = {
  // ==================== 产品相关 ====================
  Products: {
    all: 'products' as const,
    list: 'products:list' as const,
    detail: (id: string) => `products:${id}` as const,
    search: 'products:search' as const,
    variants: (id: string) => `products:${id}:variants` as const,
  },

  // ==================== 库存相关 ====================
  Inventory: {
    all: 'inventory' as const,
    list: 'inventory:list' as const,
    summary: (productId: string) => `inventory:summary:${productId}` as const,
    detail: (id: string) => `inventory:${id}` as const,
    adjustments: 'inventory:adjustments' as const,
    alerts: 'inventory:alerts' as const,
  },

  // ==================== 客户相关 ====================
  Customers: {
    all: 'customers' as const,
    list: 'customers:list' as const,
    detail: (id: string) => `customers:${id}` as const,
    search: 'customers:search' as const,
    hierarchy: (id: string) => `customers:${id}:hierarchy` as const,
  },

  // ==================== 供应商相关 ====================
  Suppliers: {
    all: 'suppliers' as const,
    list: 'suppliers:list' as const,
    detail: (id: string) => `suppliers:${id}` as const,
    search: 'suppliers:search' as const,
  },

  // ==================== 订单相关 ====================
  SalesOrders: {
    all: 'sales-orders' as const,
    list: 'sales-orders:list' as const,
    detail: (id: string) => `sales-orders:${id}` as const,
    items: (id: string) => `sales-orders:${id}:items` as const,
    stats: 'sales-orders:stats' as const,
  },

  ReturnOrders: {
    all: 'return-orders' as const,
    list: 'return-orders:list' as const,
    detail: (id: string) => `return-orders:${id}` as const,
    stats: 'return-orders:stats' as const,
  },

  // ==================== 财务相关 ====================
  Finance: {
    all: 'finance' as const,
    overview: 'finance:overview' as const,

    // 应收款
    receivables: 'finance:receivables' as const,
    receivablesList: 'finance:receivables:list' as const,
    receivablesStats: 'finance:receivables:stats' as const,
    receivable: (id: string) => `finance:receivables:${id}` as const,

    // 应付款
    payables: 'finance:payables' as const,
    payablesList: 'finance:payables:list' as const,
    payablesStats: 'finance:payables:stats' as const,
    payable: (id: string) => `finance:payables:${id}` as const,

    // 退款
    refunds: 'finance:refunds' as const,
    refundsList: 'finance:refunds:list' as const,
    refundsStats: 'finance:refunds:stats' as const,
    refund: (id: string) => `finance:refunds:${id}` as const,

    // 收付款
    payments: 'finance:payments' as const,
    paymentsOut: 'finance:payments-out' as const,

    // 往来账单
    statements: 'finance:statements' as const,
    statementsList: 'finance:statements:list' as const,
    statement: (id: string) => `finance:statements:${id}` as const,
  },

  // ==================== 仓库发货 ====================
  Shipments: {
    all: 'shipments' as const,
    list: 'shipments:list' as const,
    detail: (id: string) => `shipments:${id}` as const,
    stats: 'shipments:stats' as const,
  },

  // ==================== 分类相关 ====================
  Categories: {
    all: 'categories' as const,
    list: 'categories:list' as const,
    detail: (id: string) => `categories:${id}` as const,
    tree: 'categories:tree' as const,
  },

  // ==================== 仪表盘 ====================
  Dashboard: {
    all: 'dashboard' as const,
    overview: 'dashboard:overview' as const,
    stats: 'dashboard:stats' as const,
    alerts: 'dashboard:alerts' as const,
    todos: 'dashboard:todos' as const,
    quickActions: 'dashboard:quick-actions' as const,
  },

  // ==================== 系统设置 ====================
  Settings: {
    all: 'settings' as const,
    basic: 'settings:basic' as const,
    users: 'settings:users' as const,
    storage: 'settings:storage' as const,
    logs: 'settings:logs' as const,
  },
} as const;

/**
 * 缓存标签类型（用于类型推断）
 * 支持字符串常量和函数返回值
 */
export type CacheTag = string;

/**
 * Redis 缓存键前缀（用于 Redis 命名空间）
 */
export const RedisCachePrefix = {
  // API 响应缓存
  api: 'api:',

  // 查询结果缓存
  query: 'query:',

  // 统计数据缓存
  stats: 'stats:',

  // 会话缓存
  session: 'session:',

  // 锁机制
  lock: 'lock:',

  // Pub/Sub 频道
  channel: 'channel:',
} as const;

/**
 * 将缓存标签转换为 Redis 键
 */
export function tagToRedisKey(
  tag: string,
  prefix: string = RedisCachePrefix.query
): string {
  return `${prefix}${tag}`;
}

/**
 * 从 Redis 键解析出标签
 */
export function redisKeyToTag(key: string): string {
  return key.replace(/^[^:]+:/, '');
}
