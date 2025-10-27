/**
 * 销售订单自定义验证逻辑
 * 职责：提供复杂的业务验证规则和辅助验证函数
 */

import { z } from 'zod';

import {
  transferFulfillmentModeSchema,
  type SalesOrderItemFormData,
} from './schemas';

/**
 * 验证订单明细组合唯一性
 * 确保同一���品的相同规格组合不会重复出现
 */
export function validateItemCombinations(
  items: SalesOrderItemFormData[]
): boolean {
  const combinations = new Set();
  for (const item of items) {
    let key: string;
    if (item.isManualProduct) {
      const name = (item.manualProductName ?? '').trim().toLowerCase();
      const specification = (item.manualSpecification ?? '')
        .trim()
        .toLowerCase();
      const unit = (item.manualUnit ?? '').trim().toLowerCase();
      key = `manual:${name}|${specification}|${unit}`;
    } else {
      const productId = (item.productId ?? '').trim();
      const colorCode = (item.colorCode ?? '').trim().toLowerCase();
      const productionDate = (item.productionDate ?? '').trim();
      const batchNumber = (item.batchNumber ?? '').trim().toLowerCase();
      const specification = (item.specification ?? '').trim().toLowerCase();
      key = `inventory:${productId}|${colorCode}|${productionDate}|${batchNumber}|${specification}`;
    }

    if (combinations.has(key)) {
      return false;
    }
    combinations.add(key);
  }
  return true;
}

/**
 * 验证调货销售的本地发货和调货数量
 * 根据履约模式验证数量关系
 */
export function validateTransferQuantities(
  item: SalesOrderItemFormData,
  transferMode: 'SUPPLIER_ONLY' | 'MIXED',
  ctx: z.RefinementCtx,
  index: number
): void {
  const epsilon = 0.01;
  const quantity =
    typeof item.quantity === 'number' && Number.isFinite(item.quantity)
      ? item.quantity
      : 0;
  const localQuantity =
    typeof item.localQuantity === 'number' &&
    Number.isFinite(item.localQuantity)
      ? item.localQuantity
      : 0;
  const transferQuantity =
    typeof item.transferQuantity === 'number' &&
    Number.isFinite(item.transferQuantity)
      ? item.transferQuantity
      : transferMode === 'MIXED'
        ? 0
        : quantity;

  if (transferMode === 'MIXED') {
    if (localQuantity < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '本地发货数量不能为负数',
        path: ['items', index, 'localQuantity'],
      });
    }
    if (transferQuantity < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '调货数量不能为负数',
        path: ['items', index, 'transferQuantity'],
      });
    }
    if (Math.abs(localQuantity + transferQuantity - quantity) > epsilon) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '本地发货数量与调货数量之和必须等于系统数量',
        path: ['items', index, 'transferQuantity'],
      });
    }
  } else {
    if (Math.abs(localQuantity) > epsilon) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '调货模式下本地发货数量应为0，请检查',
        path: ['items', index, 'localQuantity'],
      });
    }
    if (Math.abs(transferQuantity - quantity) > epsilon) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '调货模式下调货数量必须等于系统数量',
        path: ['items', index, 'transferQuantity'],
      });
    }
  }
}

/**
 * 验证订单明细的必填字段
 * 对非草稿订单强制要求数量和单价
 */
export function validateRequiredFields(
  items: SalesOrderItemFormData[],
  status: string,
  orderType: 'NORMAL' | 'TRANSFER',
  transferMode: 'SUPPLIER_ONLY' | 'MIXED' | undefined,
  ctx: z.RefinementCtx
): void {
  if (status === 'draft') {
    return;
  }

  items.forEach((item, index) => {
    if (typeof item.quantity !== 'number' || Number.isNaN(item.quantity)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '非草稿订单的明细必须填写数量',
        path: ['items', index, 'quantity'],
      });
    }

    if (typeof item.unitPrice !== 'number' || Number.isNaN(item.unitPrice)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '非草稿订单的明细必须填写单价',
        path: ['items', index, 'unitPrice'],
      });
    }

    // 调货销售的数量验证
    if (orderType === 'TRANSFER') {
      const mode =
        transferMode &&
        transferFulfillmentModeSchema.safeParse(transferMode).success
          ? transferMode
          : 'SUPPLIER_ONLY';
      validateTransferQuantities(item, mode, ctx, index);
    }
  });
}

/**
 * 验证手动输入商品的必填字段
 * 手动商品需要产品编码，库存商品需要 productId
 *
 * 特殊规则：
 * - 调货销售订单的手动商品必须填写 productCode（包括草稿状态）
 *   因为后端需要 productCode 来创建临时商品记录
 */
export function validateManualProductFields(
  items: SalesOrderItemFormData[],
  status: string,
  orderType?: 'NORMAL' | 'TRANSFER'
): boolean {
  // 1. 调货销售订单的手动商品必须有 productCode（包括草稿状态）
  // 这是因为后端创建临时商品需要 productCode 字段
  if (orderType === 'TRANSFER') {
    for (const item of items) {
      if (item.isManualProduct) {
        const hasCode =
          typeof item.productCode === 'string' &&
          item.productCode.trim() !== '';

        if (!hasCode) {
          return false;
        }
      }
    }
  }

  // 2. 非草稿状态的订单，所有商品都需要验证必填字段
  if (status === 'draft') {
    return true;
  }

  for (const item of items) {
    if (item.isManualProduct) {
      const hasCode =
        typeof item.productCode === 'string' && item.productCode.trim() !== '';

      if (!hasCode) {
        return false;
      }
    } else {
      // 非手动输入商品必须有productId
      if (!item.productId || item.productId.trim() === '') {
        return false;
      }
    }
  }
  return true;
}
