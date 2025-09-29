'use client';

import { Calendar, Filter, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OutboundType } from '@/lib/types/inventory';

interface OutboundFilters {
  startDate: string;
  endDate: string;
  type: OutboundType | '';
}

interface OutboundRecordsFiltersProps {
  filters: OutboundFilters;
  onUpdateFilter: (key: keyof OutboundFilters, value: string) => void;
  onReset: () => void;
}

export function OutboundRecordsFilters({
  filters,
  onUpdateFilter,
  onReset,
}: OutboundRecordsFiltersProps) {
  return (
    <div className="rounded border bg-card p-3">
      <div className="mb-3 flex items-center gap-2">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">筛选条件</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* 出库类型筛选 */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            出库类型
          </label>
          <Select
            value={filters.type}
            onValueChange={value => onUpdateFilter('type', value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="选择类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="sale">销售出库</SelectItem>
              <SelectItem value="transfer">调拨出库</SelectItem>
              <SelectItem value="return">退货出库</SelectItem>
              <SelectItem value="loss">损耗出库</SelectItem>
              <SelectItem value="other">其他</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 开始日期 */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            开始日期
          </label>
          <div className="relative">
            <Input
              type="date"
              value={filters.startDate}
              onChange={e => onUpdateFilter('startDate', e.target.value)}
              className="h-8 text-xs"
            />
            <Calendar className="absolute right-2 top-2 h-3 w-3 text-muted-foreground" />
          </div>
        </div>

        {/* 结束日期 */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            结束日期
          </label>
          <div className="relative">
            <Input
              type="date"
              value={filters.endDate}
              onChange={e => onUpdateFilter('endDate', e.target.value)}
              className="h-8 text-xs"
            />
            <Calendar className="absolute right-2 top-2 h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* 重置按钮 */}
      <div className="mt-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="h-7 text-xs"
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          重置筛选
        </Button>
      </div>
    </div>
  );
}
