/**
 * 销售订单费用项验证 Schema
 *
 * 使用 Zod 进行类型安全的运行时验证
 */

import { z } from 'zod';

/**
 * 销售订单费用项验证 Schema
 */
export const salesOrderFeeItemSchema = z.object({
  id: z.string().optional(),
  feeType: z.enum(
    ['freight', 'processing', 'packaging', 'loading_unloading', 'other'],
    {
      message: '请选择费用类型',
    }
  ),
  feeName: z
    .string()
    .min(1, '费用名称不能为空')
    .max(100, '费用名称不能超过100个字符'),
  feeAmount: z
    .number({
      message: '请输入费用金额',
    })
    .nonnegative('费用金额不能为负数')
    .finite('费用金额必须是有限数字'),
  paidBy: z.enum(['customer', 'company'], {
    message: '请选择费用承担方',
  }),
  remarks: z.string().max(500, '备注不能超过500个字符').optional(),
});

/**
 * 费用项数组 Schema
 */
export const salesOrderFeeItemsSchema = z
  .array(salesOrderFeeItemSchema)
  .min(0, '费用项不能为空数组')
  .max(20, '费用项不能超过20个');

/**
 * 自定义验证: 费用总额不能超过订单总额的50%
 */
export const validateFeeTotalAmount = (
  feeItems: z.infer<typeof salesOrderFeeItemsSchema>,
  orderAmount: number
): { valid: boolean; message?: string } => {
  const totalFees = feeItems.reduce((sum, item) => sum + item.feeAmount, 0);
  const maxAllowedFees = orderAmount * 0.5;

  if (totalFees > maxAllowedFees) {
    return {
      valid: false,
      message: `费用总额 ${totalFees.toFixed(2)} 元超过订单金额的50% (${maxAllowedFees.toFixed(2)} 元)`,
    };
  }

  return { valid: true };
};

/**
 * 导出类型定义
 */
export type SalesOrderFeeItemFormData = z.infer<typeof salesOrderFeeItemSchema>;
export type SalesOrderFeeItemsFormData = z.infer<
  typeof salesOrderFeeItemsSchema
>;
