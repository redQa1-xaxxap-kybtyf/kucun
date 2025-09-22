/**
 * 销售订单相关的Zod验证Schema
 * 严格遵循全栈项目统一约定规范
 */

import { z } from 'zod';

/**
 * 订单状态枚举
 */
export const SalesOrderStatus = z.enum([
  'draft', // 草稿
  'confirmed', // 已确认
  'shipped', // 已发货
  'completed', // 已完成
  'cancelled', // 已取消
]);

/**
 * 销售订单类型枚举
 */
export const SalesOrderType = z.enum(['NORMAL', 'TRANSFER']);

/**
 * 订单项Schema
 */
export const SalesOrderItemSchema = z.object({
  productId: z.string().min(1, '产品ID不能为空'),

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

  specification: z
    .string()
    .max(100, '规格不能超过100个字符')
    .optional()
    .or(z.literal('')),

  // 用户界面显示的单位（片或件）
  displayUnit: z.enum(['片', '件']).default('片'),

  // 用户界面输入的数量（根据displayUnit）
  displayQuantity: z
    .number()
    .min(0.01, '数量必须大于0')
    .max(999999.99, '数量不能超过999,999.99')
    .multipleOf(0.01, '数量最多保留2位小数'),

  // 系统内部存储的数量（始终以片为单位）
  quantity: z
    .number()
    .min(0.01, '数量必须大于0')
    .max(999999.99, '数量不能超过999,999.99')
    .multipleOf(0.01, '数量最多保留2位小数'),

  // 保留原有的unit字段用于兼容性（从产品数据获取）
  unit: z.string().max(20, '单位不能超过20个字符').optional().or(z.literal('')),

  unitPrice: z
    .number()
    .min(0.01, '单价必须大于0')
    .max(999999.99, '单价不能超过999,999.99')
    .multipleOf(0.01, '单价最多保留2位小数')
    .optional(),

  piecesPerUnit: z
    .number()
    .min(1, '每件片数必须大于0')
    .max(9999, '每件片数不能超过9999')
    .optional(),

  remarks: z
    .string()
    .max(200, '备注不能超过200个字符')
    .optional()
    .or(z.literal('')),

  subtotal: z.number().min(0, '小计不能为负数').optional(),
});

/**
 * 基础销售订单Schema（不包含自定义验证）
 */
const BaseSalesOrderSchema = z.object({
  orderNumber: z
    .string()
    .min(1, '订单号不能为空')
    .max(50, '订单号不能超过50个字符')
    .optional(), // 订单号可选，由后端自动生成

  customerId: z.string().min(1, '客户ID不能为空'),

  status: SalesOrderStatus.default('draft'),

  orderType: SalesOrderType.default('NORMAL'),

  supplierId: z
    .string()
    .min(1, '供应商ID不能为空')
    .optional()
    .or(z.literal('')),

  costAmount: z
    .number()
    .min(0, '成本金额不能为负数')
    .max(999999999.99, '成本金额不能超过999,999,999.99')
    .multipleOf(0.01, '成本金额最多保留2位小数')
    .optional(),

  remarks: z
    .string()
    .max(1000, '备注不能超过1000个字符')
    .optional()
    .or(z.literal('')),

  items: z
    .array(SalesOrderItemSchema)
    .min(1, '至少需要一个订单项')
    .max(100, '订单明细不能超过100条'),

  totalAmount: z.number().min(0, '总金额不能为负数').optional(),
});

/**
 * 验证订单明细组合唯一性的函数
 */
function validateItemCombinations(items: SalesOrderItemData[]): boolean {
  const combinations = new Set();
  for (const item of items) {
    const key = `${item.productId}-${item.colorCode || ''}-${item.productionDate || ''}`;
    if (combinations.has(key)) {
      return false;
    }
    combinations.add(key);
  }
  return true;
}

/**
 * 创建销售订单Schema
 */
