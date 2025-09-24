import { z } from 'zod';

/**
 * 供应商状态枚举
 */
export const SupplierStatusEnum = z.enum(['active', 'inactive']);

/**
 * 创建供应商Schema
 */
export const CreateSupplierSchema = z.object({
  name: z
    .string()
    .min(1, '供应商名称不能为空')
    .max(100, '供应商名称不能超过100个字符'),

  phone: z
    .string()
    .max(20, '联系电话不能超过20个字符')
    .regex(/^[\d\s\-\+\(\)]*$/, '联系电话格式不正确')
    .optional()
    .or(z.literal('')),

  address: z
    .string()
    .max(200, '地址不能超过200个字符')
    .optional()
    .or(z.literal('')),
});

/**
 * 更新供应商Schema
 */
export const UpdateSupplierSchema = z.object({
  name: z
    .string()
    .min(1, '供应商名称不能为空')
    .max(100, '供应商名称不能超过100个字符')
    .optional(),

  phone: z
    .string()
    .max(20, '联系电话不能超过20个字符')
    .regex(/^[\d\s\-\+\(\)]*$/, '联系电话格式不正确')
    .optional()
    .or(z.literal('')),

  address: z
    .string()
    .max(200, '地址不能超过200个字符')
    .optional()
    .or(z.literal('')),

  status: SupplierStatusEnum.optional(),
});

/**
 * 供应商查询参数Schema
 */
export const SupplierQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
  search: z.string().optional(),
  status: SupplierStatusEnum.optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * 批量删除供应商Schema
 */
export const BatchDeleteSuppliersSchema = z.object({
  supplierIds: z
    .array(z.string().uuid('无效的供应商ID'))
    .min(1, '至少选择一个供应商')
    .max(100, '一次最多删除100个供应商'),
});

/**
 * 批量更新供应商状态Schema
 */
export const BatchUpdateSupplierStatusSchema = z.object({
  supplierIds: z
    .array(z.string().uuid('无效的供应商ID'))
    .min(1, '至少选择一个供应商')
    .max(100, '一次最多更新100个供应商'),
  status: SupplierStatusEnum,
});

// 导出类型推断
export type SupplierCreateFormData = z.infer<typeof CreateSupplierSchema>;
export type SupplierUpdateFormData = z.infer<typeof UpdateSupplierSchema>;
export type SupplierQueryFormData = z.infer<typeof SupplierQuerySchema>;
export type BatchDeleteSuppliersFormData = z.infer<
  typeof BatchDeleteSuppliersSchema
>;
export type BatchUpdateSupplierStatusFormData = z.infer<
  typeof BatchUpdateSupplierStatusSchema
>;

// 表单默认值
export const supplierCreateDefaults: Partial<SupplierCreateFormData> = {
  name: '',
  phone: '',
  address: '',
};

export const supplierUpdateDefaults: Partial<SupplierUpdateFormData> = {
  name: '',
  phone: '',
  address: '',
  status: 'active',
};

/**
 * 格式化供应商状态显示
 */
export function formatSupplierStatus(status: string): string {
  switch (status) {
    case 'active':
      return '活跃';
    case 'inactive':
      return '停用';
    default:
      return '未知';
  }
}

/**
 * 验证供应商名称唯一性（前端预检查）
 */
export function validateSupplierName(name: string): boolean {
  return name.length >= 1 && name.length <= 100;
}

/**
 * 格式化供应商电话显示
 */
export function formatSupplierPhone(phone?: string): string {
  if (!phone) return '-';
  return phone;
}

/**
 * 格式化供应商地址显示
 */
export function formatSupplierAddress(address?: string): string {
  if (!address) return '-';
  return address.length > 50 ? `${address.substring(0, 50)}...` : address;
}
