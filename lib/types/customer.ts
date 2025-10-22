// 客户管理相关类型定义
// 遵循命名约定：数据库 snake_case → API camelCase → 前端 camelCase

// 基础客户信息类型（对应数据库模型）
export interface CustomerParentInfo {
  id: string;
  name: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  extendedInfo?: string; // JSON格式的扩展信息
  parentCustomerId?: string | null;
  parentCustomer?: CustomerParentInfo | null;
  subCustomers?: CustomerParentInfo[];
  createdAt: string;
  updatedAt: string;

  // 统计信息（可选，用于列表展示）
  totalOrders?: number;
  totalAmount?: number;
  lastOrderDate?: string;

  // 新增统计字段
  transactionCount?: number; // 交易次数（历史订单总数）
  cooperationDays?: number; // 合作天数（从首次下单到当前的天数）
  returnOrderCount?: number; // 退货次数
}

// 客户扩展信息类型
export interface CustomerExtendedInfo {
  // 联系信息
  contactPerson?: string;
  email?: string;

  // 备注信息
  notes?: string;

  // 地区
  region?: string;

  // 标签
  tags?: string[];
}

// API 查询参数类型
export interface CustomerQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?:
    | 'name'
    | 'createdAt'
    | 'updatedAt'
    | 'totalOrders'
    | 'totalAmount'
    | 'transactionCount'
    | 'cooperationDays'
    | 'returnOrderCount';
  sortOrder?: 'asc' | 'desc';
  parentCustomerId?: string;
  region?: string;
}

// API 响应类型
export interface CustomerListResponse {
  success: boolean;
  data: {
    customers: Customer[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  message?: string;
}

export interface CustomerDetailResponse {
  success: boolean;
  data: Customer;
  message?: string;
}

// 客户详情结果类型（包含子客户）
export interface CustomerDetailResult extends Customer {
  childCustomers?: CustomerParentInfo[];
}

// 客户创建输入类型
export interface CustomerCreateInput {
  name: string;
  phone?: string;
  address?: string;
  parentCustomerId?: string;
  extendedInfo?: CustomerExtendedInfo;
}

// 客户更新输入类型
export interface CustomerUpdateInput {
  id: string;
  name?: string;
  phone?: string;
  address?: string;
  parentCustomerId?: string;
  extendedInfo?: CustomerExtendedInfo;
}

// 客户历史价格记录类型
export interface CustomerPriceHistory {
  id: string;
  customerId: string;
  productId: string;
  price: number;
  effectiveDate: string;
  createdAt: string;

  // 关联数据
  customer?: Customer;
  product?: {
    id: string;
    code: string;
    name: string;
  };
}

// 排序选项
export const CUSTOMER_SORT_OPTIONS = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'updatedAt', label: '更新时间' },
  { value: 'name', label: '客户名称' },
  { value: 'totalOrders', label: '订单数量' },
  { value: 'totalAmount', label: '交易金额' },
  { value: 'transactionCount', label: '交易次数' },
  { value: 'cooperationDays', label: '合作天数' },
  { value: 'returnOrderCount', label: '退货次数' },
] as const;

// 客户字段标签映射
export const CUSTOMER_FIELD_LABELS = {
  name: '客户名称',
  phone: '联系电话',
  address: '客户地址',
  contactPerson: '联系人',
  email: '邮箱地址',
  notes: '备注信息',
  totalOrders: '订单总数',
  totalAmount: '交易总额',
  lastOrderDate: '最后下单',
  transactionCount: '交易次数',
  cooperationDays: '合作天数',
  returnOrderCount: '退货次数',
  createdAt: '创建时间',
  updatedAt: '更新时间',
} as const;
