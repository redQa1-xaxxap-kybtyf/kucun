import { z } from 'zod';

import { INVENTORY_THRESHOLDS } from '@/lib/types/inventory-status';

/**
 * 库存管理基础验证规则
 * 提供通用的字段验证规则，供其他验证模块使用
 */

// 基础验证规则
export const baseValidations = {
  productId: z.string().min(1, '请选择产品').uuid('产品ID格式不正确'),

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

  batchNumber: z
    .string()
    .max(50, '批次号不能超过50个字符')
    .optional()
    .or(z.literal('')),
};

/**
 * 验证辅助函数
 */

// 验证库存数量是否足够
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

// 计算总成本
export const calculateTotalCost = (
  quantity: number,
  unitCost: number
): number => Math.round(quantity * unitCost * 100) / 100;

/**
 * 验证库存调整边界
 * @param currentQuantity 当前库存数量
 * @param adjustQuantity 调整数量（正数为增加，负数为减少）
 * @param reservedQuantity 预留数量
 * @param minQuantity 最小库存阈值
 * @param maxQuantity 最大库存阈值
 * @returns 验证结果
 */
export const validateInventoryAdjustment = (
  currentQuantity: number,
  adjustQuantity: number,
  reservedQuantity: number = 0,
  minQuantity: number = INVENTORY_THRESHOLDS.DEFAULT_MIN_QUANTITY,
  maxQuantity: number = 999999
): { isValid: boolean; message?: string; warnings?: string[] } => {
  const newQuantity = currentQuantity + adjustQuantity;
  const warnings: string[] = [];

  // 检查调整后数量不能为负数
  if (newQuantity < 0) {
    return {
      isValid: false,
      message: `调整后库存数量(${newQuantity})不能为负数`,
    };
  }

  // 检查调整后数量不能低于预留数量
  if (newQuantity < reservedQuantity) {
    return {
      isValid: false,
      message: `调整后可用库存(${newQuantity})不能低于预留数量(${reservedQuantity})`,
    };
  }

  // 检查调整后数量不能超过最大库存
  if (newQuantity > maxQuantity) {
    return {
      isValid: false,
      message: `调整后库存数量(${newQuantity})不能超过最大库存限制(${maxQuantity})`,
    };
  }

  // 警告：调整后库存低于最小阈值
  if (newQuantity <= INVENTORY_THRESHOLDS.CRITICAL_MIN_QUANTITY) {
    warnings.push(
      `调整后库存(${newQuantity})将低于紧急阈值(${INVENTORY_THRESHOLDS.CRITICAL_MIN_QUANTITY})，可能导致缺货`
    );
  } else if (newQuantity <= minQuantity) {
    warnings.push(
      `调整后库存(${newQuantity})将低于安全库存(${minQuantity})，建议及时补货`
    );
  }

  // 警告：调整后库存过多
  const overstockThreshold =
    minQuantity * INVENTORY_THRESHOLDS.OVERSTOCK_MULTIPLIER;
  if (newQuantity > overstockThreshold) {
    warnings.push(
      `调整后库存(${newQuantity})将超过建议库存(${overstockThreshold})，可能造成资金占用`
    );
  }

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
};
