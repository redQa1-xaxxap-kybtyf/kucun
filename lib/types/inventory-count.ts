// 库存盘点相关类型定义
// 遵循命名约定：数据库 snake_case → API camelCase → 前端 camelCase

import type { Category } from './category';
import type { Product, ProductVariant } from './product';
import type { User } from './user';

// 盘点类型枚举
export type CountType =
  | 'full' // 全盘
  | 'partial' // 抽盘
  | 'cycle'; // 循环盘点

// 盘点类型标签映射
export const COUNT_TYPE_LABELS: Record<CountType, string> = {
  full: '全盘',
  partial: '抽盘',
  cycle: '循环盘点',
};

// 盘点类型选项
export const COUNT_TYPE_OPTIONS = Object.entries(COUNT_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as CountType, label })
);

// 盘点状态枚举
export type CountStatus =
  | 'draft' // 草稿
  | 'in_progress' // 进行中
  | 'completed' // 已完成
  | 'cancelled'; // 已取消

// 盘点状态标签映射
export const COUNT_STATUS_LABELS: Record<CountStatus, string> = {
  draft: '草稿',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

// 盘点状态选项
export const COUNT_STATUS_OPTIONS = Object.entries(COUNT_STATUS_LABELS).map(
  ([value, label]) => ({ value: value as CountStatus, label })
);

// 盘点状态颜色映射
export const COUNT_STATUS_COLORS: Record<CountStatus, string> = {
  draft: 'gray',
  in_progress: 'blue',
  completed: 'green',
  cancelled: 'red',
};

// 盘点明细状态枚举
export type CountItemStatus =
  | 'pending' // 待盘点
  | 'counted' // 已盘点
  | 'adjusted'; // 已调整

// 盘点明细状态标签映射
export const COUNT_ITEM_STATUS_LABELS: Record<CountItemStatus, string> = {
  pending: '待盘点',
  counted: '已盘点',
  adjusted: '已调整',
};

// 盘点明细状态选项
export const COUNT_ITEM_STATUS_OPTIONS = Object.entries(
  COUNT_ITEM_STATUS_LABELS
).map(([value, label]) => ({ value: value as CountItemStatus, label }));

// 盘点明细状态颜色映射
export const COUNT_ITEM_STATUS_COLORS: Record<CountItemStatus, string> = {
  pending: 'gray',
  counted: 'blue',
  adjusted: 'green',
};

// 基础盘点计划类型（对应数据库模型）
export interface InventoryCount {
  id: string;
  countNumber: string;
  countName: string;
  countType: CountType;
  status: CountStatus;

  // 盘点范围
  location?: string;
  categoryId?: string;

  // 盘点时间
  planDate: string; // ISO日期字符串
  startDate?: string; // ISO日期字符串
  endDate?: string; // ISO日期字符串

  // 盘点结果统计
  totalItems: number;
  completedItems: number;
  differenceItems: number;
  totalDifference: number;

  // 备注和附件
  remarks?: string;
  attachments?: string; // JSON字符串

  // 审计字段
  creatorId: string;
  operatorId?: string;
  approverId?: string;
  approvedAt?: string; // ISO日期字符串
  createdAt: string; // ISO日期字符串
  updatedAt: string; // ISO日期字符串

  // 关联数据（可选，根据查询需要包含）
  category?: Pick<Category, 'id' | 'name' | 'code'>;
  creator?: Pick<User, 'id' | 'name' | 'email'>;
  operator?: Pick<User, 'id' | 'name' | 'email'>;
  approver?: Pick<User, 'id' | 'name' | 'email'>;
  items?: InventoryCountItem[];
}

// 基础盘点明细类型（对应数据库模型）
export interface InventoryCountItem {
  id: string;
  countId: string;
  productId: string;
  variantId?: string;
  batchNumber?: string;

  // 盘点数据
  systemQuantity: number;
  actualQuantity?: number;
  difference: number;

  // 盘点状态
  status: CountItemStatus;

  // 成本信息
  unitCost?: number;
  totalCost?: number;

  // 盘点位置和备注
  location?: string;
  remarks?: string;

  // 盘点人和时间
  countedBy?: string;
  countedAt?: string; // ISO日期字符串

  // 审计字段
  createdAt: string; // ISO日期字符串
  updatedAt: string; // ISO日期字符串

  // 关联数据（可选，根据查询需要包含）
  // ✅ 补充每件片数，便于“件/片”统一展示
  product?: Pick<
    Product,
    'id' | 'code' | 'name' | 'unit' | 'piecesPerUnit' | 'specification'
  >;
  /** 批次规格参数（如果存在），用于覆盖产品级 piecesPerUnit */
  batchSpecification?: Pick<
    import('./batch-specification').BatchSpecification,
    'id' | 'batchNumber' | 'piecesPerUnit' | 'weight' | 'thickness'
  >;
  variant?: Pick<ProductVariant, 'id' | 'colorCode' | 'colorName' | 'sku'>;
  counter?: Pick<User, 'id' | 'name' | 'email'>;
}

// 创建盘点计划的请求数据
export interface CreateInventoryCountRequest {
  countName: string;
  countType: CountType;
  planDate: string; // ISO日期字符串

  // 盘点范围
  location?: string;
  categoryId?: string;

  // 备注和附件
  remarks?: string;
  attachments?: string; // JSON字符串

  // 盘点明细（可选）
  items?: {
    productId: string;
    variantId?: string;
    batchNumber?: string;
    systemQuantity: number;
    actualQuantity?: number;
    location?: string;
    remarks?: string;
  }[];
}

// 更新盘点计划的请求数据
export interface UpdateInventoryCountRequest {
  countName?: string;
  countType?: CountType;
  planDate?: string; // ISO日期字符串
  location?: string;
  categoryId?: string;
  status?: CountStatus;
  remarks?: string;
  attachments?: string; // JSON字符串
}

// 提交盘点数据的请求
export interface SubmitCountDataRequest {
  items: {
    id: string;
    actualQuantity: number;
    remarks?: string;
  }[];
}

// 盘点查询参数
export interface InventoryCountQueryParams {
  search?: string;
  status?: CountStatus;
  countType?: CountType;
  location?: string;
  categoryId?: string;
  startDate?: string; // ISO日期字符串
  endDate?: string; // ISO日期字符串
  page?: number;
  pageSize?: number;
  sortBy?: 'planDate' | 'createdAt' | 'countNumber';
  sortOrder?: 'asc' | 'desc';
}

// 盘点计划列表项（用于列表页展示）
export interface InventoryCountListItem {
  id: string;
  countNumber: string;
  countName: string;
  countType: CountType;
  countTypeName: string;
  status: CountStatus;
  statusName: string;
  planDate: string;
  location?: string;
  categoryName?: string;
  totalItems: number;
  completedItems: number;
  differenceItems: number;
  progress: number; // 完成进度百分比
  creatorName: string;
  createdAt: string;
}

// 盘点计划详情（包含完整信息）
export interface InventoryCountDetail extends InventoryCount {
  items: InventoryCountItem[];
}

// 盘点计划列表响应
export interface InventoryCountListResponse {
  data: InventoryCountListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// 盘点统计数据
export interface InventoryCountStatistics {
  // 总览数据
  totalCounts: number; // 盘点计划总数
  draftCounts: number; // 草稿数量
  inProgressCounts: number; // 进行中数量
  completedCounts: number; // 已完成数量

  // 盘点项目统计
  totalItems: number; // 盘点项目总数
  completedItems: number; // 已完成项目数
  differenceItems: number; // 有差异项目数

  // 差异统计
  totalDifference: number; // 总差异数量（绝对值）
  totalDifferenceCost: number; // 总差异成本

  // 按类型分组
  byType: {
    countType: CountType;
    countTypeName: string;
    count: number;
    percentage: number;
  }[];

  // 时间范围
  startDate?: string;
  endDate?: string;
}

// 盘点表单数据
export interface InventoryCountFormData {
  countName: string;
  countType: CountType;
  planDate?: string;
  location?: string;
  categoryId?: string;
  remarks?: string;
  attachments?: string;
}

// 盘点操作结果
export interface InventoryCountOperationResult {
  success: boolean;
  count?: InventoryCount;
  message?: string;
  error?: string;
}

// 盘点附件类型
export interface InventoryCountAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

// 盘点附件列表（从 attachments JSON 字符串解析）
export type InventoryCountAttachmentList = InventoryCountAttachment[];
