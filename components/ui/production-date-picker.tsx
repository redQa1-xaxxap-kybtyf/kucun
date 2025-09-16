// 生产日期选择器组件 - 瓷砖行业特色组件
// 专门用于瓷砖生产日期的选择和展示，支持批次管理

import {
  format,
  parse,
  isValid,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Package,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// 生产日期格式定义
export type ProductionDateFormat =
  | 'YYYY-MM-DD'
  | 'YYYY-MM'
  | 'YYYYMMDD'
  | 'YYYY年MM月DD日';

// 生产批次信息接口
export interface ProductionBatch {
  date: string;
  batchNumber?: string;
  quantity?: number;
  quality?: 'AAA' | 'AA' | 'A' | 'B';
  notes?: string;
}

export interface ProductionDatePickerProps {
  value?: string;
  onValueChange?: (value: string) => void;
  format?: ProductionDateFormat;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showBatchInfo?: boolean;
  batches?: ProductionBatch[];
  onBatchSelect?: (batch: ProductionBatch) => void;
  minDate?: Date;
  maxDate?: Date;
  highlightToday?: boolean;
}

const ProductionDatePicker = React.forwardRef<
  HTMLDivElement,
  ProductionDatePickerProps
>(
  (
    {
      value,
      onValueChange,
      format = 'YYYY-MM-DD',
      placeholder = '选择生产日期',
      disabled = false,
      className,
      showBatchInfo = false,
      batches = [],
      onBatchSelect,
      minDate,
      maxDate,
      highlightToday = true,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [currentMonth, setCurrentMonth] = React.useState(new Date());
    const [inputValue, setInputValue] = React.useState('');

    // 解析日期值
    const parseDate = (dateString: string): Date | null => {
      if (!dateString) return null;

      try {
        switch (format) {
          case 'YYYY-MM-DD':
            return parse(dateString, 'yyyy-MM-dd', new Date());
          case 'YYYY-MM':
            return parse(dateString, 'yyyy-MM', new Date());
          case 'YYYYMMDD':
            return parse(dateString, 'yyyyMMdd', new Date());
          case 'YYYY年MM月DD日':
            return parse(dateString, 'yyyy年MM月dd日', new Date());
          default:
            return new Date(dateString);
        }
      } catch {
        return null;
      }
    };

    // 格式化日期值
    const formatDate = (date: Date): string => {
      switch (format) {
        case 'YYYY-MM-DD':
          return format(date, 'yyyy-MM-dd');
        case 'YYYY-MM':
          return format(date, 'yyyy-MM');
        case 'YYYYMMDD':
          return format(date, 'yyyyMMdd');
        case 'YYYY年MM月DD日':
          return format(date, 'yyyy年MM月dd日');
        default:
          return format(date, 'yyyy-MM-dd');
      }
    };

    // 当前选中的日期
    const selectedDate = value ? parseDate(value) : null;

    // 更新输入框值
    React.useEffect(() => {
      if (selectedDate && isValid(selectedDate)) {
        setInputValue(formatDate(selectedDate));
      } else {
        setInputValue('');
      }
    }, [value, format]);

    // 处理日期选择
    const handleDateSelect = (date: Date) => {
      const formattedDate = formatDate(date);
      onValueChange?.(formattedDate);
      setIsOpen(false);

      // 如果有批次信息，查找对应批次
      if (showBatchInfo && batches.length > 0) {
        const batch = batches.find(b => b.date === formattedDate);
        if (batch && onBatchSelect) {
          onBatchSelect(batch);
        }
      }
    };

    // 处理输入框变化
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputVal = e.target.value;
      setInputValue(inputVal);

      const parsedDate = parseDate(inputVal);
      if (parsedDate && isValid(parsedDate)) {
        onValueChange?.(inputVal);
      }
    };

    // 获取月份的所有日期
    const monthDays = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });

    // 检查日期是否有批次信息
    const getBatchForDate = (date: Date): ProductionBatch | undefined => {
      const dateStr = formatDate(date);
      return batches.find(batch => batch.date === dateStr);
    };

    // 检查日期是否可选
    const isDateSelectable = (date: Date): boolean => {
      if (minDate && date < minDate) return false;
      if (maxDate && date > maxDate) return false;
      return true;
    };

    return (
      <div className={cn('relative', className)} ref={ref} {...props}>
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !value && 'text-muted-foreground',
                disabled && 'cursor-not-allowed opacity-50'
              )}
              disabled={disabled}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              {inputValue || placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3">
              {/* 月份导航 */}
              <div className="mb-3 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentMonth(
                      new Date(
                        currentMonth.getFullYear(),
                        currentMonth.getMonth() - 1
                      )
                    )
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="font-medium">
                  {format(currentMonth, 'yyyy年MM月', { locale: zhCN })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCurrentMonth(
                      new Date(
                        currentMonth.getFullYear(),
                        currentMonth.getMonth() + 1
                      )
                    )
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* 星期标题 */}
              <div className="mb-2 grid grid-cols-7 gap-1">
                {['日', '一', '二', '三', '四', '五', '六'].map(day => (
                  <div
                    key={day}
                    className="p-2 text-center text-xs font-medium text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 日期网格 */}
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map(date => {
                  const batch = getBatchForDate(date);
                  const isSelected =
                    selectedDate && isSameDay(date, selectedDate);
                  const isCurrentMonth = isSameMonth(date, currentMonth);
                  const isTodayDate = isToday(date);
                  const isSelectable = isDateSelectable(date);

                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      className={cn(
                        'relative rounded-md p-2 text-sm transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                        !isCurrentMonth && 'text-muted-foreground opacity-50',
                        isSelected &&
                          'bg-primary text-primary-foreground hover:bg-primary/90',
                        isTodayDate &&
                          highlightToday &&
                          !isSelected &&
                          'bg-accent font-medium',
                        !isSelectable && 'cursor-not-allowed opacity-30',
                        batch && 'border border-blue-200 bg-blue-50'
                      )}
                      onClick={() => isSelectable && handleDateSelect(date)}
                      disabled={!isSelectable}
                    >
                      <span>{format(date, 'd')}</span>
                      {batch && (
                        <div className="absolute -right-1 -top-1">
                          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 批次信息展示 */}
              {showBatchInfo && selectedDate && (
                <div className="mt-3 border-t pt-3">
                  {(() => {
                    const batch = getBatchForDate(selectedDate);
                    if (batch) {
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <Package className="h-4 w-4" />
                            批次信息
                          </div>
                          <div className="space-y-1 text-xs">
                            {batch.batchNumber && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  批次号:
                                </span>
                                <span className="font-mono">
                                  {batch.batchNumber}
                                </span>
                              </div>
                            )}
                            {batch.quantity && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  数量:
                                </span>
                                <span>{batch.quantity} 片</span>
                              </div>
                            )}
                            {batch.quality && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  等级:
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {batch.quality}
                                </Badge>
                              </div>
                            )}
                            {batch.notes && (
                              <div className="mt-2">
                                <div className="mb-1 text-muted-foreground">
                                  备注:
                                </div>
                                <div className="rounded bg-muted p-2 text-xs">
                                  {batch.notes}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="py-2 text-center text-xs text-muted-foreground">
                          该日期暂无批次信息
                        </div>
                      );
                    }
                  })()}
                </div>
              )}

              {/* 快速选择 */}
              <div className="mt-3 border-t pt-3">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDateSelect(new Date())}
                    className="text-xs"
                  >
                    今天
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      handleDateSelect(yesterday);
                    }}
                    className="text-xs"
                  >
                    昨天
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* 直接输入框 */}
        <div className="mt-2">
          <Label htmlFor="date-input" className="text-xs text-muted-foreground">
            或直接输入日期
          </Label>
          <Input
            id="date-input"
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={`格式: ${
              format === 'YYYY-MM-DD'
                ? '2024-01-01'
                : format === 'YYYY-MM'
                  ? '2024-01'
                  : format === 'YYYYMMDD'
                    ? '20240101'
                    : '2024年01月01日'
            }`}
            className="mt-1 text-xs"
            disabled={disabled}
          />
        </div>
      </div>
    );
  }
);

