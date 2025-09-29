/**
 * 库存调整记录筛选组件
 * 提供时间范围、产品、调整类型等筛选功能
 */

import { Filter, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
  ADJUSTMENT_REASON_LABELS,
  type AdjustmentQueryParams,
} from '@/lib/types/inventory';

interface AdjustmentRecordsFiltersProps {
  filters: AdjustmentQueryParams;
  onFiltersChange: (filters: AdjustmentQueryParams) => void;
  onReset: () => void;
}

export function AdjustmentRecordsFilters({
  filters,
  onFiltersChange,
  onReset,
}: AdjustmentRecordsFiltersProps) {
  // 处理筛选条件变更
  const handleFilterChange = (
    key: keyof AdjustmentQueryParams,
    value: string | undefined
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'all' ? undefined : value || undefined,
      page: 1, // 重置到第一页
    });
  };

  // 处理日期变更
  const handleDateChange = (key: 'startDate' | 'endDate', value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
      page: 1,
    });
  };

  return (
    <div className="space-y-4">
      {/* 筛选标题 */}
      <div className="flex items-center space-x-2">
        <Filter className="h-4 w-4" />
        <span className="font-medium">筛选条件</span>
      </div>

      {/* 筛选表单 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* 搜索框 */}
        <div className="space-y-2">
          <Label htmlFor="search">搜索</Label>
          <Input
            id="search"
            placeholder="搜索调整单号、产品名称..."
            value={filters?.search || ''}
            onChange={e => handleFilterChange('search', e.target.value)}
          />
        </div>

        {/* 调整原因筛选 */}
        <div className="space-y-2">
          <Label htmlFor="reason">调整原因</Label>
          <Select
            value={filters?.reason || 'all'}
            onValueChange={value => handleFilterChange('reason', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="全部原因" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部原因</SelectItem>
              {Object.entries(ADJUSTMENT_REASON_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 开始日期 */}
        <div className="space-y-2">
          <Label htmlFor="startDate">开始日期</Label>
          <Input
            id="startDate"
            type="date"
            value={filters?.startDate || ''}
            onChange={e => handleDateChange('startDate', e.target.value)}
          />
        </div>

        {/* 结束日期 */}
        <div className="space-y-2">
          <Label htmlFor="endDate">结束日期</Label>
          <Input
            id="endDate"
            type="date"
            value={filters?.endDate || ''}
            onChange={e => handleDateChange('endDate', e.target.value)}
          />
        </div>
      </div>

      {/* 重置按钮 */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          重置筛选
        </Button>
      </div>
    </div>
  );
}
