import { z } from 'zod';

import type { CustomerExtendedInfo } from '@/lib/types/customer';

// 基础验证规则
const baseValidations = {
  name: z
    .string()
    .min(1, '客户名称不能为空')
    .max(100, '客户名称不能超过100个字符')
    .trim(),

  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, '请输入正确的手机号码')
    .optional()
    .or(z.literal('')),

  address: z
    .string()
    .max(200, '地址不能超过200个字符')
    .optional()
    .or(z.literal('')),

  parentCustomerId: z
    .string()
    .uuid('上级客户ID格式不正确')
    .optional()
    .or(z.literal('')),
};

// 客户扩展信息验证
const extendedInfoValidations = {
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),

  fax: z
    .string()
    .max(20, '传真号码不能超过20个字符')
    .optional()
    .or(z.literal('')),

  website: z.string().url('网站地址格式不正确').optional().or(z.literal('')),

  businessLicense: z
    .string()
    .max(50, '营业执照号不能超过50个字符')
    .optional()
    .or(z.literal('')),

  taxNumber: z
    .string()
    .max(50, '税号不能超过50个字符')
    .optional()
    .or(z.literal('')),

  bankAccount: z
    .string()
    .max(50, '银行账户不能超过50个字符')
    .optional()
    .or(z.literal('')),

  creditLimit: z
    .number()
    .min(0, '信用额度不能为负数')
    .max(99999999.99, '信用额度不能超过99,999,999.99')
    .optional(),

  paymentTerms: z
    .string()
    .max(100, '付款条件不能超过100个字符')
    .optional()
    .or(z.literal('')),

  customerType: z
    .enum(['company', 'store', 'individual'], {
      errorMap: () => ({ message: '请选择正确的客户类型' }),
    })
    .optional(),

  industry: z
    .string()
    .max(50, '行业不能超过50个字符')
    .optional()
    .or(z.literal('')),

  region: z
    .string()
    .max(50, '区域不能超过50个字符')
    .optional()
    .or(z.literal('')),

  level: z
    .enum(['A', 'B', 'C', 'D'], {
      errorMap: () => ({ message: '请选择正确的客户等级' }),
    })
    .optional(),

  notes: z
    .string()
    .max(500, '备注信息不能超过500个字符')
    .optional()
    .or(z.literal('')),

  tags: z
    .array(z.string().max(20, '标签长度不能超过20个字符'))
    .max(10, '标签数量不能超过10个')
    .optional(),
};

// 客户创建表单验证
export const customerCreateSchema = z.object({
  name: baseValidations.name,
  phone: baseValidations.phone,
  address: baseValidations.address,
  parentCustomerId: baseValidations.parentCustomerId,
  extendedInfo: z.object(extendedInfoValidations).optional(),
});

// 客户更新表单验证
export const customerUpdateSchema = z.object({
  id: z.string().min(1, '客户ID不能为空'),
  name: baseValidations.name.optional(),
  phone: baseValidations.phone,
  address: baseValidations.address,
  parentCustomerId: baseValidations.parentCustomerId,
  extendedInfo: z.object(extendedInfoValidations).optional(),
});

// 客户搜索表单验证
export const customerSearchSchema = z.object({
  search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
  parentCustomerId: z
    .string()
    .uuid('上级客户ID格式不正确')
    .optional()
    .or(z.literal('')),
  customerType: z
    .enum(['company', 'store', 'individual'])
    .optional()
    .or(z.literal('')),
  level: z.enum(['A', 'B', 'C', 'D']).optional().or(z.literal('')),
  region: z
    .string()
    .max(50, '区域不能超过50个字符')
    .optional()
    .or(z.literal('')),
  sortBy: z
    .enum(['name', 'createdAt', 'updatedAt', 'totalOrders', 'totalAmount'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 表单数据类型推导
export type CustomerCreateFormData = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateFormData = z.infer<typeof customerUpdateSchema>;
export type CustomerSearchFormData = z.infer<typeof customerSearchSchema>;

// 表单默认值
export const customerCreateDefaults: Partial<CustomerCreateFormData> = {
  name: '',
  phone: '',
  address: '',
  parentCustomerId: '',
  extendedInfo: {
    email: '',
    fax: '',
    website: '',
    businessLicense: '',
    taxNumber: '',
    bankAccount: '',
    creditLimit: undefined,
    paymentTerms: '',
    customerType: undefined,
    industry: '',
    region: '',
    level: undefined,
    notes: '',
    tags: [],
  },
};

export const customerSearchDefaults: CustomerSearchFormData = {
  search: '',
  parentCustomerId: '',
  customerType: '',
  level: '',
  region: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

// 验证辅助函数
export const validateCustomerHierarchy = (
  customerId: string,
  parentCustomerId?: string
): boolean => {
  // 防止自己作为自己的父级
  if (customerId === parentCustomerId) {
    return false;
  }

  // TODO: 在实际应用中，需要检查是否会形成循环引用
  // 这里需要查询数据库来验证层级关系的合法性

  return true;
};

// 扩展信息处理函数
export const processExtendedInfo = (
  extendedInfo?: CustomerExtendedInfo
): string | undefined => {
  if (!extendedInfo) return undefined;

  // 过滤空值
  const filtered = Object.fromEntries(
    Object.entries(extendedInfo).filter(([_, value]) => {
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  );

  return Object.keys(filtered).length > 0
    ? JSON.stringify(filtered)
    : undefined;
};

// 解析扩展信息
export const parseExtendedInfo = (
  extendedInfoStr?: string
): CustomerExtendedInfo => {
  if (!extendedInfoStr) return {};

  try {
    return JSON.parse(extendedInfoStr) as CustomerExtendedInfo;
  } catch (error) {
    // 解析失败时返回空对象，避免应用崩溃
    return {};
  }
};

// 客户层级路径生成
export const generateCustomerPath = (
  customer: { id: string; parentCustomerId?: string },
  allCustomers: { id: string; parentCustomerId?: string }[]
): string[] => {
  const path: string[] = [];
  let current = customer;

  // 防止无限循环
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    path.unshift(current.id);
    visited.add(current.id);

    if (!current.parentCustomerId) break;

    const parent = allCustomers.find(c => c.id === current.parentCustomerId);
    if (!parent) break;
    current = parent;
  }

  return path;
};

// 客户层级深度计算
export const calculateCustomerLevel = (
  customerId: string,
  allCustomers: { id: string; parentCustomerId?: string }[]
): number => {
  const customer = allCustomers.find(c => c.id === customerId);
  if (!customer) return 0;

  const path = generateCustomerPath(customer, allCustomers);
  return path.length - 1; // 减1因为包含自己
};
