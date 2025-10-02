'use client';

import React from 'react';

import { Input } from '@/components/ui/input';

interface NumberInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'onChange' | 'value'
  > {
  value?: number | null | undefined;
  onChange: (value: number | undefined) => void;
  allowEmpty?: boolean;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}

/**
 * 优化的数字输入组件
 * 解决默认值0无法删除的用户体验问题
 */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onChange,
      allowEmpty = true,
      defaultValue,
      min,
      max,
      step,
      precision,
      onBlur,
      onFocus,
      ...props
    },
    ref
  ) => {
    const [displayValue, setDisplayValue] = React.useState<string>('');
    const [isFocused, setIsFocused] = React.useState(false);

    // 格式化数字显示
    const formatNumber = React.useCallback(
      (num: number | null | undefined): string => {
        if (num === null || num === undefined) {return '';}
        if (precision !== undefined) {
          return num.toFixed(precision);
        }
        return num.toString();
      },
      [precision]
    );

    // 初始化和同步外部值变化
    React.useEffect(() => {
      if (!isFocused) {
        setDisplayValue(formatNumber(value));
      }
    }, [value, isFocused, formatNumber]);

    // 处理输入变化
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      setDisplayValue(inputValue);

      // 空值处理
      if (inputValue === '' || inputValue === '-') {
        if (allowEmpty) {
          onChange(undefined);
        }
        return;
      }

      // 数字验证和转换
      const numValue = Number(inputValue);
      if (!isNaN(numValue)) {
        // 范围验证
        let validValue = numValue;
        if (min !== undefined && validValue < min) {
          validValue = min;
        }
        if (max !== undefined && validValue > max) {
          validValue = max;
        }

        onChange(validValue);
      }
    };

    // 处理焦点获得
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);

      // 如果值为0且允许清空，选中全部文本便于用户直接输入
      if (value === 0 && allowEmpty) {
        setTimeout(() => {
          e.target.select();
        }, 0);
      }

      onFocus?.(e);
    };

    // 处理焦点失去
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);

      // 如果为空且不允许空值，恢复默认值
      if (displayValue === '' && !allowEmpty && defaultValue !== undefined) {
        onChange(defaultValue);
        setDisplayValue(formatNumber(defaultValue));
      } else if (displayValue === '' && !allowEmpty) {
        // 如果没有默认值，使用最小值或0
        const fallbackValue = min !== undefined ? min : 0;
        onChange(fallbackValue);
        setDisplayValue(formatNumber(fallbackValue));
      } else {
        // 格式化显示值
        setDisplayValue(formatNumber(value));
      }

      onBlur?.(e);
    };

    // 处理键盘事件
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // 允许删除键清空默认值0
      if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        value === 0 &&
        allowEmpty
      ) {
        e.preventDefault();
        setDisplayValue('');
        onChange(undefined);
      }
    };

    return (
      <Input
        ref={ref}
        type="number"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={step}
        {...props}
      />
    );
  }
);

NumberInput.displayName = 'NumberInput';
