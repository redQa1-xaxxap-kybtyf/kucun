/**
 * 厂家发货订单自定义验证逻辑
 * 职责：提供复杂的业务验证规则和辅助验证函数
 */

import { z } from 'zod';

import {
  FACTORY_SHIPMENT_ITEM_OWNERSHIP,
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';

import type { FactoryShipmentOrderItemFormData } from './schemas';

/**
 * 验证手动输入产品的必填字段
 * 手动产品必须填写产品名称，库存产品必须有 productId
 */
export function validateManualProductFields(
  items: FactoryShipmentOrderItemFormData[],
  ctx: z.RefinementCtx,
  status?: FactoryShipmentStatus
): boolean {
  if (!Array.isArray(items) || items.length === 0) {
    return true;
  }

  const isDraft = !status || status === FACTORY_SHIPMENT_STATUS.DRAFT;
  let isValid = true;

  items.forEach((item, index) => {
    if (item.isManualProduct) {
      // 手动产品必须填写产品名称
      const hasName =
        typeof item.manualProductName === 'string' &&
        item.manualProductName.trim() !== '';

      if (!hasName) {
        isValid = false;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '手动输入产品必须填写产品名称',
          path: ['items', index, 'manualProductName'],
        });
      }
    } else if (!isDraft) {
      // 非草稿状态的库存产品必须有 productId
      const hasProductId =
        typeof item.productId === 'string' && item.productId.trim() !== '';

      if (!hasProductId) {
        isValid = false;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '库存产品必须选择产品',
          path: ['items', index, 'productId'],
        });
      }
    }
  });

  return isValid;
}

/**
 * 验证订单明细的必填字段
 * 根据订单状态动态调整验证规则
 */
export function validateRequiredFieldsByStatus(
  items: FactoryShipmentOrderItemFormData[],
  status: FactoryShipmentStatus | undefined,
  ctx: z.RefinementCtx
): void {
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }

  const isDraft = !status || status === FACTORY_SHIPMENT_STATUS.DRAFT;

  items.forEach((item, index) => {
    const path = ['items', index] as const;

    // 非草稿订单的严格验证
    if (!isDraft) {
      // 供应商必填
      if (!item.supplierId || item.supplierId.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'supplierId'],
          message: '非草稿订单必须选择供应商',
        });
      }

      // 产品编码必填
      if (!item.productCode || item.productCode.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'productCode'],
          message: '非草稿订单必须填写产品编码',
        });
      }

      // 产品名称必填
      if (!item.displayName || item.displayName.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'displayName'],
          message: '非草稿订单必须填写产品名称',
        });
      }

      // 数量必须大于0
      if (item.quantity === undefined || item.quantity <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'quantity'],
          message: '非草稿订单的数量必须大于0',
        });
      }

      // 单价不能为空
      if (item.unitPrice === undefined || item.unitPrice < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'unitPrice'],
          message: '非草稿订单的单价不能为空',
        });
      }
    }
  });
}

/**
 * 验证货物归属相关字段
 * 客户货不应有自用入库状态，自用货不应有客户交付状态
 */
export function validateOwnershipFields(
  items: FactoryShipmentOrderItemFormData[],
  ctx: z.RefinementCtx
): void {
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }

  items.forEach((item, index) => {
    const path = ['items', index] as const;

    // 客户货不应设置自用入库状态
    if (
      item.ownership === FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER &&
      item.selfInboundStatus
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'selfInboundStatus'],
        message: '客户货无需设置自用入库状态',
      });
    }

    // 自用货不应设置客户交付状态
    if (
      item.ownership === FACTORY_SHIPMENT_ITEM_OWNERSHIP.SELF &&
      item.customerDeliveryStatus
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'customerDeliveryStatus'],
        message: '自用货无需设置客户交付状态',
      });
    }
  });
}

/**
 * 需要集装箱号码的状态集合
 */
const statusesRequiringContainer = new Set<FactoryShipmentStatus>([
  FACTORY_SHIPMENT_STATUS.SHIPPED,
  FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
  FACTORY_SHIPMENT_STATUS.ARRIVED,
]);

/**
 * 需要船运公司的状态集合
 */
const statusesRequiringShippingCompany = new Set<FactoryShipmentStatus>([
  FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
]);

/**
 * 验证状态相关的必填字段
 * 根据订单状态动态要求不同的字段
 */
export function validateStatusFieldRequirements(
  status: FactoryShipmentStatus | undefined,
  fields: { containerNumber?: string | null; shippingCompany?: string | null },
  ctx: z.RefinementCtx,
  pathOverrides?: {
    containerNumber?: (string | number)[];
    shippingCompany?: (string | number)[];
  }
): void {
  if (!status) {
    return;
  }

  // 已发货、运输中、已到达状态必须有集装箱号码
  if (statusesRequiringContainer.has(status)) {
    if (!fields.containerNumber || fields.containerNumber.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: pathOverrides?.containerNumber ?? ['containerNumber'],
        message: '该状态必须填写集装箱号码',
      });
    }
  }

  // 运输中状态必须有船运公司
  if (statusesRequiringShippingCompany.has(status)) {
    if (!fields.shippingCompany || fields.shippingCompany.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: pathOverrides?.shippingCompany ?? ['shippingCompany'],
        message: '运输中状态必须填写船运公司',
      });
    }
  }
}

/**
 * 组合验证：验证订单明细的所有业务规则
 * 这是一个便捷函数，组合了多个验证器
 */
export function validateFactoryShipmentItems(
  items: FactoryShipmentOrderItemFormData[],
  status: FactoryShipmentStatus | undefined,
  ctx: z.RefinementCtx
): void {
  validateManualProductFields(items, ctx, status);
  validateRequiredFieldsByStatus(items, status, ctx);
  validateOwnershipFields(items, ctx);
}
