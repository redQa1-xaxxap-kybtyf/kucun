/**
 * 统一的筛选配置文件
 * 集中管理所有模块的筛选器配置，确保一致性和可维护性
 */

// ==================== 库存模块配置 ====================

/**
 * 库存总览筛选配置
 * ✅ Bug修复：补全所有排序选项，与后端 buildOrderByClause 保持一致
 * ⚠️ 注意：Inventory表没有created_at字段，只有updated_at
 */
export const INVENTORY_FILTER_CONFIG = {
  filters: [
    {
      key: 'categoryId' as const,
      label: '分类',
      width: 'w-[140px]' as const,
    },
    {
      key: 'sortBy' as const,
      label: '排序',
      options: [
        { label: '更新时间', value: 'updatedAt' },
        { label: '库存数量', value: 'quantity' },
        { label: '预留数量', value: 'reservedQuantity' }, // ✅ 新增
        { label: '批次号', value: 'batchNumber' }, // ✅ 新增
        { label: '存储位置', value: 'location' }, // ✅ 新增
      ],
      width: 'w-[140px]' as const,
    },
  ],
  searchPlaceholder: '搜索产品名称、编码...',
  dateRangeLabel: '更新时间',
  dateRangePlaceholder: '选择更新时间范围',
};

// ==================== 销售模块配置 ====================

/**
 * 销售订单筛选配置
 */
export const SALES_ORDER_FILTER_CONFIG = {
  filters: [
    {
      key: 'status',
      label: '订单状态',
      options: [
        { label: '草稿', value: 'draft' },
        { label: '已确认', value: 'confirmed' },
        { label: '已发货', value: 'shipped' },
        { label: '已完成', value: 'completed' },
        { label: '已取消', value: 'cancelled' },
      ],
      width: 'w-[140px]',
    },
    {
      key: 'paymentStatus',
      label: '付款状态',
      options: [
        { label: '未付款', value: 'unpaid' },
        { label: '部分付款', value: 'partial' },
        { label: '已付款', value: 'paid' },
      ],
      width: 'w-[140px]',
    },
    {
      key: 'deliveryStatus',
      label: '发货状态',
      options: [
        { label: '未发货', value: 'pending' },
        { label: '部分发货', value: 'partial' },
        { label: '已发货', value: 'shipped' },
      ],
      width: 'w-[140px]',
    },
  ],
  searchPlaceholder: '搜索订单号、客户名称、产品编码...',
  dateRangeLabel: '订单日期',
  dateRangePlaceholder: '选择订单日期范围',
};

/**
 * 退货订单筛选配置
 */
export const RETURN_ORDER_FILTER_CONFIG = {
  filters: [
    {
      key: 'status',
      label: '退货状态',
      options: [
        { label: '待审核', value: 'pending' },
        { label: '已批准', value: 'approved' },
        { label: '已拒绝', value: 'rejected' },
        { label: '处理中', value: 'processing' },
        { label: '已完成', value: 'completed' },
      ],
      width: 'w-[140px]',
    },
    {
      key: 'refundStatus',
      label: '退款状态',
      options: [
        { label: '未退款', value: 'pending' },
        { label: '部分退款', value: 'partial' },
        { label: '已退款', value: 'refunded' },
      ],
      width: 'w-[140px]',
    },
  ],
  searchPlaceholder: '搜索退货单号、客户名称...',
  dateRangeLabel: '退货日期',
  dateRangePlaceholder: '选择退货日期范围',
};

// ==================== 产品模块配置 ====================

/**
 * 产品管理筛选配置
 */
export const PRODUCT_FILTER_CONFIG = {
  filters: [
    {
      key: 'categoryId',
      label: '产品分类',
      width: 'w-[140px]',
    },
    {
      key: 'status',
      label: '产品状态',
      options: [
        { label: '启用', value: 'active' },
        { label: '停用', value: 'inactive' },
      ],
      width: 'w-[140px]',
    },
  ],
  searchPlaceholder: '搜索产品编码、名称或规格...',
};

// ==================== 客户模块配置 ====================

/**
 * 客户管理筛选配置
 */
export const CUSTOMER_FILTER_CONFIG = {
  filters: [
    {
      key: 'sortBy',
      label: '排序方式',
      options: [
        { label: '创建时间', value: 'createdAt' },
        { label: '更新时间', value: 'updatedAt' },
        { label: '客户名称', value: 'name' },
        { label: '订单数量', value: 'totalOrders' },
        { label: '订单金额', value: 'totalAmount' },
        { label: '应收款', value: 'receivableAmount' },
        { label: '已收款', value: 'receivedAmount' },
        { label: '信用额度', value: 'creditLimit' },
      ],
      width: 'w-[140px]',
    },
  ],
  searchPlaceholder: '搜索客户名称、编码、联系人...',
};

// ==================== 类型导出 ====================

export type FilterConfigKey =
  | 'inventory'
  | 'salesOrder'
  | 'returnOrder'
  | 'product'
  | 'customer';

export const FILTER_CONFIGS = {
  inventory: INVENTORY_FILTER_CONFIG,
  salesOrder: SALES_ORDER_FILTER_CONFIG,
  returnOrder: RETURN_ORDER_FILTER_CONFIG,
  product: PRODUCT_FILTER_CONFIG,
  customer: CUSTOMER_FILTER_CONFIG,
};
