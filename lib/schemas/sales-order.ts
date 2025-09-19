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
 * 订单项Schema
 */
export const SalesOrderItemSchema = z.object({
  productId: z.string().min(1, '产品ID不能为空'),

  quantity: z.number().int().min(1, '数量必须大于0'),

  unitPrice: z.number().min(0, '单价不能为负数'),

  subtotal: z.number().min(0, '小计不能为负数'),
});

/**
 * 创建销售订单Schema
 */
export const CreateSalesOrderSchema = z.object({
  orderNumber: z
    .string()
    .min(1, '订单号不能为空')
    .max(50, '订单号不能超过50个字符'),

  customerId: z.string().min(1, '客户ID不能为空'),

  status: SalesOrderStatus.default('draft'),

  notes: z.string().max(1000, '备注不能超过1000个字符').optional(),

  items: z.array(SalesOrderItemSchema).min(1, '至少需要一个订单项'),

  totalAmount: z.number().min(0, '总金额不能为负数').optional(),
});

/**
 * 更新销售订单Schema
 */
export const UpdateSalesOrderSchema = CreateSalesOrderSchema.partial().extend({
  id: z.string().min(1, 'ID不能为空'),
});

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

/**
 * 销售订单表单默认值
 */
export const salesOrderFormDefaults: CreateSalesOrderData = {
  orderNumber: '',
  customerId: '',
  status: 'draft',
  notes: '',
  items: [],
};

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
 * 计算订单总金额
 */
export function calculateOrderTotal(items: SalesOrderItemData[]): number {
  return items.reduce((total, item) => total + item.subtotal, 0);
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
      item.unitPrice >= 0 &&
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
