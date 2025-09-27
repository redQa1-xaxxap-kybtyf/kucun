/**
 * 批次规格参数类型定义
 * 用于管理产品在不同批次中的具体规格参数
 */

// 批次规格参数基础类型
export interface BatchSpecification {
  /** 批次规格参数唯一标识符 */
  id: string;
  /** 产品ID */
  productId: string;
  /** 批次号 */
  batchNumber: string;
  /** 每单位片数 */
  piecesPerUnit: number;
  /** 产品重量(kg) */
  weight?: number;
  /** 产品厚度(mm) */
  thickness?: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;

  // 关联数据（可选，根据查询需要包含）
  product?: import('./product').Product;
  inboundRecords?: import('./inbound').InboundRecord[];
}

// 创建批次规格参数的请求数据
export interface CreateBatchSpecificationRequest {
  /** 产品ID */
  productId: string;
  /** 批次号 */
  batchNumber: string;
  /** 每单位片数 */
  piecesPerUnit: number;
  /** 产品重量(kg) */
  weight?: number;
  /** 产品厚度(mm) */
  thickness?: number;
}

// 更新批次规格参数的请求数据
export interface UpdateBatchSpecificationRequest {
  /** 每单位片数 */
  piecesPerUnit?: number;
  /** 产品重量(kg) */
  weight?: number;
  /** 产品厚度(mm) */
  thickness?: number;
}

// 批次规格参数查询参数
export interface BatchSpecificationQueryParams {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  limit?: number;
  /** 搜索关键词 */
  search?: string;
  /** 产品ID */
  productId?: string;
  /** 批次号 */
  batchNumber?: string;
  /** 排序字段 */
  sortBy?: 'createdAt' | 'batchNumber' | 'piecesPerUnit' | 'weight';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

// 批次规格参数列表响应
export interface BatchSpecificationListResponse {
  /** 是否成功 */
  success: boolean;
  /** 批次规格参数列表 */
  data: BatchSpecification[];
  /** 分页信息 */
  pagination: {
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    limit: number;
    /** 总记录数 */
    total: number;
    /** 总页数 */
    totalPages: number;
  };
}

// 批次规格参数详情响应
export interface BatchSpecificationResponse {
  /** 是否成功 */
  success: boolean;
  /** 批次规格参数详情 */
  data: BatchSpecification;
}

// 批次规格参数错误响应
export interface BatchSpecificationErrorResponse {
  /** 是否成功 */
  success: false;
  /** 错误信息 */
  error: string;
  /** 详细错误信息 */
  details?: string[];
}

// 批次规格参数统计信息
export interface BatchSpecificationStatistics {
  /** 总批次数 */
  totalBatches: number;
  /** 不同规格数量 */
  uniqueSpecifications: number;
  /** 平均每单位片数 */
  averagePiecesPerUnit: number;
  /** 平均重量 */
  averageWeight?: number;
  /** 重量范围 */
  weightRange?: {
    min: number;
    max: number;
  };
}

// 批次规格参数历史记录
export interface BatchSpecificationHistory {
  /** 产品ID */
  productId: string;
  /** 产品信息 */
  product: import('./product').Product;
  /** 批次规格参数列表 */
  specifications: BatchSpecification[];
  /** 统计信息 */
  statistics: BatchSpecificationStatistics;
}

// 批次规格参数对比数据
export interface BatchSpecificationComparison {
  /** 对比的批次规格参数列表 */
  specifications: BatchSpecification[];
  /** 差异分析 */
  differences: {
    /** 每单位片数差异 */
    piecesPerUnitRange: {
      min: number;
      max: number;
      variance: number;
    };
    /** 重量差异 */
    weightRange?: {
      min: number;
      max: number;
      variance: number;
    };
    /** 厚度差异 */
    thicknessRange?: {
      min: number;
      max: number;
      variance: number;
    };
  };
}

// 批次规格参数操作结果
export interface BatchSpecificationOperationResult {
  /** 是否成功 */
  success: boolean;
  /** 批次规格参数信息 */
  specification?: BatchSpecification;
  /** 操作消息 */
  message?: string;
  /** 错误信息 */
  error?: string;
}
