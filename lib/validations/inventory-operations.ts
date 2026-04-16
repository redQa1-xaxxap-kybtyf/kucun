import { z } from 'zod';

import { baseValidations } from './inventory-base';
import {
  manualDamageCategorySchema,
  manualDamageHandlingSchema,
} from './manual-damage-ledger';

/**
 * 库存操作验证规则
 * 包含出库、库存调整、库存盘点等操作的验证规则
 */

// 出库操作验证
export const outboundCreateSchema = z
  .object({
    idempotencyKey: z
      .string()
      .uuid('幂等性键格式不正确')
      .describe('幂等性键,防止重复操作'),
    type: z.enum(
      [
        'normal_outbound',
        'sales_outbound',
        'sample_outbound',
        'internal_use_outbound',
        'adjust_outbound',
      ],
      {
        message: '请选择正确的出库类型',
      }
    ),
    productId: baseValidations.productId,
    batchNumber: baseValidations.batchNumber,
    quantity: baseValidations.quantity,
    unitCost: baseValidations.unitCost,
    customerId: baseValidations.customerId,
    salesOrderId: baseValidations.salesOrderId,
    remarks: baseValidations.remarks,
    // 修复：添加variantId字段支持
    variantId: z
      .string()
      .uuid('产品规格信息格式不正确')
      .optional()
      .or(z.literal('')),
    // 添加出库原因字段
    reason: z.string().max(200, '出库原因不能超过200个字符').optional(),
    // 添加备注字段
    notes: z.string().max(500, '备注信息不能超过500个字符').optional(),
  })
  .refine(
    data => {
      // 销售/客户样品出库需要客户
      if (
        (data.type === 'sales_outbound' || data.type === 'sample_outbound') &&
        !data.customerId
      ) {
        return false;
      }
      return true;
    },
    {
      message: '销售出库和客户样品出库需要选择客户',
      path: ['customerId'],
    }
  );

// 调整原因枚举
export const adjustReasonSchema = z.enum(
  [
    'inventory_gain', // 盘盈
    'inventory_loss', // 盘亏
    'damage_loss', // 报损
    'surplus_gain', // 报溢
    'transfer', // 调拨
    'other', // 其他
  ],
  {
    message: '请选择正确的调整原因',
  }
);

// 库存调整验证
export const inventoryAdjustSchema = z
  .object({
    idempotencyKey: z
      .string()
      .uuid('幂等性键格式不正确')
      .describe('幂等性键,防止重复操作'),
    productId: baseValidations.productId,
    batchNumber: baseValidations.batchNumber,
    adjustQuantity: z
      .number()
      .int('调整数量必须为整数')
      .min(-999999, '调整数量不能小于-999,999')
      .max(999999, '调整数量不能超过999,999')
      .refine(val => val !== 0, '调整数量不能为0'),
    reason: adjustReasonSchema,
    notes: z
      .string()
      .max(500, '备注信息不能超过500个字符')
      .optional()
      .or(z.literal('')),
    // ERP必需字段
    variantId: z
      .string()
      .uuid('产品规格信息格式不正确')
      .optional()
      .or(z.literal('')),
    // 新增字段用于边界检查
    currentQuantity: z.number().int().min(0).optional(),
    maxQuantity: z.number().int().min(0).optional(),
    minQuantity: z.number().int().min(0).optional(),
    damageCategory: manualDamageCategorySchema.optional(),
    damageHandling: manualDamageHandlingSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.reason === 'damage_loss' && data.adjustQuantity > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '报损数量必须是负数，表示从库存中扣减',
        path: ['adjustQuantity'],
      });
    }
  });

// 库存盘点明细验证
const inventoryCountItemSchema = z.object({
  productId: baseValidations.productId,
  batchNumber: baseValidations.batchNumber,
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
        const key = `${item.productId}-${item.batchNumber || ''}`;
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
    .array(z.string().uuid({ error: '记录编号格式不正确' }))
    .min(1, { error: '请选择至少一条记录' })
    .max(100, { error: '批量操作最多支持100条记录' }),
  action: z.enum(['delete', 'export'], { message: '请选择有效的操作' }),
  params: z.record(z.string(), z.any()).optional(), // 操作参数
});

// 表单数据类型推导
export type OutboundCreateFormData = z.infer<typeof outboundCreateSchema>;
export type InventoryAdjustFormData = z.infer<typeof inventoryAdjustSchema>;
export type InventoryCountFormData = z.infer<typeof inventoryCountSchema>;
export type BatchOperationFormData = z.infer<typeof batchOperationSchema>;

// 表单默认值
export const outboundCreateDefaults: Partial<OutboundCreateFormData> = {
  type: 'normal_outbound',
  batchNumber: '',
  unitCost: undefined as number | undefined,
  customerId: '',
  salesOrderId: '',
  remarks: '',
};

export const inventoryAdjustDefaults: Partial<InventoryAdjustFormData> = {
  batchNumber: '',
  adjustQuantity: undefined, // 修复：不设置默认值，让用户主动输入
  reason: 'other' as const,
  notes: '',
  variantId: '',
  damageCategory: 'damage',
  damageHandling: 'internal_loss',
};

// 调整原因标签映射
export const ADJUST_REASON_LABELS = {
  inventory_gain: '盘盈',
  inventory_loss: '盘亏',
  damage_loss: '报损',
  surplus_gain: '报溢',
  transfer: '调拨',
  other: '其他',
} as const;

export const MANUAL_DAMAGE_CATEGORY_LABELS = {
  damage: '破损',
  scrap: '报废',
  loss: '丢失',
  other: '其他',
} as const;

export const MANUAL_DAMAGE_HANDLING_LABELS = {
  supplier_claim: '找工厂赔付',
  internal_loss: '内部承担',
} as const;
