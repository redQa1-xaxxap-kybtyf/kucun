import { z } from 'zod';

// 注意：这些类型在未来版本中将被使用
// import {
//   InboundCreateInput,
//   OutboundCreateInput,
//   InventoryAdjustInput,
//   InventoryCountInput,
//   InventoryQueryParams,
//   InboundRecordQueryParams,
//   OutboundRecordQueryParams,
//   InboundType,
//   OutboundType,
// } from '@/lib/types/inventory';

// 基础验证规则
const baseValidations = {
  productId: z.string().min(1, '请选择产品').uuid('产品ID格式不正确'),

  colorCode: z
    .string()
    .max(20, '色号不能超过20个字符')
    .optional()
    .or(z.literal('')),

  productionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '生产日期格式不正确，请使用YYYY-MM-DD格式')
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

// 入库操作验证
export const inboundCreateSchema = z
  .object({
    type: z.enum(['normal_inbound', 'return_inbound', 'adjust_inbound'], {
      errorMap: () => ({ message: '请选择正确的入库类型' }),
    }),
    productId: baseValidations.productId,
    colorCode: baseValidations.colorCode,
    productionDate: baseValidations.productionDate,
    quantity: baseValidations.quantity,
    unitCost: baseValidations.unitCost,
    supplierId: baseValidations.supplierId,
    remarks: baseValidations.remarks,
  })
  .refine(
    data => {
      // 正常入库和退货入库需要单位成本
      if (
        (data.type === 'normal_inbound' || data.type === 'return_inbound') &&
        !data.unitCost
      ) {
        return false;
      }
      return true;
    },
    {
      message: '正常入库和退货入库需要填写单位成本',
      path: ['unitCost'],
    }
  )
  .refine(
    data => {
      // 正常入库需要供应商
      if (data.type === 'normal_inbound' && !data.supplierId) {
        return false;
      }
      return true;
    },
    {
      message: '正常入库需要选择供应商',
      path: ['supplierId'],
    }
  );

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

// 库存搜索表单验证
export const inventorySearchSchema = z
  .object({
    search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
    productId: z.string().uuid('产品ID格式不正确').optional().or(z.literal('')),
    colorCode: z
      .string()
      .max(20, '色号不能超过20个字符')
      .optional()
      .or(z.literal('')),
    lowStock: z.boolean().optional(),
    hasStock: z.boolean().optional(),
    productionDateStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式不正确')
      .optional()
      .or(z.literal('')),
    productionDateEnd: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式不正确')
      .optional()
      .or(z.literal('')),
    sortBy: z
      .enum(['productName', 'quantity', 'reservedQuantity', 'updatedAt'])
      .default('updatedAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    data => {
      // 验证日期范围
      if (data.productionDateStart && data.productionDateEnd) {
        return (
          new Date(data.productionDateStart) <= new Date(data.productionDateEnd)
        );
      }
      return true;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['productionDateEnd'],
    }
  );

// 入库记录搜索表单验证
export const inboundRecordSearchSchema = z
  .object({
    search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
    type: z
      .enum(['normal_inbound', 'return_inbound', 'adjust_inbound'])
      .optional()
      .or(z.literal('')),
    productId: z.string().uuid('产品ID格式不正确').optional().or(z.literal('')),
    userId: z.string().uuid('用户ID格式不正确').optional().or(z.literal('')),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式不正确')
      .optional()
      .or(z.literal('')),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式不正确')
      .optional()
      .or(z.literal('')),
    sortBy: z
      .enum(['createdAt', 'recordNumber', 'quantity', 'totalCost'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    data => {
      // 验证日期范围
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  );

// 出库记录搜索表单验证
export const outboundRecordSearchSchema = z
  .object({
    search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
    type: z
      .enum(['normal_outbound', 'sales_outbound', 'adjust_outbound'])
      .optional()
      .or(z.literal('')),
    productId: z.string().uuid('产品ID格式不正确').optional().or(z.literal('')),
    customerId: z
      .string()
      .uuid('客户ID格式不正确')
      .optional()
      .or(z.literal('')),
    salesOrderId: z
      .string()
      .uuid('销售订单ID格式不正确')
      .optional()
      .or(z.literal('')),
    userId: z.string().uuid('用户ID格式不正确').optional().or(z.literal('')),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '开始日期格式不正确')
      .optional()
      .or(z.literal('')),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '结束日期格式不正确')
      .optional()
      .or(z.literal('')),
    sortBy: z
      .enum(['createdAt', 'recordNumber', 'quantity', 'totalCost'])
      .default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    data => {
      // 验证日期范围
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: '开始日期不能晚于结束日期',
      path: ['endDate'],
    }
  );

// 表单数据类型推导
export type InboundCreateFormData = z.infer<typeof inboundCreateSchema>;
export type OutboundCreateFormData = z.infer<typeof outboundCreateSchema>;
export type InventoryAdjustFormData = z.infer<typeof inventoryAdjustSchema>;
export type InventoryCountFormData = z.infer<typeof inventoryCountSchema>;
export type InventorySearchFormData = z.infer<typeof inventorySearchSchema>;
export type InboundRecordSearchFormData = z.infer<
  typeof inboundRecordSearchSchema
>;
export type OutboundRecordSearchFormData = z.infer<
  typeof outboundRecordSearchSchema
>;

// 表单默认值
export const inboundCreateDefaults: Partial<InboundCreateFormData> = {
  type: 'normal_inbound',
  colorCode: '',
  productionDate: '',
  unitCost: undefined,
  supplierId: '',
  remarks: '',
};

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

export const inventorySearchDefaults: InventorySearchFormData = {
  search: '',
  productId: '',
  colorCode: '',
  lowStock: undefined,
  hasStock: undefined,
  productionDateStart: '',
  productionDateEnd: '',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

export const inboundRecordSearchDefaults: InboundRecordSearchFormData = {
  search: '',
  type: '',
  productId: '',
  userId: '',
  startDate: '',
  endDate: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export const outboundRecordSearchDefaults: OutboundRecordSearchFormData = {
  search: '',
  type: '',
  productId: '',
  customerId: '',
  salesOrderId: '',
  userId: '',
  startDate: '',
  endDate: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

// 验证辅助函数
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

// 生产日期验证
export const validateProductionDate = (dateString: string): boolean => {
  if (!dateString) return true; // 可选字段

  try {
    const date = new Date(dateString);
    const now = new Date();

    // 生产日期不能是未来日期
    if (date > now) return false;

    // 生产日期不能太久远（比如超过10年）
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(now.getFullYear() - 10);
    if (date < tenYearsAgo) return false;

    return true;
  } catch {
    return false;
  }
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

// 批量操作验证
export const batchOperationSchema = z.object({
  ids: z
    .array(z.string().uuid('记录ID格式不正确'))
    .min(1, '请选择至少一条记录')
    .max(100, '批量操作最多支持100条记录'),
  action: z.enum(['delete', 'export']),
  params: z.record(z.any()).optional(), // 操作参数
});
