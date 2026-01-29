/**
 * 打印设计器 - 变量标签组件
 *
 * 蓝色胶囊样式显示占位符变量
 */

'use client';

import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

interface VariableTagProps {
  /** 字段路径 */
  field: string;
  /** 显示标签 */
  label: string;
  /** 是否可删除 */
  removable?: boolean;
  /** 删除回调 */
  onRemove?: () => void;
  /** 大小 */
  size?: 'sm' | 'md';
  /** 额外类名 */
  className?: string;
}

export function VariableTag({
  field,
  label,
  removable = false,
  onRemove,
  size = 'md',
  className,
}: VariableTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-blue-100 font-medium text-blue-700',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        className
      )}
      title={field}
    >
      <span className="text-blue-400">{'{'}</span>
      {label}
      <span className="text-blue-400">{'}'}</span>

      {removable && onRemove && (
        <button
          type="button"
          className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200"
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/**
 * 变量标签展示区 (用于画布中占位符元素)
 */
interface VariableDisplayProps {
  label: string;
  format?: string;
  className?: string;
}

export function VariableDisplay({
  label,
  format,
  className,
}: VariableDisplayProps) {
  const formatLabel: Record<string, string> = {
    text: '',
    date_cn: '日期',
    currency: '¥',
    currency_cap: '大写',
    number: '#',
  };

  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-between gap-2 rounded bg-blue-50 px-2',
        className
      )}
    >
      <span className="flex items-center gap-1 text-sm text-blue-700">
        <span className="text-blue-400">{'{'}</span>
        <span className="font-medium">{label}</span>
        <span className="text-blue-400">{'}'}</span>
      </span>

      {format && formatLabel[format] && (
        <span className="rounded bg-blue-200 px-1.5 py-0.5 text-xs text-blue-600">
          {formatLabel[format]}
        </span>
      )}
    </div>
  );
}
