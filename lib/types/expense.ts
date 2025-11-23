// 费用记录相关类型定义
// 遵循命名约定：数据库 snake_case → API camelCase → 前端 camelCase

import type { User } from './user';

// 费用类型枚举
export type ExpenseType =
  | 'shipping' // 运费
  | 'storage' // 仓储费
  | 'labor' // 人工费
  | 'travel' // 差旅费
  | 'living' // 生活费
  | 'loading_unloading' // 装卸费
  | 'other'; // 其他费用

// 费用类型标签映射
export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  shipping: '运费',
  storage: '仓储费',
  labor: '人工费',
  travel: '差旅费',
  living: '生活费',
  loading_unloading: '装卸费',
  other: '其他费用',
};

// 费用类型选项
export const EXPENSE_TYPE_OPTIONS = Object.entries(EXPENSE_TYPE_LABELS).map(
  ([value, label]) => ({ value: value as ExpenseType, label })
);

// 费用状态枚举
export type ExpenseStatus = 'draft' | 'approved' | 'cancelled';

// 费用状态标签映射
export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: '草稿',
  approved: '已审核',
  cancelled: '已作废',
};

// 关联业务类型枚举
export type ExpenseRelatedType =
  | 'inbound' // 入库记录
  | 'outbound' // 出库记录
  | 'sales_order' // 销售订单
  | 'purchase_order' // 采购订单
  | null; // 无关联

// 关联业务类型标签映射
export const EXPENSE_RELATED_TYPE_LABELS: Record<
  Exclude<ExpenseRelatedType, null>,
  string
> = {
  inbound: '入库记录',
  outbound: '出库记录',
  sales_order: '销售订单',
  purchase_order: '采购订单',
};

// 关联业务类型选项
export const EXPENSE_RELATED_TYPE_OPTIONS = Object.entries(
  EXPENSE_RELATED_TYPE_LABELS
).map(([value, label]) => ({
  value: value as Exclude<ExpenseRelatedType, null>,
  label,
}));

// 基础费用记录类型（对应数据库模型）
export interface ExpenseRecord {
  id: string;
  expenseNumber: string;
  expenseType: ExpenseType;
  expenseName: string;
  expenseAmount: number;
  expenseDate: string; // ISO日期字符串

  // 关联业务（可选）
  relatedType?: ExpenseRelatedType;
  relatedId?: string;
  relatedNumber?: string;
  containerNumber?: string;

  // 备注和附件
  remarks?: string;
  attachments?: string; // JSON字符串

  // 审计字段
  status: ExpenseStatus;
  userId: string;
  createdAt: string; // ISO日期字符串
  updatedAt: string; // ISO日期字符串
  approvedById?: string;
  approvedAt?: string;
  cancelReason?: string;

  // 阶段2新增：支付状态（为阶段3对接做准备）
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  payableId?: string;
  supplierId?: string;

  // 关联数据（可选，根据查询需要包含）
  user?: Pick<User, 'id' | 'name' | 'email'>;
  userName?: string;
  approvedBy?: Pick<User, 'id' | 'name' | 'email'>;
}

// 创建费用记录的请求数据
export interface CreateExpenseRequest {
  expenseType: ExpenseType;
  expenseName: string;
  expenseAmount: number;
  expenseDate: string; // ISO日期字符串

  // 关联业务（可选）
  relatedType?: ExpenseRelatedType | null;
  relatedId?: string | null;
  relatedNumber?: string | null;

  // 备注和附件
  remarks?: string | null;
  attachments?: string | null; // JSON字符串
}

// 更新费用记录的请求数据
export interface UpdateExpenseRequest {
  expenseType?: ExpenseType;
  expenseName?: string;
  expenseAmount?: number;
  expenseDate?: string; // ISO日期字符串

  // 关联业务（可选）
  relatedType?: ExpenseRelatedType | null;
  relatedId?: string | null;
  relatedNumber?: string | null;

  // 备注和附件
  remarks?: string | null;
  attachments?: string | null; // JSON字符串
}

// 费用记录查询参数
export interface ExpenseQueryParams {
  expenseType?: ExpenseType;
  startDate?: string; // ISO日期字符串
  endDate?: string; // ISO日期字符串
  relatedType?: ExpenseRelatedType;
  status?: ExpenseStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'expenseDate' | 'expenseAmount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// 费用记录列表响应
export interface ExpenseListResponse {
  data: ExpenseRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ✅ P1修复: 添加 relatedType 字段，支持按关联业务筛选统计
// 费用统计查询参数
export interface ExpenseStatisticsParams {
  startDate: string; // ISO日期字符串（必填）
  endDate: string; // ISO日期字符串（必填）
  groupBy?: 'type' | 'date' | 'month';
  expenseType?: ExpenseType;
  relatedType?: ExpenseRelatedType; // ✅ P1修复: 添加关联业务类型筛选
}

// 按费用类型分组的统计数据
export interface ExpenseStatisticsByType {
  expenseType: ExpenseType;
  expenseTypeName: string;
  totalAmount: number;
  count: number;
  percentage: number; // 占总金额的百分比
}

// 按日期分组的统计数据
export interface ExpenseStatisticsByDate {
  date: string; // YYYY-MM-DD
  totalAmount: number;
  count: number;
  byType: {
    expenseType: ExpenseType;
    expenseTypeName: string;
    amount: number;
    count: number;
  }[];
}

// 按月份分组的统计数据
export interface ExpenseStatisticsByMonth {
  month: string; // YYYY-MM
  totalAmount: number;
  count: number;
  byType: {
    expenseType: ExpenseType;
    expenseTypeName: string;
    amount: number;
    count: number;
  }[];
}

// 费用统计结果类型
export interface ExpenseStatistics {
  // 总览数据
  totalAmount: number; // 总金额
  totalCount: number; // 总记录数
  averageAmount: number; // 平均金额

  // 按费用类型分组
  byType: ExpenseStatisticsByType[];

  // 按日期分组（可选）
  byDate?: ExpenseStatisticsByDate[];

  // 按月份分组（可选）
  byMonth?: ExpenseStatisticsByMonth[];

  // 时间范围
  startDate: string;
  endDate: string;
}

// 费用表单数据
export interface ExpenseFormData {
  expenseType: ExpenseType;
  expenseName: string;
  expenseAmount?: number;
  expenseDate?: string; // ISO日期字符串

  // 关联业务（可选）
  relatedType?: ExpenseRelatedType;
  relatedId?: string;
  relatedNumber?: string;

  // 备注和附件
  remarks?: string;
  attachments?: string; // JSON字符串
}

// 费用操作结果
export interface ExpenseOperationResult {
  success: boolean;
  record?: ExpenseRecord;
  message?: string;
  error?: string;
}

// 费用详情类型
export interface ExpenseRecordDetail extends ExpenseRecord {
  // 关联业务详情（可选）
  relatedRecord?: {
    type: ExpenseRelatedType;
    id: string;
    number: string;
    name?: string;
    date?: string;
  };
}

// 费用附件类型
export interface ExpenseAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

// 费用附件列表（从 attachments JSON 字符串解析）
export type ExpenseAttachmentList = ExpenseAttachment[];
