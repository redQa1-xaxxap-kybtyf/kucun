/**
 * 统一的日期范围选择器组件
 *
 * 功能特性:
 * - 支持日期范围选择（开始日期 + 结束日期）
 * - 提供快捷日期预设（今天、本周、本月等）
 * - 可视化日历选择器
 * - 清除日期筛选功能
 * - 移动端友好的响应式设计
 *
 * 技术栈:
 * - react-day-picker v9.11.0
 * - date-fns v4.1.0
 * - Radix UI Popover
 *
 * 遵循原则: KISS, DRY, SOLID
 */

'use client';

import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import * as React from 'react';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/utils/console-logger';

const Calendar = dynamic(
  () => import('@/components/ui/calendar').then(mod => mod.Calendar),
  {
    ssr: false,
    loading: () => (
      <div className="h-[296px] w-[280px] animate-pulse rounded-lg bg-slate-50" />
    ),
  }
);

/**
 * 日期范围值接口
 */
export interface DateRangeValue {
  startDate?: string; // ISO 8601 格式: "2025-01-01"
  endDate?: string;
}

/**
 * 快捷预设配置接口
 */
export interface DateRangePreset {
  label: string;
  getValue: () => DateRangeValue;
}

/**
 * 组件属性接口
 */
export interface DateRangePickerProps {
  /** 当前选中的日期范围 */
  value?: DateRangeValue;

  /** 日期变更回调 */
  onChange: (range: DateRangeValue) => void;

  /** 标签文本 */
  label?: string;

  /** 占位符文本 */
  placeholder?: string;

  /** 是否显示快捷预设 */
  showPresets?: boolean;

  /** 自定义预设选项 */
  presets?: DateRangePreset[];

  /** 日期范围限制 - 最小日期 */
  minDate?: Date;

  /** 日期范围限制 - 最大日期 */
  maxDate?: Date;

  /** 禁用状态 */
  disabled?: boolean;

  /** 样式定制 */
  className?: string;

  /** 是否显示清除按钮 */
  showClearButton?: boolean;
}

/**
 * 默认快捷预设配置
 */
const DEFAULT_PRESETS: DateRangePreset[] = [
  {
    label: '今天',
    getValue: () => {
      const today = new Date();
      return {
        startDate: format(today, 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      };
    },
  },
  {
    label: '昨天',
    getValue: () => {
      const yesterday = subDays(new Date(), 1);
      return {
        startDate: format(yesterday, 'yyyy-MM-dd'),
        endDate: format(yesterday, 'yyyy-MM-dd'),
      };
    },
  },
  {
    label: '最近7天',
    getValue: () => ({
      startDate: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '最近30天',
    getValue: () => ({
      startDate: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '本周',
    getValue: () => ({
      startDate: format(
        startOfWeek(new Date(), { weekStartsOn: 1 }),
        'yyyy-MM-dd'
      ),
      endDate: format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '本月',
    getValue: () => ({
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    }),
  },
  {
    label: '上月',
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
      };
    },
  },
];

/**
 * 日期范围选择器组件
 */
export const DateRangePicker = React.memo(
  ({
    value,
    onChange,
    label = '日期范围',
    placeholder = '选择日期范围',
    showPresets = true,
    presets = DEFAULT_PRESETS,
    minDate,
    maxDate,
    disabled = false,
    className,
    showClearButton = true,
  }: DateRangePickerProps) => {
    const [isOpen, setIsOpen] = React.useState(false);

    // 将字符串日期转换为 Date 对象
    const dateRange = React.useMemo<DateRange | undefined>(() => {
      if (!value?.startDate && !value?.endDate) {
        return undefined;
      }

      return {
        from: value.startDate ? new Date(value.startDate) : undefined,
        to: value.endDate ? new Date(value.endDate) : undefined,
      };
    }, [value?.startDate, value?.endDate]);

    // 格式化日期范围显示文本
    const formattedRange = React.useMemo(() => {
      if (!value?.startDate || !value?.endDate) {
        return '';
      }

      try {
        const start = new Date(value.startDate);
        const end = new Date(value.endDate);

        // 格式化为中文日期
        const startStr = format(start, 'yyyy年M月d日', { locale: zhCN });
        const endStr = format(end, 'yyyy年M月d日', { locale: zhCN });

        return `${startStr} - ${endStr}`;
      } catch (error) {
        logger.error('ui:date-range-picker', '日期格式化失败', error, {
          startDate: value?.startDate,
          endDate: value?.endDate,
        });
        return '';
      }
    }, [value?.startDate, value?.endDate]);

    // 处理日历日期选择
    const [date, setDate] = React.useState<DateRange | undefined>(dateRange);

    // 当 value prop 改变时，同步内部状态
    React.useEffect(() => {
      setDate(dateRange);
    }, [dateRange]);

    // 处理日历日期选择
    const handleCalendarSelect = setDate;

    const handleConfirm = React.useCallback(() => {
      if (date?.from && date?.to) {
        onChange({
          startDate: format(date.from, 'yyyy-MM-dd'),
          endDate: format(date.to, 'yyyy-MM-dd'),
        });
        setIsOpen(false);
      }
    }, [date, onChange]);

    // 处理快捷预设点击
    const handlePresetClick = React.useCallback(
      (preset: DateRangePreset) => {
        const newValue = preset.getValue();
        onChange(newValue);
        setIsOpen(false);
      },
      [onChange]
    );

    // 清除日期范围
    const handleClear = React.useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange({});
      },
      [onChange]
    );

    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label && (
          <label className="text-muted-foreground text-xs font-medium">
            {label}
          </label>
        )}

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                'h-8 justify-start text-left text-xs font-normal',
                !formattedRange && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5" />
              {formattedRange || placeholder}
              {showClearButton && formattedRange && (
                <X
                  className="ml-auto h-3.5 w-3.5 opacity-50 hover:opacity-100"
                  onClick={handleClear}
                />
              )}
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex flex-col md:flex-row">
              {/* 快捷预设区域 */}
              {showPresets && presets.length > 0 && (
                <div className="border-b p-3 md:border-r md:border-b-0">
                  <div className="mb-2 text-xs font-medium text-[hsl(var(--color-text-secondary))]">
                    快捷选择
                  </div>
                  <div className="flex flex-col gap-1">
                    {presets.map((preset, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        className="h-7 justify-start text-xs font-normal"
                        onClick={() => handlePresetClick(preset)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* 日历选择区域 */}
              <div className="p-3">
                <Calendar
                  mode="range"
                  selected={date}
                  onSelect={handleCalendarSelect}
                  numberOfMonths={1}
                  disabled={date => {
                    if (minDate && date < minDate) return true;
                    if (maxDate && date > maxDate) return true;
                    return false;
                  }}
                  locale={zhCN}
                />

                {/* 底部操作按钮 */}
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    {dateRange?.from && dateRange?.to
                      ? `已选择 ${Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1} 天`
                      : '请选择日期范围'}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        onChange({});
                        setIsOpen(false);
                      }}
                    >
                      清除
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleConfirm}
                      disabled={!date?.from || !date?.to}
                    >
                      确定
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }
);

/**
 * 简化版日期范围选择器（用于内联显示）
 */
export const DateRangePickerInline = React.memo(
  ({
    value,
    onChange,
    showPresets = false,
    className,
    ...props
  }: DateRangePickerProps) => (
    <DateRangePicker
      value={value}
      onChange={onChange}
      showPresets={showPresets}
      className={className}
      {...props}
    />
  )
);
