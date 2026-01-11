import { z } from 'zod';

import { customerConfig, paginationConfig } from '@/lib/env';
import type { CustomerExtendedInfo } from '@/lib/types/customer';

const CUSTOMER_STATUS_VALUES = ['active', 'inactive'] as const;
const CUSTOMER_TYPE_VALUES = ['company', 'store', 'individual'] as const;
const CUSTOMER_LEVEL_VALUES = ['A', 'B', 'C', 'D'] as const;

// 客户搜索查询验证规则
export const customerSearchQuerySchema = z.object({
  q: z.string().optional().default(''),

  limit: z
    .number()
    .int()
    .positive()
    .max(50, '每次最多返回50条记录')
    .optional()
    .default(customerConfig.searchLimit),
});

// 客户查询验证规则
export const customerQuerySchema = z.object({
  page: z.number().int().positive().optional().default(1),

  limit: z
    .number()
    .int()
    .positive()
    .max(paginationConfig.maxPageSize)
    .optional()
    .default(20),

  search: z.string().optional(),

  sortBy: z
    .enum([
      'createdAt',
      'name',
      'totalOrders',
      'updatedAt',
      'totalAmount',
      'transactionCount',
      'cooperationDays',
      'returnOrderCount',
    ])
    .optional()
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),

  status: z.enum(CUSTOMER_STATUS_VALUES).optional(),

  customerType: z.enum(CUSTOMER_TYPE_VALUES).optional(),

  level: z.enum(CUSTOMER_LEVEL_VALUES).optional(),

  parentCustomerId: z
    .string()
    .uuid('上级客户ID格式不正确')
    .optional()
    .or(z.literal('')),

  region: z.string().max(50, '区域不能超过50个字符').optional(),
});

// 基础验证规则
const baseValidations = {
  name: z
    .string()
    .min(1, '客户名称不能为空')
    .max(100, '客户名称不能超过100个字符')
    .trim(),

  phone: z
    .string()
    .refine(
      val => {
        if (!val || val === '') return true;
        // 支持多种电话格式：
        // 手机号：1[3-9]\d{9}
        // 固话：区号-号码 或 区号号码 (如 010-12345678、01012345678)
        // 400/800：400-xxx-xxxx、800-xxx-xxxx
        const patterns = [
          /^1[3-9]\d{9}$/, // 手机号
          /^0\d{2,3}-?\d{7,8}$/, // 固话
          /^[48]00-?\d{3,4}-?\d{4}$/, // 400/800
        ];
        return patterns.some(pattern => pattern.test(val));
      },
      { message: '请输入正确的电话号码（支持手机号、固话、400电话）' }
    )
    .optional()
    .or(z.literal('')),

  address: z
    .string()
    .max(200, '地址不能超过200个字符')
    .optional()
    .or(z.literal('')),
};

// 客户扩展信息验证
const extendedInfoValidations = {
  contactPerson: z
    .string()
    .max(50, '联系人姓名不能超过50个字符')
    .optional()
    .or(z.literal('')),

  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),

  phone2: baseValidations.phone, // 备用电话1
  phone3: baseValidations.phone, // 备用电话2

  website: z.string().url('网站地址格式不正确').optional().or(z.literal('')),

  creditLimit: z
    .number({ message: '信用额度必须是数字' })
    .min(0, { message: '信用额度不能为负数' })
    .max(99_999_999.99, { message: '信用额度不能超过99,999,999.99' })
    .optional(),

  paymentTerms: z
    .string()
    .max(100, '付款条款不能超过100个字符')
    .optional()
    .or(z.literal('')),

  customerType: z
    .enum(CUSTOMER_TYPE_VALUES, { message: '客户类型不合法' })
    .optional(),

  industry: z
    .string()
    .max(100, '行业名称不能超过100个字符')
    .optional()
    .or(z.literal('')),

  level: z
    .enum(CUSTOMER_LEVEL_VALUES, { message: '客户等级不合法' })
    .optional(),

  region: z
    .string()
    .max(100, '地区信息不能超过100个字符')
    .optional()
    .or(z.literal('')),

  notes: z
    .string()
    .max(500, '备注信息不能超过500个字符')
    .optional()
    .or(z.literal('')),

  tags: z
    .array(z.string().min(1, '标签不能为空').max(20, '标签不能超过20个字符'))
    .max(customerConfig.tagLimit, `标签不能超过${customerConfig.tagLimit}个`)
    .optional(),
};