ProductionDatePicker.displayName = 'ProductionDatePicker';

// 生产日期范围选择器
export interface ProductionDateRangePickerProps {
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
  format?: ProductionDateFormat;
  className?: string;
  disabled?: boolean;
}

const ProductionDateRangePicker = React.forwardRef<
  HTMLDivElement,
  ProductionDateRangePickerProps
>(
  (
    {
      startDate,
      endDate,
      onStartDateChange,
      onEndDateChange,
      format = 'YYYY-MM-DD',
      className,
      disabled = false,
      ...props
    },
    ref
  ) => (
      <div
        className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', className)}
        ref={ref}
        {...props}
      >
        <div>
          <Label className="mb-2 block text-sm font-medium">开始日期</Label>
          <ProductionDatePicker
            value={startDate}
            onValueChange={onStartDateChange}
            format={format}
            placeholder="选择开始日期"
            disabled={disabled}
            maxDate={endDate ? new Date(endDate) : undefined}
          />
        </div>
        <div>
          <Label className="mb-2 block text-sm font-medium">结束日期</Label>
          <ProductionDatePicker
            value={endDate}
            onValueChange={onEndDateChange}
            format={format}
            placeholder="选择结束日期"
            disabled={disabled}
            minDate={startDate ? new Date(startDate) : undefined}
          />
        </div>
      </div>
    )
);

ProductionDateRangePicker.displayName = 'ProductionDateRangePicker';

export {
  ProductionDatePicker,
  ProductionDateRangePicker,
  type ProductionBatch,
  type ProductionDateFormat,
};
