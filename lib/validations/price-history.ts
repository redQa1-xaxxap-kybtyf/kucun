// 价格历史查询参数验证规则
// 遵循全栈项目统一约定规范，使用 Zod 作为唯一真理源

import { z } from 'zod';

// ==================== 枚举验证 ====================

// 价格类型枚举验证
export const priceTypeSchema = z.enum(['SALES', 'FACTORY'], {
  error: () => '请选择有效的价格类型（SALES 或 FACTORY）',
});

// ==================== 查询参数验证 ====================

// 客户价格历史查询验证规则
export const customerPriceHistoryQuerySchema = z.object({
  customerId: z
    .string({
      error: issue =>
        issue.input === undefined ? '客户ID不能为空' : '客户ID必须是字符串',
    })
    .min(1, { error: '客户ID不能为空' })
    .trim(),

  productId: z.string().min(1).trim().optional().or(z.literal('')),

  priceType: priceTypeSchema.optional(),
});

// 供应商价格历史查询验证规则
export const supplierPriceHistoryQuerySchema = z.object({
  supplierId: z
    .string({
      error: issue =>
        issue.input === undefined ? '供应商ID不能为空' : '供应商ID必须是字符串',
    })
    .min(1, { error: '供应商ID不能为空' })
    .trim(),

  productId: z.string().min(1).trim().optional().or(z.literal('')),
});

// 价格历史创建验证规则
export const createPriceHistorySchema = z.object({
  productId: z
    .string({
      error: issue =>
        issue.input === undefined ? '产品ID不能为空' : '产品ID必须是字符串',
    })
    .min(1, { error: '产品ID不能为空' }),

  unitPrice: z
    .number({
      error: issue =>
        issue.input === undefined ? '单价必须是数字' : '单价必须是数字',
    })
    .positive({ error: '单价必须大于0' })
    .max(999999999, { error: '单价不能超过999,999,999' }),

  priceType: priceTypeSchema.optional(),

  effectiveDate: z
    .string()
    .optional()
    .refine(
      date => {
        if (!date) {
          return true;
        }
        const parsedDate = new Date(date);
        return !isNaN(parsedDate.getTime());
      },
      { error: '请输入有效的日期格式' }
    ),

  remarks: z.string().optional().or(z.literal('')),
});

// 批量价格导入验证规则
export const batchPriceImportSchema = z
  .object({
    prices: z
      .array(
        z.object({
          productCode: z.string().min(1, '产品编码不能为空'),
          unitPrice: z.number().positive('单价必须大于0'),
          priceType: priceTypeSchema.optional(),
        })
      )
      .min(1, '至少需要导入一条价格记录')
      .max(1000, '单次最多导入1000条记录'),

    customerId: z.string().optional(),
    supplierId: z.string().optional(),
  })
  .refine(
    data => {
      // 客户ID和供应商ID必须二选一
      return Boolean(data.customerId) !== Boolean(data.supplierId);
    },
    {
      message: '必须指定客户ID或供应商ID（且只能指定其中一个）',
      path: ['customerId'],
    }
  );

// ==================== 导出类型 ====================

export type CustomerPriceHistoryQueryInput = z.infer<
  typeof customerPriceHistoryQuerySchema
>;
export type SupplierPriceHistoryQueryInput = z.infer<
  typeof supplierPriceHistoryQuerySchema
>;
export type CreatePriceHistoryInput = z.infer<typeof createPriceHistorySchema>;
export type BatchPriceImportInput = z.infer<typeof batchPriceImportSchema>;
export type PriceType = z.infer<typeof priceTypeSchema>;

// ==================== 验证工具函数 ====================

/**
 * 验证价格是否在合理范围内
 */
export const validatePriceRange = (
  price: number,
  minPrice = 0,
  maxPrice = 999999999
): boolean => {
  return price > minPrice && price <= maxPrice;
};

/**
 * 验证价格变动是否在合理范围内（防止误操作）
 */
export const validatePriceChange = (
  oldPrice: number,
  newPrice: number,
  maxChangePercent = 50
): boolean => {
  if (oldPrice === 0) {
    return true; // 首次设置价格
  }
  const changePercent = Math.abs((newPrice - oldPrice) / oldPrice) * 100;
  return changePercent <= maxChangePercent;
};