// ✅ 客户创建表单验证 - parentCustomerId可选
export const customerCreateSchema = z.object({
  name: baseValidations.name,
  phone: baseValidations.phone,
  address: baseValidations.address,
  parentCustomerId: z
    .string()
    .uuid('上级客户ID格式不正确')
    .optional()
    .or(z.literal('')),
  extendedInfo: z.object(extendedInfoValidations).optional(),
});

// ✅ 快速添加客户表单验证 - 包含 notes 字段
export const customerQuickAddSchema = z.object({
  name: baseValidations.name,
  phone: baseValidations.phone,
  address: baseValidations.address,
  parentCustomerId: z
    .string()
    .uuid('上级客户ID格式不正确')
    .optional()
    .or(z.literal('')),
  extendedInfo: z.object(extendedInfoValidations).optional(),
  notes: z.string().optional(),
});

// ✅ 客户更新表单验证 - parentCustomerId可选
export const customerUpdateSchema = z.object({
  id: z.string().min(1, '客户ID不能为空'),
  name: baseValidations.name.optional(),
  phone: baseValidations.phone,
  address: baseValidations.address,
  parentCustomerId: z
    .string()
    .uuid('上级客户ID格式不正确')
    .optional()
    .or(z.literal('')),
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
  customerType: z.enum(CUSTOMER_TYPE_VALUES).optional(),
  level: z.enum(CUSTOMER_LEVEL_VALUES).optional(),
  region: z.string().max(50, '区域不能超过50个字符').optional(),
  sortBy: z
    .enum(['name', 'createdAt', 'updatedAt', 'totalOrders', 'totalAmount'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// 表单数据类型推导
export type CustomerCreateFormData = z.infer<typeof customerCreateSchema>;
export type CustomerQuickAddFormData = z.infer<typeof customerQuickAddSchema>;
export type CustomerUpdateFormData = z.infer<typeof customerUpdateSchema>;
export type CustomerSearchFormData = z.infer<typeof customerSearchSchema>;

// 表单默认值
export const customerCreateDefaults: Partial<CustomerCreateFormData> = {
  name: '',
  phone: '',
  address: '',
  extendedInfo: {
    contactPerson: '',
    email: '',
    phone2: '',
    phone3: '',
    notes: '',
  },
};

export const customerSearchDefaults: CustomerSearchFormData = {
  search: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

// 扩展信息处理函数
export const processExtendedInfo = (
  extendedInfo?: CustomerExtendedInfo
): string | undefined => {
  if (!extendedInfo) {
    return undefined;
  }

  // 过滤空值
  const filtered = Object.fromEntries(
    Object.entries(extendedInfo).filter(([, value]) => {
      if (value === null || value === undefined || value === '') {
        return false;
      }
      if (Array.isArray(value) && value.length === 0) {
        return false;
      }
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
  if (!extendedInfoStr) {
    return {};
  }

  try {
    return JSON.parse(extendedInfoStr) as CustomerExtendedInfo;
  } catch {
    // 解析失败时返回空对象，避免应用崩溃
    return {};
  }
};

export function validateCustomerHierarchy(
  customerId: string,
  parentCustomerId?: string
): boolean {
  if (!parentCustomerId) {
    return true;
  }
  return customerId !== parentCustomerId;
}

export function generateCustomerPath<
  T extends { id: string; parentCustomerId?: string | null },
>(customer: T, allCustomers: T[]): string[] {
  const path: string[] = [];
  const visited = new Set<string>();
  let current: T | undefined = customer;

  while (current) {
    if (visited.has(current.id)) {
      break;
    }
    path.unshift(current.id);
    visited.add(current.id);
    if (!current.parentCustomerId) {
      break;
    }
    current = allCustomers.find(item => item.id === current?.parentCustomerId);
  }

  return path;
}

export function calculateCustomerLevel<
  T extends { id: string; parentCustomerId?: string | null },
>(customerId: string, allCustomers: T[]): number {
  const customer = allCustomers.find(item => item.id === customerId);
  if (!customer) {
    return 0;
  }
  return generateCustomerPath(customer, allCustomers).length - 1;
}
