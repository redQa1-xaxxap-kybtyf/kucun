/**
 * 通用数字输入处理Hook
 * 遵循全栈开发执行手册：提取重复逻辑，提高代码复用性
 * 修复：统一数字输入验证逻辑，避免重复代码
 */

import { useCallback } from 'react';

interface UseNumberInputOptions {
  min?: number;
  max?: number;
  step?: number;
  allowDecimals?: boolean;
  required?: boolean;
}

/**
 * 数字输入处理Hook
 * @param onChange 值变化回调函数
 * @param options 配置选项
 * @returns 处理输入变化的函数
 */
export function useNumberInput(
  onChange: (value: number | undefined) => void,
  options: UseNumberInputOptions = {}
) {
  const { 
    min, 
    max, 
    allowDecimals = true, 
    required = false 
  } = options;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.trim();
      
      // 空值处理
      if (value === '') {
        onChange(required ? undefined : undefined);
        return;
      }

      const numValue = Number(value);
      
      // 验证数字格式
      if (isNaN(numValue)) {
        return; // 不更新无效值，保持当前状态
      }

      // 验证小数位
      if (!allowDecimals && !Number.isInteger(numValue)) {
        return;
      }

      // 验证范围
      if (min !== undefined && numValue < min) {
        return;
      }
      if (max !== undefined && numValue > max) {
        return;
      }

      onChange(numValue);
    },
    [onChange, min, max, allowDecimals, required]
  );

  return handleChange;
}

/**
 * 格式化数字显示值
 * @param value 数字值
 * @param allowDecimals 是否允许小数
 * @returns 格式化后的字符串
 */
export function formatNumberValue(
  value: number | undefined, 
  allowDecimals: boolean = true
): string {
  if (value === undefined || value === null) {
    return '';
  }
  
  if (!allowDecimals) {
    return Math.floor(value).toString();
  }
  
  return value.toString();
}

/**
 * 预设的数字输入配置
 */
export const NumberInputPresets = {
  // 整数，最小值1
  positiveInteger: {
    min: 1,
    allowDecimals: false,
  },
  
  // 非负整数
  nonNegativeInteger: {
    min: 0,
    allowDecimals: false,
  },
  
  // 重量（kg）
  weight: {
    min: 0,
    max: 100000,
    step: 0.01,
    allowDecimals: true,
  },
  
  // 厚度（mm）
  thickness: {
    min: 0,
    max: 100,
    step: 0.1,
    allowDecimals: true,
  },
  
  // 每单位片数
  piecesPerUnit: {
    min: 1,
    max: 10000,
    allowDecimals: false,
  },
  
  // 价格
  price: {
    min: 0,
    max: 999999.99,
    step: 0.01,
    allowDecimals: true,
  },
  
  // 数量
  quantity: {
    min: 0,
    max: 999999,
    allowDecimals: false,
  },
} as const;
