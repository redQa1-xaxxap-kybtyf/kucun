/**
 * 片数计算工具函数
 * 严格遵循全栈项目统一约定规范
 *
 * 核心原则：
 * 1. 数据库统一存储总片数
 * 2. 前端显示时根据产品的piecesPerUnit进行换算
 * 3. 确保计算精度，避免浮点数误差
 */

import type { Product } from '@/lib/types/product';

/**
 * 片数计算结果类型
 */
export interface PieceCalculationResult {
  /** 完整件数 */
  fullUnits: number;
  /** 剩余片数 */
  remainingPieces: number;
  /** 总片数 */
  totalPieces: number;
  /** 格式化显示文本 */
  displayText: string;
  /** 详细显示文本（包含总片数） */
  detailText: string;
}

/**
 * 输入数量类型
 */
export interface QuantityInput {
  /** 输入的数量值 */
  value: number;
  /** 输入的单位类型 */
  unit: 'pieces' | 'units';
}

/**
 * 根据产品的每件片数，将总片数转换为件数+片数的显示格式
 *
 * @param totalPieces 总片数
 * @param piecesPerUnit 每件片数
 * @returns 计算结果
 */
export function calculatePieceDisplay(
  totalPieces: number,
  piecesPerUnit: number
): PieceCalculationResult {
  // 输入验证
  if (!Number.isInteger(totalPieces) || totalPieces < 0) {
    throw new Error('总片数必须是非负整数');
  }

  if (!Number.isInteger(piecesPerUnit) || piecesPerUnit <= 0) {
    throw new Error('每件片数必须是正整数');
  }

  // 计算完整件数和剩余片数
  const fullUnits = Math.floor(totalPieces / piecesPerUnit);
  const remainingPieces = totalPieces % piecesPerUnit;

  // 生成显示文本
  let displayText: string;
  if (fullUnits === 0) {
    displayText = `${remainingPieces}片`;
  } else if (remainingPieces === 0) {
    displayText = `${fullUnits}件`;
  } else {
    displayText = `${fullUnits}件+${remainingPieces}片`;
  }

  // 生成详细显示文本
  const detailText = `${displayText} (总计${totalPieces}片)`;

  return {
    fullUnits,
    remainingPieces,
    totalPieces,
    displayText,
    detailText,
  };
}

/**
 * 根据用户输入的数量和单位，计算总片数
 *
 * @param input 用户输入
 * @param piecesPerUnit 每件片数
 * @returns 总片数
 */
export function calculateTotalPieces(
  input: QuantityInput,
  piecesPerUnit: number
): number {
  // 输入验证
  if (input.value < 0) {
    throw new Error('数量不能为负数');
  }

  if (!Number.isInteger(piecesPerUnit) || piecesPerUnit <= 0) {
    throw new Error('每件片数必须是正整数');
  }

  if (input.unit === 'pieces') {
    // 直接输入片数
    if (!Number.isInteger(input.value)) {
      throw new Error('片数必须是整数');
    }
    return input.value;
  } else {
    // 输入件数，需要转换为片数
    if (!Number.isInteger(input.value)) {
      throw new Error('件数必须是整数');
    }
    return input.value * piecesPerUnit;
  }
}

/**
 * 格式化库存数量显示（带产品信息）
 *
 * @param totalPieces 总片数
 * @param product 产品信息
 * @param showDetail 是否显示详细信息
 * @returns 格式化后的显示文本
 */
export function formatInventoryQuantity(
  totalPieces: number,
  product: Pick<Product, 'piecesPerUnit'>,
  showDetail: boolean = false
): string {
  const result = calculatePieceDisplay(totalPieces, product.piecesPerUnit);
  return showDetail ? result.detailText : result.displayText;
}

/**
 * 解析用户输入的数量字符串
 * 支持格式：
 * - "100" -> 100片
 * - "10件" -> 10件
 * - "100片" -> 100片
 * - "10件+5片" -> 10件+5片
 *
 * @param input 用户输入字符串
 * @param piecesPerUnit 每件片数
 * @returns 总片数
 */
export function parseQuantityInput(
  input: string,
  piecesPerUnit: number
): number {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('请输入数量');
  }

  // 匹配 "数字件+数字片" 格式
  const complexMatch = trimmed.match(/^(\d+)件\+(\d+)片$/);
  if (complexMatch) {
    const units = parseInt(complexMatch[1], 10);
    const pieces = parseInt(complexMatch[2], 10);

    if (pieces >= piecesPerUnit) {
      throw new Error(`片数不能大于等于每件片数(${piecesPerUnit})`);
    }

    return units * piecesPerUnit + pieces;
  }

  // 匹配 "数字件" 格式
  const unitsMatch = trimmed.match(/^(\d+)件$/);
  if (unitsMatch) {
    const units = parseInt(unitsMatch[1], 10);
    return units * piecesPerUnit;
  }

  // 匹配 "数字片" 格式
  const piecesMatch = trimmed.match(/^(\d+)片$/);
  if (piecesMatch) {
    return parseInt(piecesMatch[1], 10);
  }

  // 匹配纯数字（默认为片数）
  const numberMatch = trimmed.match(/^\d+$/);
  if (numberMatch) {
    return parseInt(trimmed, 10);
  }

  throw new Error('数量格式不正确，支持格式：100、100片、10件、10件+5片');
}

/**
 * 验证片数输入是否有效
 *
 * @param totalPieces 总片数
 * @param maxPieces 最大允许片数（可选）
 * @returns 验证结果
 */
export function validatePieceQuantity(
  totalPieces: number,
  maxPieces?: number
): { isValid: boolean; error?: string } {
  if (!Number.isInteger(totalPieces)) {
    return { isValid: false, error: '片数必须是整数' };
  }

  if (totalPieces < 0) {
    return { isValid: false, error: '片数不能为负数' };
  }

  if (totalPieces === 0) {
    return { isValid: false, error: '片数必须大于0' };
  }

  if (maxPieces && totalPieces > maxPieces) {
    return { isValid: false, error: `片数不能超过${maxPieces}` };
  }

  return { isValid: true };
}

/**
 * 计算库存预警状态（基于片数）
 *
 * @param totalPieces 总片数
 * @param minPieces 最小片数阈值
 * @param criticalPieces 紧急片数阈值
 * @returns 预警状态
 */
export function calculateStockAlert(
  totalPieces: number,
  minPieces: number = 50,
  criticalPieces: number = 10
): {
  level: 'safe' | 'warning' | 'critical' | 'out';
  message: string;
  color: string;
} {
  if (totalPieces <= 0) {
    return {
      level: 'out',
      message: '缺货',
      color: 'text-red-600',
    };
  }

  if (totalPieces <= criticalPieces) {
    return {
      level: 'critical',
      message: '库存紧急',
      color: 'text-red-500',
    };
  }

  if (totalPieces <= minPieces) {
    return {
      level: 'warning',
      message: '库存不足',
      color: 'text-orange-500',
    };
  }

  return {
    level: 'safe',
    message: '库存充足',
    color: 'text-green-600',
  };
}
