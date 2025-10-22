import { z } from 'zod';

import { customerConfig, paginationConfig } from '@/lib/env';
import type { CustomerExtendedInfo } from '@/lib/types/customer';

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
    .enum(['createdAt', 'name', 'totalOrders'])
    .optional()
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
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

  notes: z
    .string()
    .max(500, '备注信息不能超过500个字符')
    .optional()
    .or(z.literal('')),

  tags: z.array(z.string()).optional(),
};

// 客户创建表单验证
export const customerCreateSchema = z.object({
  name: baseValidations.name,
  phone: baseValidations.phone,
  address: baseValidations.address,
  parentCustomerId: z.string().optional(),
  extendedInfo: z.object(extendedInfoValidations).optional(),
});

// 客户更新表单验证
export const customerUpdateSchema = z.object({
  id: z.string().min(1, '客户ID不能为空'),
  name: baseValidations.name.optional(),
  phone: baseValidations.phone,
  address: baseValidations.address,
  parentCustomerId: z.string().optional(),
  extendedInfo: z.object(extendedInfoValidations).optional(),
});

// 客户搜索表单验证
export const customerSearchSchema = z.object({
  search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
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
  extendedInfo: {
    contactPerson: '',
    email: '',
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
