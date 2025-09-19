// 客户管理相关类型定义
// 遵循命名约定：数据库 snake_case → API camelCase → 前端 camelCase

// 基础客户信息类型（对应数据库模型）
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  extendedInfo?: string; // JSON格式的扩展信息
  parentCustomerId?: string;
  createdAt: string;
  updatedAt: string;

  // 关联数据（可选，根据查询需要包含）
  parentCustomer?: Customer;
  childCustomers?: Customer[];

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
  email?: string;
  fax?: string;
  website?: string;

  // 业务信息
  businessLicense?: string; // 营业执照号
  taxNumber?: string; // 税号
  bankAccount?: string; // 银行账户
  creditLimit?: number; // 信用额度
  paymentTerms?: string; // 付款条件

  // 分类信息
  customerType?: 'company' | 'store' | 'individual'; // 客户类型
  industry?: string; // 行业
  region?: string; // 区域
  level?: 'A' | 'B' | 'C' | 'D'; // 客户等级

  // 备注信息
  notes?: string;
  tags?: string[]; // 标签
}

// 客户层级类型
export interface CustomerHierarchy {
  id: string;
  name: string;
  level: number; // 层级深度，0为顶级
  path: string[]; // 层级路径，包含所有父级ID
  children?: CustomerHierarchy[];
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
  customerType?: string;
  level?: string;
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

// 显示标签映射
export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  company: '总公司',
  store: '门店',
  individual: '个人客户',
};

export const CUSTOMER_TYPE_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  company: 'default',
  store: 'secondary',
  individual: 'outline',
};

export const CUSTOMER_LEVEL_LABELS: Record<string, string> = {
  A: 'A级客户',
  B: 'B级客户',
  C: 'C级客户',
  D: 'D级客户',
};

export const CUSTOMER_LEVEL_VARIANTS: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  A: 'default',
  B: 'secondary',
  C: 'outline',
  D: 'destructive',
};

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
  email: '邮箱地址',
  fax: '传真号码',
  website: '网站地址',
  businessLicense: '营业执照号',
  taxNumber: '税号',
  bankAccount: '银行账户',
  creditLimit: '信用额度',
  paymentTerms: '付款条件',
  customerType: '客户类型',
  industry: '所属行业',
  region: '所在区域',
  level: '客户等级',
  notes: '备注信息',
  tags: '客户标签',
  parentCustomer: '上级客户',
  totalOrders: '订单总数',
  totalAmount: '交易总额',
  lastOrderDate: '最后下单',
  transactionCount: '交易次数',
  cooperationDays: '合作天数',
  returnOrderCount: '退货次数',
  createdAt: '创建时间',
  updatedAt: '更新时间',
} as const;
