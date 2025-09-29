/**
 * 统一的库存记录筛选组件
 * 用于入库记录、出库记录、调整记录的筛选功能
 * 遵循唯一真理原则，确保所有记录页面使用相同的筛选逻辑
 */

'use client';

import { Calendar, Filter, RotateCcw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * 筛选配置接口
 */
export interface FilterConfig {
  // 搜索框配置
  search?: {
    enabled: boolean;
    placeholder?: string;
  };
  // 类型/原因筛选配置
  typeFilter?: {
    enabled: boolean;
    label: string;
    options: Array<{ value: string; label: string }>;
  };
  // 日期范围筛选配置
  dateRange?: {
    enabled: boolean;
    startLabel?: string;
    endLabel?: string;
  };
}

/**
 * 筛选值接口
 */
export interface FilterValues {
  search?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * 组件属性接口
 */
interface RecordsFiltersProps {
  config: FilterConfig;
  values: FilterValues;
  onFilterChange: (key: keyof FilterValues, value: string | undefined) => void;
  onReset: () => void;
}

/**
 * 搜索框组件
 */
function SearchField({
  config,
  value,
  onChange,
}: {
  config: FilterConfig['search'];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  if (!config?.enabled) return null;

  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">搜索</label>
      <div className="relative">
        <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
        <Input
          placeholder={config.placeholder || '搜索...'}
          value={value || ''}
          onChange={e => onChange(e.target.value || undefined)}
          className="h-8 pl-7 text-xs"
        />
      </div>
    </div>
  );
}

/**
 * 类型筛选组件
 */
function TypeFilterField({
  config,
  value,
  onChange,
}: {
  config: FilterConfig['typeFilter'];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  if (!config?.enabled) return null;

  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">
        {config.label}
      </label>
      <Select
        value={value || 'all'}
        onValueChange={v => onChange(v === 'all' ? undefined : v)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={`选择${config.label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          {config.options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * 日期范围组件
 */
function DateRangeFields({
  config,
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: {
  config: FilterConfig['dateRange'];
  startDate: string | undefined;
  endDate: string | undefined;
  onStartChange: (value: string | undefined) => void;
  onEndChange: (value: string | undefined) => void;
}) {
  if (!config?.enabled) return null;

  return (
    <>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          {config.startLabel || '开始日期'}
        </label>
        <div className="relative">
          <Input
            type="date"
            value={startDate || ''}
            onChange={e => onStartChange(e.target.value || undefined)}
            className="h-8 text-xs"
          />
          <Calendar className="pointer-events-none absolute right-2 top-2 h-3 w-3 text-muted-foreground" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          {config.endLabel || '结束日期'}
        </label>
        <div className="relative">
          <Input
            type="date"
            value={endDate || ''}
            onChange={e => onEndChange(e.target.value || undefined)}
            className="h-8 text-xs"
          />
          <Calendar className="pointer-events-none absolute right-2 top-2 h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    </>
  );
}

/**
 * 统一的记录筛选组件
 */
export function RecordsFilters({
  config,
  values,
  onFilterChange,
  onReset,
}: RecordsFiltersProps) {
  const gridCols = [
    config.search?.enabled,
    config.typeFilter?.enabled,
    config.dateRange?.enabled,
  ].filter(Boolean).length;

  const gridClass =
    gridCols === 4
      ? 'md:grid-cols-4'
      : gridCols === 3
        ? 'md:grid-cols-3'
        : 'md:grid-cols-2';

  return (
    <div className="rounded border bg-card p-3">
      <div className="mb-3 flex items-center gap-2">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">筛选条件</span>
      </div>

      <div className={`grid grid-cols-1 gap-3 ${gridClass}`}>
        <SearchField
          config={config.search}
          value={values.search}
          onChange={v => onFilterChange('search', v)}
        />
        <TypeFilterField
          config={config.typeFilter}
          value={values.type}
          onChange={v => onFilterChange('type', v)}
        />
        <DateRangeFields
          config={config.dateRange}
          startDate={values.startDate}
          endDate={values.endDate}
          onStartChange={v => onFilterChange('startDate', v)}
          onEndChange={v => onFilterChange('endDate', v)}
        />
      </div>

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

/**
 * 预定义的筛选配置
 */

// 入库记录筛选配置
export const INBOUND_FILTER_CONFIG: FilterConfig = {
  search: {
    enabled: true,
    placeholder: '搜索产品名称、编码、批次号...',
  },
  typeFilter: {
    enabled: true,
    label: '入库原因',
    options: [
      { value: 'purchase', label: '采购入库' },
      { value: 'return', label: '退货入库' },
      { value: 'transfer', label: '调拨入库' },
      { value: 'surplus', label: '盘盈入库' },
      { value: 'other', label: '其他' },
    ],
  },
  dateRange: {
    enabled: true,
    startLabel: '开始日期',
    endLabel: '结束日期',
  },
};

// 出库记录筛选配置
export const OUTBOUND_FILTER_CONFIG: FilterConfig = {
  search: {
    enabled: true,
    placeholder: '搜索产品名称、编码、批次号...',
  },
  typeFilter: {
    enabled: true,
    label: '出库类型',
    options: [
      { value: 'sale', label: '销售出库' },
      { value: 'transfer', label: '调拨出库' },
      { value: 'return', label: '退货出库' },
      { value: 'loss', label: '损耗出库' },
      { value: 'other', label: '其他' },
    ],
  },
  dateRange: {
    enabled: true,
    startLabel: '开始日期',
    endLabel: '结束日期',
  },
};

// 调整记录筛选配置
export const ADJUSTMENT_FILTER_CONFIG: FilterConfig = {
  search: {
    enabled: true,
    placeholder: '搜索调整单号、产品名称、编码...',
  },
  typeFilter: {
    enabled: true,
    label: '调整原因',
    options: [
      { value: 'surplus', label: '盘盈' },
      { value: 'loss', label: '盘亏' },
      { value: 'damage', label: '损坏' },
      { value: 'expired', label: '过期' },
      { value: 'correction', label: '数据修正' },
      { value: 'other', label: '其他' },
    ],
  },
  dateRange: {
    enabled: true,
    startLabel: '开始日期',
    endLabel: '结束日期',
  },
};
