import { z } from 'zod';

/**
 * 库存管理基础验证规则
 * 提供通用的字段验证规则，供其他验证模块使用
 */

// 基础验证规则
export const baseValidations = {
  productId: z.string().min(1, '请选择产品').uuid('产品ID格式不正确'),

  colorCode: z
    .string()
    .max(20, '色号不能超过20个字符')
    .optional()
    .or(z.literal('')),

  quantity: z
    .number()
    .int('数量必须为整数')
    .min(1, '数量必须大于0')
    .max(999999, '数量不能超过999,999'),

  unitCost: z
    .number()
    .min(0, '单位成本不能为负数')
    .max(999999.99, '单位成本不能超过999,999.99')
    .multipleOf(0.01, '单位成本最多保留2位小数')
    .optional(),

  remarks: z
    .string()
    .max(500, '备注信息不能超过500个字符')
    .optional()
    .or(z.literal('')),

  supplierId: z
    .string()
    .uuid('供应商ID格式不正确')
    .optional()
    .or(z.literal('')),

  customerId: z.string().uuid('客户ID格式不正确').optional().or(z.literal('')),

  salesOrderId: z
    .string()
    .uuid('销售订单ID格式不正确')
    .optional()
    .or(z.literal('')),
};

/**
 * 验证辅助函数
 */

// 验证库存数量是否足够
export const validateInventoryQuantity = (
  currentQuantity: number,
  reservedQuantity: number,
  outboundQuantity: number
): { isValid: boolean; message?: string } => {
  const availableQuantity = currentQuantity - reservedQuantity;

  if (outboundQuantity > availableQuantity) {
    return {
      isValid: false,
      message: `出库数量(${outboundQuantity})超过可用库存(${availableQuantity})`,
    };
  }

  return { isValid: true };
};

// 色号验证
export const validateColorCode = (colorCode: string): boolean => {
  if (!colorCode) return true; // 可选字段

  // 色号格式：字母+数字组合，长度3-20
  const colorCodeRegex = /^[A-Z0-9]{3,20}$/;
  return colorCodeRegex.test(colorCode.toUpperCase());
};

// 计算总成本
export const calculateTotalCost = (
  quantity: number,
  unitCost: number
): number => Math.round(quantity * unitCost * 100) / 100;
