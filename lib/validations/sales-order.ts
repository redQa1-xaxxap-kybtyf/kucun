import { z } from 'zod';

import type {
  SalesOrderStatus } from '@/lib/types/sales-order';
import {
  SalesOrderCreateInput,
  SalesOrderUpdateInput,
  SalesOrderQueryParams,
  SalesOrderItemCreateInput,
  SalesOrderItemUpdateInput
} from '@/lib/types/sales-order';

// 基础验证规则
const baseValidations = {
  customerId: z.string().min(1, '请选择客户').uuid('客户ID格式不正确'),

  remarks: z
    .string()
    .max(500, '备注信息不能超过500个字符')
    .optional()
    .or(z.literal('')),

  status: z.enum(['draft', 'confirmed', 'shipped', 'completed', 'cancelled'], {
    errorMap: () => ({ message: '请选择正确的订单状态' }),
  }),
};

// 销售订单明细验证规则
const orderItemValidations = {
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
    .min(0.01, '数量必须大于0')
    .max(999999.99, '数量不能超过999,999.99')
    .multipleOf(0.01, '数量最多保留2位小数'),

  unitPrice: z
    .number()
    .min(0.01, '单价必须大于0')
    .max(999999.99, '单价不能超过999,999.99')
    .multipleOf(0.01, '单价最多保留2位小数'),
};

// 销售订单明细创建验证
export const salesOrderItemCreateSchema = z.object({
  productId: orderItemValidations.productId,
  colorCode: orderItemValidations.colorCode,
  productionDate: orderItemValidations.productionDate,
  quantity: orderItemValidations.quantity,
  unitPrice: orderItemValidations.unitPrice,
});

// 销售订单明细更新验证
export const salesOrderItemUpdateSchema = z.object({
  id: z.string().uuid('明细ID格式不正确').optional(),
  productId: orderItemValidations.productId,
  colorCode: orderItemValidations.colorCode,
  productionDate: orderItemValidations.productionDate,
  quantity: orderItemValidations.quantity,
  unitPrice: orderItemValidations.unitPrice,
  _action: z.enum(['create', 'update', 'delete']).optional(),
});

// 销售订单创建表单验证
export const salesOrderCreateSchema = z
  .object({
    customerId: baseValidations.customerId,
    remarks: baseValidations.remarks,
    items: z
      .array(salesOrderItemCreateSchema)
      .min(1, '至少需要添加一个订单明细')
      .max(100, '订单明细不能超过100条'),
  })
  .refine(
    data => {
      // 验证订单明细中是否有重复的产品+色号+生产日期组合
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
      message: '订单明细中存在重复的产品规格组合',
      path: ['items'],
    }
  );

// 销售订单更新表单验证
export const salesOrderUpdateSchema = z
  .object({
    id: z.string().min(1, '订单ID不能为空'),
    customerId: baseValidations.customerId.optional(),
    status: baseValidations.status.optional(),
    remarks: baseValidations.remarks,
    items: z
      .array(salesOrderItemUpdateSchema)
      .min(1, '至少需要保留一个订单明细')
      .max(100, '订单明细不能超过100条')
      .optional(),
  })
  .refine(
    data => {
      // 验证订单明细中是否有重复的产品+色号+生产日期组合
      if (!data.items) return true;

      const combinations = new Set();
      for (const item of data.items) {
        if (item._action === 'delete') continue; // 跳过删除的明细

        const key = `${item.productId}-${item.colorCode || ''}-${item.productionDate || ''}`;
        if (combinations.has(key)) {
          return false;
        }
        combinations.add(key);
      }
      return true;
    },
    {
      message: '订单明细中存在重复的产品规格组合',
      path: ['items'],
    }
  );

// 销售订单搜索表单验证
export const salesOrderSearchSchema = z
  .object({
    search: z.string().max(100, '搜索关键词不能超过100个字符').optional(),
    status: z
      .enum(['draft', 'confirmed', 'shipped', 'completed', 'cancelled'])
      .optional()
      .or(z.literal('all')),
    customerId: z
      .string()
      .uuid('客户ID格式不正确')
      .optional()
      .or(z.literal('')),
    userId: z.string().uuid('销售员ID格式不正确').optional().or(z.literal('')),
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
      .enum(['orderNumber', 'createdAt', 'updatedAt', 'totalAmount', 'status'])
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

// 状态更新验证
export const salesOrderStatusUpdateSchema = z.object({
  id: z.string().min(1, '订单ID不能为空'),
  status: baseValidations.status,
  remarks: z.string().max(200, '状态更新备注不能超过200个字符').optional(),
});

// 表单数据类型推导
export type SalesOrderCreateFormData = z.infer<typeof salesOrderCreateSchema>;
export type SalesOrderUpdateFormData = z.infer<typeof salesOrderUpdateSchema>;
export type SalesOrderSearchFormData = z.infer<typeof salesOrderSearchSchema>;
export type SalesOrderItemCreateFormData = z.infer<
  typeof salesOrderItemCreateSchema
>;
export type SalesOrderItemUpdateFormData = z.infer<
  typeof salesOrderItemUpdateSchema
>;
export type SalesOrderStatusUpdateFormData = z.infer<
  typeof salesOrderStatusUpdateSchema
>;

// 表单默认值
export const salesOrderCreateDefaults: Partial<SalesOrderCreateFormData> = {
  customerId: '',
  remarks: '',
  items: [],
};

export const salesOrderSearchDefaults: SalesOrderSearchFormData = {
  search: '',
  status: 'all',
  customerId: '',
  userId: '',
  startDate: '',
  endDate: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

// 新增订单明细默认值
export const newOrderItemDefaults: SalesOrderItemCreateFormData = {
  productId: '',
  colorCode: '',
  productionDate: '',
  quantity: 1,
  unitPrice: 0,
};

// 验证辅助函数
export const validateOrderItemCombination = (
  items: SalesOrderItemCreateFormData[] | SalesOrderItemUpdateFormData[]
): { isValid: boolean; duplicateIndex?: number } => {
  const combinations = new Map<string, number>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // 跳过删除的明细
    if ('_action' in item && item._action === 'delete') continue;

    const key = `${item.productId}-${item.colorCode || ''}-${item.productionDate || ''}`;

    if (combinations.has(key)) {
      return { isValid: false, duplicateIndex: i };
    }

    combinations.set(key, i);
  }

  return { isValid: true };
};

// 计算订单明细小计
export const calculateItemSubtotal = (
  quantity: number,
  unitPrice: number
): number => Math.round(quantity * unitPrice * 100) / 100;

// 计算订单总金额
export const calculateOrderTotal = (
  items: SalesOrderItemCreateFormData[] | SalesOrderItemUpdateFormData[]
): number => (
    Math.round(
      items
        .filter(item => !('_action' in item) || item._action !== 'delete')
        .reduce(
          (total, item) =>
            total + calculateItemSubtotal(item.quantity, item.unitPrice),
          0
        ) * 100
    ) / 100
  );

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

// 订单状态流转验证
export const validateStatusTransition = (
  currentStatus: SalesOrderStatus,
  targetStatus: SalesOrderStatus
): boolean => {
  const transitions: Record<SalesOrderStatus, SalesOrderStatus[]> = {
    draft: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  return transitions[currentStatus].includes(targetStatus);
};

// 批量操作验证
export const batchOperationSchema = z.object({
  ids: z
    .array(z.string().uuid('订单ID格式不正确'))
    .min(1, '请选择至少一个订单')
    .max(50, '批量操作最多支持50个订单'),
  action: z.enum(['delete', 'updateStatus', 'export']),
  params: z.record(z.any()).optional(), // 操作参数
});
