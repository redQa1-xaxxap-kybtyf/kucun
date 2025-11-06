// 批次管理相关类型定义

/**
 * 现有批次信息
 * 用于批次匹配和选择
 */
export interface ExistingBatch {
  /** 批次号 */
  batchNumber: string;
  /** 产品ID */
  productId: string;
  /** 产品编码 */
  productCode: string;
  /** 产品名称 */
  productName: string;
  /** 规格 */
  specification: string | null;
  /** 供应商ID */
  supplierId: string;
  /** 供应商名称 */
  supplierName: string;
  /** 当前库存数量 */
  quantity: number;
  /** 单位成本 */
  unitCost: number | null;
  /** 批次创建时间 */
  createdAt: Date;
  /** 最后更新时间 */
  updatedAt: Date;
}

/**
 * 批次匹配查询参数
 */
export interface BatchMatchQuery {
  /** 产品ID */
  productId: string;
  /** 产品编码 */
  productCode: string;
  /** 供应商ID */
  supplierId: string;
  /** 规格(可选,用于更精确的匹配) */
  specification?: string;
}

/**
 * 批次匹配结果
 */
export interface BatchMatchResult {
  /** 是否找到匹配的批次 */
  hasMatch: boolean;
  /** 匹配的批次列表 */
  batches: ExistingBatch[];
  /** 匹配数量 */
  count: number;
}
