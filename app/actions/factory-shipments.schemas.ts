import { z } from 'zod';

import {
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';

const FACTORY_SHIPMENT_STATUS_VALUES = Object.values(
  FACTORY_SHIPMENT_STATUS
) as FactoryShipmentStatus[];

export const factoryShipmentStatusEnum = z.enum(
  FACTORY_SHIPMENT_STATUS_VALUES as [
    FactoryShipmentStatus,
    ...FactoryShipmentStatus[],
  ]
);

export const factoryShipmentItemSchema = z
  .object({
    productId: z.string().optional(),
    supplierId: z.string().min(1, '供应商 ID 不能为空'),
    productCode: z.string().min(1, '产品编码不能为空'),
    isManualProduct: z.boolean().optional(),
    manualProductName: z.string().optional(),
    manualSpecification: z.string().optional(),
    manualWeight: z.number().nonnegative('重量不能为负数').optional(),
    manualUnit: z.string().optional(),
    displayName: z.string().min(1, '商品名称不能为空'),
    specification: z.string().optional(),
    unit: z.string().optional(),
    weight: z.number().nonnegative('重量不能为负数').optional(),
    quantity: z.number().positive('数量必须大于 0'),
    unitPrice: z.number().nonnegative('单价不能为负'),
    totalPrice: z.number().nonnegative('总价不能为负'),
    remarks: z.string().optional(),
  })
  .superRefine((item, ctx) => {
    const trimmedManualName = item.manualProductName?.trim();
    const hasProduct = Boolean(item.productId && item.productId.trim());
    const isManual = Boolean(item.isManualProduct);

    if (!isManual && !hasProduct) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请选择商品或启用手动商品',
      });
    }

    if (isManual && !trimmedManualName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '手动商品必须填写名称',
        path: ['manualProductName'],
      });
    }
  });

export const createFactoryShipmentSchema = z.object({
  customerId: z.string().min(1, '客户 ID 不能为空'),
  containerNumber: z.string().optional(),
  status: factoryShipmentStatusEnum.default(FACTORY_SHIPMENT_STATUS.DRAFT),
  shipmentDate: z.string().optional(),
  arrivalDate: z.string().optional(),
  items: z.array(factoryShipmentItemSchema).min(1, '至少需要一个商品项'),
  receivableAmount: z.number().nonnegative('应收金额不能为负').optional(),
  depositAmount: z.number().nonnegative('定金金额不能为负').optional(),
  remarks: z.string().optional(),
});

export const updateFactoryShipmentStatusSchema = z.object({
  shipmentId: z.string().min(1, '发货单 ID 不能为空'),
  status: factoryShipmentStatusEnum,
});

export type FactoryShipmentItemInput = z.infer<typeof factoryShipmentItemSchema>;
export type FactoryShipmentFormData = z.infer<typeof createFactoryShipmentSchema>;

