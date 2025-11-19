/**
 * 库存统计类型定义
 */

/**
 * 库存统计数据
 * 注意：财务相关字段（totalValue, openingBalance）仅对拥有 finance:view 权限的用户可见
 */
export interface InventoryStatistics {
  // 库存总览
  totalProducts: number; // 库存产品数量（SKU数）
  totalQuantity: number; // 库存总数量（片数）
  totalValue?: number; // 库存总金额（当前库存价值）- 需要 finance:view 权限

  // 期初库存 - 需要 finance:view 权限
  openingBalance?: {
    totalCost: number; // 期初入库总成本
    totalQuantity: number; // 期初入库总数量
    recordCount: number; // 期初入库记录数
  };

  // 库存健康度
  lowStockCount: number; // 低库存产品数量
  stockHealthPercentage: number; // 库存健康度百分比
}

/**
 * 库存统计查询参数
 */
export interface InventoryStatisticsParams {
  categoryId?: string; // 按分类筛选
}