export const CreateSalesOrderSchema = BaseSalesOrderSchema.refine(
  data => validateItemCombinations(data.items),
  {
    message: '订单明细中存在重复的产品规格组合',
    path: ['items'],
  }
)
  .refine(
    data => {
      // 调货销售必须填写供应商
      if (data.orderType === 'TRANSFER') {
        return data.supplierId && data.supplierId.trim() !== '';
      }
      return true;
    },
    {
      message: '调货销售必须选择供应商',
      path: ['supplierId'],
    }
  )
  .refine(
    data => {
      // 调货销售必须填写成本金额
      if (data.orderType === 'TRANSFER') {
        return data.costAmount !== undefined && data.costAmount > 0;
      }
      return true;
    },
    {
      message: '调货销售必须填写成本金额',
      path: ['costAmount'],
    }
  );

/**
 * 更新销售订单Schema
 */
export const UpdateSalesOrderSchema = BaseSalesOrderSchema.partial()
  .extend({
    id: z.string().min(1, 'ID不能为空'),
  })
  .refine(
    data => {
      // 只有当items存在时才验证组合唯一性
      if (data.items && data.items.length > 0) {
        return validateItemCombinations(data.items);
      }
      return true;
    },
    {
      message: '订单明细中存在重复的产品规格组合',
      path: ['items'],
    }
  );

/**
 * 销售订单查询参数Schema
 */
export const SalesOrderQuerySchema = z.object({
  page: z.number().int().min(1).default(1),

  limit: z.number().int().min(1).max(100).default(20),

  search: z.string().optional(),

  sortBy: z
    .enum(['orderNumber', 'totalAmount', 'createdAt', 'updatedAt'])
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  status: SalesOrderStatus.optional(),

  customerId: z.string().optional(),

  dateFrom: z.string().optional(),

  dateTo: z.string().optional(),
});

/**
 * 批量删除销售订单Schema
 */
export const BatchDeleteSalesOrdersSchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, '至少选择一个订单')
    .max(100, '一次最多删除100个订单'),
});

/**
 * 订单状态更新Schema
 */
export const UpdateOrderStatusSchema = z.object({
  id: z.string().min(1, 'ID不能为空'),
  status: SalesOrderStatus,
  notes: z.string().optional(),
});

// 导出类型
export type CreateSalesOrderData = z.infer<typeof CreateSalesOrderSchema>;
export type UpdateSalesOrderData = z.infer<typeof UpdateSalesOrderSchema>;
export type SalesOrderQueryParams = z.infer<typeof SalesOrderQuerySchema>;
export type SalesOrderItemData = z.infer<typeof SalesOrderItemSchema>;
export type BatchDeleteSalesOrdersData = z.infer<
  typeof BatchDeleteSalesOrdersSchema
>;
export type UpdateOrderStatusData = z.infer<typeof UpdateOrderStatusSchema>;
export type SalesOrderStatusType = z.infer<typeof SalesOrderStatus>;
export type SalesOrderTypeType = z.infer<typeof SalesOrderType>;

/**
 * 销售订单表单默认值
 */
export const salesOrderFormDefaults: CreateSalesOrderData = {
  customerId: '',
  status: 'draft',
  orderType: 'NORMAL',
  supplierId: '',
  costAmount: undefined,
  remarks: '',
  items: [],
};

/**
 * 订单类型选项
 */
export const SALES_ORDER_TYPE_OPTIONS = [
  { value: 'NORMAL', label: '正常销售' },
  { value: 'TRANSFER', label: '调货销售' },
] as const;

/**
 * 订单状态选项
 */
export const SALES_ORDER_STATUS_OPTIONS = [
  { value: 'draft', label: '草稿', color: 'gray' },
  { value: 'confirmed', label: '已确认', color: 'blue' },
  { value: 'shipped', label: '已发货', color: 'yellow' },
  { value: 'completed', label: '已完成', color: 'green' },
  { value: 'cancelled', label: '已取消', color: 'red' },
] as const;

