import * as React from 'react';

import { cn } from '@/lib/utils';

type MoneyValue = number | string | null | undefined;

interface MoneyProps {
  /** 金额数值。字符串会自动转 number；null/undefined/NaN 显示 zeroAs */
  value: MoneyValue;
  /** 币种前缀，默认￥；设为空字符串则不显示 */
  currency?: string;
  /** 小数位数，默认 2 */
  precision?: number;
  /** 额外 className */
  className?: string;
  /** 空值/非数字时的占位，默认 '-' */
  zeroAs?: string;
  /** 是否为正值显示 + 号，默认 false */
  sign?: boolean;
  /** 负值是否染红，默认 true */
  colorizeNegative?: boolean;
  /** 渲染的 HTML 元素，默认 span */
  as?: 'span' | 'div';
}

/**
 * 统一的金额展示组件。
 *
 * - 等宽数字字体 + tabular-nums，确保同列小数点对齐
 * - zh-CN 本地化千分位
 * - 负值默认红字，便于财务快速识别
 *
 * 表格列里通常配合 `text-right` 使用：
 * ```tsx
 * <td className="text-right"><Money value={row.amount} /></td>
 * ```
 */
export function Money({
  value,
  currency = '￥',
  precision = 2,
  className,
  zeroAs = '-',
  sign = false,
  colorizeNegative = true,
  as = 'span',
}: MoneyProps) {
  const Tag = as;

  if (value === null || value === undefined || value === '') {
    return (
      <Tag className={cn('num-money text-muted-foreground', className)}>
        {zeroAs}
      </Tag>
    );
  }

  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return (
      <Tag className={cn('num-money text-muted-foreground', className)}>
        {zeroAs}
      </Tag>
    );
  }

  const prefix = sign && numeric > 0 ? '+' : '';
  const formatted = numeric.toLocaleString('zh-CN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
  const toneClass =
    colorizeNegative && numeric < 0 ? 'text-destructive' : undefined;

  return (
    <Tag className={cn('num-money', toneClass, className)}>
      {prefix}
      {currency}
      {formatted}
    </Tag>
  );
}

interface NumberCellProps {
  value: number | string | null | undefined;
  precision?: number;
  unit?: React.ReactNode;
  className?: string;
  zeroAs?: string;
  as?: 'span' | 'div';
}

/**
 * 统一的数量/整数展示组件。
 *
 * 使用 `num-count`（tabular-nums，非等宽字体），避免中文单位错位。
 */
export function NumberCell({
  value,
  precision = 0,
  unit,
  className,
  zeroAs = '-',
  as = 'span',
}: NumberCellProps) {
  const Tag = as;

  if (value === null || value === undefined || value === '') {
    return (
      <Tag className={cn('num-count text-muted-foreground', className)}>
        {zeroAs}
      </Tag>
    );
  }

  const numeric = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return (
      <Tag className={cn('num-count text-muted-foreground', className)}>
        {zeroAs}
      </Tag>
    );
  }

  const formatted = numeric.toLocaleString('zh-CN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });

  return (
    <Tag className={cn('num-count', className)}>
      {formatted}
      {unit ? <span className="ml-0.5 text-muted-foreground">{unit}</span> : null}
    </Tag>
  );
}
