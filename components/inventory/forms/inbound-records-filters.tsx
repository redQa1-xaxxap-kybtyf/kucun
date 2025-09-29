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
import type { InboundQueryParams } from '@/lib/types/inbound';

interface InboundRecordsFiltersProps {
  queryParams: InboundQueryParams;
  onFilter: (key: keyof InboundQueryParams, value: string | undefined) => void;
  onReset: () => void;
}

export function InboundRecordsFilters({
  queryParams,
  onFilter,
  onReset,
}: InboundRecordsFiltersProps) {
  return (
    <div className="rounded border bg-card p-3">
      <div className="mb-3 flex items-center gap-2">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">筛选条件</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {/* 产品ID搜索 */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            产品ID
          </label>
          <Input
            placeholder="搜索产品ID..."
            value={queryParams.productId || ''}
            onChange={e => onFilter('productId', e.target.value || undefined)}
            className="h-8 text-xs"
          />
        </div>

        {/* 入库原因筛选 */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            入库原因
          </label>
          <Select
            value={queryParams.reason || 'all'}
            onValueChange={value =>
              onFilter('reason', value === 'all' ? undefined : value)
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="选择原因" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="purchase">采购入库</SelectItem>
              <SelectItem value="return">退货入库</SelectItem>
              <SelectItem value="transfer">调拨入库</SelectItem>
              <SelectItem value="surplus">盘盈入库</SelectItem>
              <SelectItem value="other">其他</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 日期范围 */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            开始日期
          </label>
          <div className="relative">
            <Input
              type="date"
              value={queryParams.startDate || ''}
              onChange={e => onFilter('startDate', e.target.value || undefined)}
              className="h-8 text-xs"
            />
            <Calendar className="absolute right-2 top-2 h-3 w-3 text-muted-foreground" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            结束日期
          </label>
          <div className="relative">
            <Input
              type="date"
              value={queryParams.endDate || ''}
              onChange={e => onFilter('endDate', e.target.value || undefined)}
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