/**
 * 获取订单状态显示信息
 */
export function getOrderStatusInfo(status: SalesOrderStatusType) {
  return (
    SALES_ORDER_STATUS_OPTIONS.find(option => option.value === status) || {
      value: status,
      label: status,
      color: 'gray',
    }
  );
}

/**
 * 验证订单号唯一性（前端预检查）
 */
export function validateOrderNumber(orderNumber: string): boolean {
  return orderNumber.length >= 1 && orderNumber.length <= 50;
}

/**
 * 计算订单明细小计
 */
export function calculateItemSubtotal(
  quantity: number,
  unitPrice: number | undefined
): number {
  if (!unitPrice || unitPrice <= 0) return 0;
  return Math.round(quantity * unitPrice * 100) / 100;
}

/**
 * 计算订单总金额
 */
export function calculateOrderTotal(items: SalesOrderItemData[]): number {
  return (
    Math.round(
      items
        .filter(
          item => item.quantity > 0 && item.unitPrice && item.unitPrice > 0
        )
        .reduce(
          (total, item) =>
            total + calculateItemSubtotal(item.quantity, item.unitPrice),
          0
        ) * 100
    ) / 100
  );
}

/**
 * 验证订单项数据
 */
export function validateOrderItems(items: SalesOrderItemData[]): boolean {
  if (items.length === 0) return false;

  return items.every(
    item =>
      item.productId &&
      item.quantity > 0 &&
      (item.unitPrice === undefined || item.unitPrice >= 0) &&
      item.subtotal >= 0
  );
}

/**
 * 格式化订单金额显示
 */
export function formatOrderAmount(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

/**
 * 生成订单号（前端辅助函数）
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const timestamp = now.getTime().toString().slice(-6);

  return `SO${year}${month}${day}${timestamp}`;
}

/**
 * 检查订单是否可以编辑
 */
export function canEditOrder(status: SalesOrderStatusType): boolean {
  return status === 'draft' || status === 'confirmed';
}

/**
 * 检查订单是否可以取消
 */
export function canCancelOrder(status: SalesOrderStatusType): boolean {
  return status === 'draft' || status === 'confirmed';
}

/**
 * 检查订单是否可以发货
 */
export function canShipOrder(status: SalesOrderStatusType): boolean {
  return status === 'confirmed';
}

/**
 * 检查订单是否可以完成
 */
export function canCompleteOrder(status: SalesOrderStatusType): boolean {
  return status === 'shipped';
}

/**
 * 验证订单明细组合唯一性
 */
export function validateOrderItemCombination(items: SalesOrderItemData[]): {
  isValid: boolean;
  duplicateIndex?: number;
} {
  const combinations = new Map<string, number>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = `${item.productId}-${item.colorCode || ''}-${item.productionDate || ''}`;

    if (combinations.has(key)) {
      return { isValid: false, duplicateIndex: i };
    }

    combinations.set(key, i);
  }

  return { isValid: true };
}

/**
 * 生产日期验证
 */
export function validateProductionDate(dateString: string): boolean {
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
}

/**
 * 色号验证
 */
export function validateColorCode(colorCode: string): boolean {
  if (!colorCode) return true; // 可选字段

  // 色号格式：字母+数字组合，长度3-20
  const colorCodeRegex = /^[A-Z0-9]{3,20}$/;
  return colorCodeRegex.test(colorCode.toUpperCase());
}

/**
 * 订单状态流转验证
 */
export function validateStatusTransition(
  currentStatus: SalesOrderStatusType,
  targetStatus: SalesOrderStatusType
): boolean {
  const transitions: Record<SalesOrderStatusType, SalesOrderStatusType[]> = {
    draft: ['confirmed', 'cancelled'],
    confirmed: ['shipped', 'cancelled'],
    shipped: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  return transitions[currentStatus].includes(targetStatus);
}
