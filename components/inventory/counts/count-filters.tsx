'use client';

import { Search, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  COUNT_STATUS_OPTIONS,
  COUNT_TYPE_OPTIONS,
  type InventoryCountQueryParams,
} from '@/lib/types/inventory-count';

const SELECT_ALL_VALUE = 'all';

interface CountFiltersProps {
  filters: InventoryCountQueryParams;
  onFilterChange: (filters: Partial<InventoryCountQueryParams>) => void;
}

export function CountFilters({ filters, onFilterChange }: CountFiltersProps) {
  const [localFilters, setLocalFilters] = React.useState({
    status: filters.status || SELECT_ALL_VALUE,
    countType: filters.countType || SELECT_ALL_VALUE,
    location: filters.location || '',
    categoryId: filters.categoryId || '',
    startDate: filters.startDate || '',
    endDate: filters.endDate || '',
  });

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
      status:
        localFilters.status === SELECT_ALL_VALUE
          ? undefined
          : (localFilters.status as InventoryCountQueryParams['status']),
      countType:
        localFilters.countType === SELECT_ALL_VALUE
          ? undefined
          : (localFilters.countType as InventoryCountQueryParams['countType']),
      location: localFilters.location || undefined,
      categoryId: localFilters.categoryId || undefined,
      startDate: localFilters.startDate || undefined,
      endDate: localFilters.endDate || undefined,
    });
  };

  // 重置筛选
  const handleResetFilters = () => {
    setLocalFilters({
      status: SELECT_ALL_VALUE,
      countType: SELECT_ALL_VALUE,
      location: '',
      categoryId: '',
      startDate: '',
      endDate: '',
    });
    onFilterChange({
      status: undefined,
      countType: undefined,
      location: undefined,
      categoryId: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {/* 盘点状态 */}
        <div className="space-y-2">
          <Label htmlFor="status">盘点状态</Label>
          <Select
            value={localFilters.status}
            onValueChange={value => handleFilterChange('status', value)}
          >
            <SelectTrigger id="status">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_ALL_VALUE}>全部状态</SelectItem>
              {COUNT_STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 盘点类型 */}
        <div className="space-y-2">
          <Label htmlFor="countType">盘点类型</Label>
          <Select
            value={localFilters.countType}
            onValueChange={value => handleFilterChange('countType', value)}
          >
            <SelectTrigger id="countType">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_ALL_VALUE}>全部类型</SelectItem>
              {COUNT_TYPE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 盘点位置 */}
        <div className="space-y-2">
          <Label htmlFor="location">盘点位置</Label>
          <Input
            id="location"
            type="text"
            placeholder="输入位置"
            value={localFilters.location}
            onChange={e => handleFilterChange('location', e.target.value)}
          />
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
