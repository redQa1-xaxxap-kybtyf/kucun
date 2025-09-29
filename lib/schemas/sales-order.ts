import { z } from 'zod';

// 销售订单项数据类型
export const SalesOrderItemSchema = z.object({
  productId: z.string().optional(),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0).optional(),
  subtotal: z.number().min(0).optional(),
  displayUnit: z.enum(['片', '件']).default('件'),
  displayQuantity: z.number().min(1).default(1),
  colorCode: z.string().optional(),
  productionDate: z.string().optional(),
  unitCost: z.number().min(0).optional(),
  isManualProduct: z.boolean().optional().default(false),
  manualProductName: z.string().optional(),
  manualSpecification: z.string().optional(),
  manualWeight: z.number().optional(),
  manualUnit: z.string().optional(),
  // 产品相关字段
  specification: z.string().optional(),
  unit: z.string().optional(),
  piecesPerUnit: z.number().optional(),
});

// 创建销售订单数据类型
export const CreateSalesOrderSchema = z.object({
  customerId: z.string().min(1, '客户ID不能为空'),
  orderType: z.enum(['NORMAL', 'TRANSFER']).default('NORMAL'),
  status: z
    .enum(['draft', 'confirmed', 'shipped', 'completed', 'cancelled'])
    .default('draft'),
  items: z.array(SalesOrderItemSchema).min(1, '至少需要一个订单项'),
  remarks: z.string().optional(),
  orderNumber: z.string().optional(),
  totalAmount: z.number().min(0).optional(),
});

// 导出类型
export type SalesOrderItemData = z.infer<typeof SalesOrderItemSchema>;
export type CreateSalesOrderData = z.infer<typeof CreateSalesOrderSchema>;

// 默认值
export const salesOrderFormDefaults = {
  customerId: '',
  orderType: 'NORMAL' as const,
  status: 'draft' as const,
  items: [],
  remarks: '',
  totalAmount: 0,
};

// 表单数据类型
export type SalesOrderCreateFormData = CreateSalesOrderData;
export type SalesOrderUpdateFormData = CreateSalesOrderData & {
  id: string;
};

// 计算函数
export function calculateItemSubtotal(
  quantity: number,
  unitPrice: number
): number {
  return quantity * unitPrice;
}

export function calculateOrderTotal(items: SalesOrderItemData[]): number {
  return items.reduce((total, item) => {
    const unitPrice = item.unitPrice || 0;
    return total + calculateItemSubtotal(item.quantity, unitPrice);
  }, 0);
}
