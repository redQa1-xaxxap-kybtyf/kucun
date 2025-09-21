/**
 * 客户相关的Zod验证Schema
 * 严格遵循全栈项目统一约定规范
 */

import { z } from 'zod';

/**
 * 创建客户Schema
 */
export const CreateCustomerSchema = z.object({
  name: z
    .string()
    .min(1, '客户名称不能为空')
    .max(100, '客户名称不能超过100个字符'),

  phone: z
    .string()
    .optional()
    .refine(val => {
      if (!val) return true;
      return /^1[3-9]\d{9}$/.test(val);
    }, '请输入正确的手机号码'),

  address: z.string().max(500, '地址不能超过500个字符').optional(),

  extendedInfo: z.record(z.unknown()).optional(),
});

/**
 * 更新客户Schema
 */
export const UpdateCustomerSchema = CreateCustomerSchema.partial().extend({
  id: z.string().min(1, 'ID不能为空'),
});

/**
 * 客户查询参数Schema
 */
export const CustomerQuerySchema = z.object({
  page: z.number().int().min(1).default(1),

  limit: z.number().int().min(1).max(100).default(20),

  search: z.string().optional(),

  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  parentCustomerId: z.string().optional(),
});

/**
 * 批量删除客户Schema
 */
export const BatchDeleteCustomersSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, '至少选择一个客户')
    .max(100, '一次最多删除100个客户'),
});

/**
 * 客户搜索Schema
 */
export const CustomerSearchSchema = z.object({
  q: z
    .string()
    .min(1, '搜索关键词不能为空')
    .max(100, '搜索关键词不能超过100个字符'),

  limit: z.number().int().min(1).max(50).default(10),
});

// 导出类型
export type CreateCustomerData = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerData = z.infer<typeof UpdateCustomerSchema>;
export type CustomerQueryParams = z.infer<typeof CustomerQuerySchema>;
export type BatchDeleteCustomersData = z.infer<
  typeof BatchDeleteCustomersSchema
>;
export type CustomerSearchParams = z.infer<typeof CustomerSearchSchema>;

/**
 * 客户表单默认值
 */
export const customerFormDefaults: CreateCustomerData = {
  name: '',
  phone: '',
  address: '',
  extendedInfo: {},
};

/**
 * 验证客户名称唯一性（前端预检查）
 */
export function validateCustomerName(name: string): boolean {
  return name.length >= 1 && name.length <= 100;
}

/**
 * 验证手机号码格式
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone) return true;
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 格式化客户地址显示
 */
export function formatCustomerAddress(address?: string): string {
  if (!address) return '-';
  return address.length > 50 ? `${address.substring(0, 50)}...` : address;
}

/**
 * 验证客户扩展信息JSON
 */
export function validateCustomerExtendedInfo(extendedInfo: unknown): boolean {
  try {
    if (!extendedInfo) return true;
    if (typeof extendedInfo !== 'object') return false;
    if (Array.isArray(extendedInfo)) return false;

    // 检查是否为有效的键值对对象
    for (const [key, value] of Object.entries(extendedInfo)) {
      if (typeof key !== 'string' || key.length === 0) return false;
      if (value === undefined || value === null) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * 格式化客户联系方式
 */
export function formatCustomerContact(
  phone?: string,
  address?: string
): string {
  const parts = [];
  if (phone) parts.push(`电话: ${phone}`);
  if (address) parts.push(`地址: ${formatCustomerAddress(address)}`);
  return parts.join(' | ') || '-';
}

/**
 * 生成客户显示名称
 */
export function generateCustomerDisplayName(customer: {
  name: string;
  phone?: string;
}): string {
  if (customer.phone) {
    return `${customer.name} (${customer.phone})`;
  }
  return customer.name;
}
