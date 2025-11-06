'use client';

import { Search, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  EXPENSE_RELATED_TYPE_OPTIONS,
  EXPENSE_TYPE_OPTIONS,
  type ExpenseQueryParams,
} from '@/lib/types/expense';

const SELECT_ALL_VALUE = 'all';

interface ExpenseFiltersProps {
  filters: ExpenseQueryParams;
  onFilterChange: (filters: Partial<ExpenseQueryParams>) => void;
}

export function ExpenseFilters({
  filters,
  onFilterChange,
}: ExpenseFiltersProps) {
  const [localFilters, setLocalFilters] = React.useState({
    expenseType: filters.expenseType || SELECT_ALL_VALUE,
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
    relatedType: filters.relatedType || SELECT_ALL_VALUE,
  });

  React.useEffect(() => {
    setLocalFilters({
      expenseType: filters.expenseType ?? SELECT_ALL_VALUE,
      startDate: filters.startDate ?? '',
      endDate: filters.endDate ?? '',
      relatedType: filters.relatedType ?? SELECT_ALL_VALUE,
    });
  }, [
    filters.endDate,
    filters.expenseType,
    filters.relatedType,
    filters.startDate,
  ]);

  // 处理筛选条件变化
  const handleFilterChange = (
    key: keyof typeof localFilters,
    value: string
  ) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  // 应用筛选
  const handleApplyFilters = () => {
    onFilterChange({
      expenseType:
        localFilters.expenseType === SELECT_ALL_VALUE
          ? undefined
          : (localFilters.expenseType as ExpenseQueryParams['expenseType']),
      startDate: localFilters.startDate || undefined,
      endDate: localFilters.endDate || undefined,
      relatedType:
        localFilters.relatedType === SELECT_ALL_VALUE
          ? undefined
          : (localFilters.relatedType as ExpenseQueryParams['relatedType']),
    });
  };

  // 重置筛选
  const handleResetFilters = () => {
    setLocalFilters({
      expenseType: SELECT_ALL_VALUE,
      startDate: '',
      endDate: '',
      relatedType: SELECT_ALL_VALUE,
    });
    onFilterChange({
      expenseType: undefined,
      startDate: undefined,
      endDate: undefined,
      relatedType: undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {/* 费用类型 */}
        <div className="space-y-2">
          <Label htmlFor="expenseType">费用类型</Label>
          <Select
            value={localFilters.expenseType}
            onValueChange={value => handleFilterChange('expenseType', value)}
          >
            <SelectTrigger id="expenseType">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_ALL_VALUE}>全部类型</SelectItem>
              {EXPENSE_TYPE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DateRangePicker
          value={{
            startDate: localFilters.startDate || undefined,
            endDate: localFilters.endDate || undefined,
          }}
          onChange={({ startDate, endDate }) => {
            handleFilterChange('startDate', startDate ?? '');
            handleFilterChange('endDate', endDate ?? '');
          }}
          label="日期范围"
          placeholder="选择日期范围"
          showPresets
          showClearButton
          className="w-full md:w-[240px]"
        />

        {/* 关联业务类型 */}
        <div className="space-y-2">
          <Label htmlFor="relatedType">关联业务</Label>
          <Select
            value={localFilters.relatedType}
            onValueChange={value => handleFilterChange('relatedType', value)}
          >
            <SelectTrigger id="relatedType">
              <SelectValue placeholder="全部业务" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_ALL_VALUE}>全部业务</SelectItem>
              {EXPENSE_RELATED_TYPE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <Button onClick={handleApplyFilters}>
          <Search className="mr-2 h-4 w-4" />
          查询
        </Button>
        <Button variant="outline" onClick={handleResetFilters}>
          <X className="mr-2 h-4 w-4" />
          重置
        </Button>
      </div>
    </div>
  );
}
