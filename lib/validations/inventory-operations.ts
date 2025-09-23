import { z } from 'zod';

import { baseValidations } from './inventory-base';

/**
 * 库存操作验证规则
 * 包含出库、库存调整、库存盘点等操作的验证规则
 */

// 出库操作验证
export const outboundCreateSchema = z
  .object({
    type: z.enum(['normal_outbound', 'sales_outbound', 'adjust_outbound'], {
      errorMap: () => ({ message: '请选择正确的出库类型' }),
    }),
    productId: baseValidations.productId,
    colorCode: baseValidations.colorCode,
    productionDate: baseValidations.productionDate,
    quantity: baseValidations.quantity,
    unitCost: baseValidations.unitCost,
    customerId: baseValidations.customerId,
    salesOrderId: baseValidations.salesOrderId,
    remarks: baseValidations.remarks,
  })
  .refine(
    data => {
      // 销售出库需要客户
      if (data.type === 'sales_outbound' && !data.customerId) {
        return false;
      }
      return true;
    },
    {
      message: '销售出库需要选择客户',
      path: ['customerId'],
    }
  );

// 库存调整验证
export const inventoryAdjustSchema = z.object({
  productId: baseValidations.productId,
  colorCode: baseValidations.colorCode,
  productionDate: baseValidations.productionDate,
  adjustQuantity: z
    .number()
    .int('调整数量必须为整数')
    .min(-999999, '调整数量不能小于-999,999')
    .max(999999, '调整数量不能超过999,999')
    .refine(val => val !== 0, '调整数量不能为0'),
  reason: z
    .string()
    .min(1, '请填写调整原因')
    .max(200, '调整原因不能超过200个字符'),
  remarks: baseValidations.remarks,
});

// 库存盘点明细验证
const inventoryCountItemSchema = z.object({
  productId: baseValidations.productId,
  colorCode: baseValidations.colorCode,
  productionDate: baseValidations.productionDate,
  actualQuantity: z
    .number()
    .int('实际数量必须为整数')
    .min(0, '实际数量不能为负数')
    .max(999999, '实际数量不能超过999,999'),
  systemQuantity: z
    .number()
    .int('系统数量必须为整数')
    .min(0, '系统数量不能为负数')
    .max(999999, '系统数量不能超过999,999'),
});

// 库存盘点验证
export const inventoryCountSchema = z
  .object({
    items: z
      .array(inventoryCountItemSchema)
      .min(1, '至少需要盘点一个库存项目')
      .max(1000, '单次盘点项目不能超过1000个'),
    remarks: baseValidations.remarks,
  })
  .refine(
    data => {
      // 验证是否有重复的库存项目
      const combinations = new Set();
      for (const item of data.items) {
        const key = `${item.productId}-${item.colorCode || ''}-${item.productionDate || ''}`;
        if (combinations.has(key)) {
          return false;
        }
        combinations.add(key);
      }
      return true;
    },
    {
      message: '盘点项目中存在重复的产品规格组合',
      path: ['items'],
    }
  );

// 批量操作验证
export const batchOperationSchema = z.object({
  ids: z
    .array(z.string().uuid('记录ID格式不正确'))
    .min(1, '请选择至少一条记录')
    .max(100, '批量操作最多支持100条记录'),
  action: z.enum(['delete', 'export']),
  params: z.record(z.any()).optional(), // 操作参数
});

// 表单数据类型推导
export type OutboundCreateFormData = z.infer<typeof outboundCreateSchema>;
export type InventoryAdjustFormData = z.infer<typeof inventoryAdjustSchema>;
export type InventoryCountFormData = z.infer<typeof inventoryCountSchema>;
export type BatchOperationFormData = z.infer<typeof batchOperationSchema>;

// 表单默认值
export const outboundCreateDefaults: Partial<OutboundCreateFormData> = {
  type: 'normal_outbound',
  colorCode: '',
  productionDate: '',
  unitCost: undefined,
  customerId: '',
  salesOrderId: '',
  remarks: '',
};

export const inventoryAdjustDefaults: Partial<InventoryAdjustFormData> = {
  colorCode: '',
  productionDate: '',
  adjustQuantity: 0,
  reason: '',
  remarks: '',
};
