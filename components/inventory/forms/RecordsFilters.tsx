/**
 * 统一的库存记录筛选组件
 * 用于入库记录、出库记录、调整记录的筛选功能
 * 遵循唯一真理原则，确保所有记录页面使用相同的筛选逻辑
 */

'use client';

import { Filter, RotateCcw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
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
  if (!config?.enabled) {
    return null;
  }

  return (
    <div>
      <label className="text-muted-foreground mb-1 block text-xs">搜索</label>
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2 left-2 h-3 w-3" />
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
  if (!config?.enabled) {
    return null;
  }

  return (
    <div>
      <label className="text-muted-foreground mb-1 block text-xs">
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
 * 日期范围组件 - 使用统一的 DateRangePicker
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
  if (!config?.enabled) {
    return null;
  }

  return (
    <div>
      <DateRangePicker
        value={{ startDate, endDate }}
        onChange={({ startDate, endDate }) => {
          onStartChange(startDate);
          onEndChange(endDate);
        }}
        label={config.startLabel || '日期范围'}
        showPresets={true}
        showClearButton={true}
      />
    </div>
  );
}

/**
 * 统一的记录筛选组件
 * ✅ 样式优化：使用 Card 组件，与厂家发货页面保持一致
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

  // 检查是否有激活的筛选条件
  const hasActiveFilters =
    !!values.search || !!values.type || !!values.startDate || !!values.endDate;

  return (
    <Card className="card-shadow-light border border-[hsl(var(--color-border-primary))]">
      <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
        <div className="mb-3 flex items-center gap-2 text-[hsl(var(--color-text-secondary))]">
          <Filter className="h-4 w-4 text-[hsl(var(--color-primary))]" />
          <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
            筛选条件
          </span>
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

        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="h-8 gap-1.5 transition-all hover:border-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-light))]"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              重置筛选
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
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
    label: '出库原因',
    options: [
      { value: 'normal_outbound', label: '正常出库' },
      { value: 'manual_outbound', label: '手动出库' },
      { value: 'sales_outbound', label: '销售出库' },
      { value: 'adjust_outbound', label: '调整出库' },
      { value: 'transfer', label: '调拨出库' },
      { value: 'damage', label: '报损出库' },
      { value: 'other', label: '其他出库' },
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

// 盘点记录筛选配置
export const COUNT_FILTER_CONFIG: FilterConfig = {
  search: {
    enabled: true,
    placeholder: '搜索盘点单号、位置、产品名称...',
  },
  typeFilter: {
    enabled: true,
    label: '盘点类型',
    options: [
      { value: 'full', label: '全盘' },
      { value: 'partial', label: '抽盘' },
      { value: 'cycle', label: '循环盘点' },
    ],
  },
  dateRange: {
    enabled: true,
    startLabel: '开始日期',
    endLabel: '结束日期',
  },
};

// 批次管理筛选配置
export const BATCH_FILTER_CONFIG: FilterConfig = {
  search: {
    enabled: true,
    placeholder: '搜索批次号、产品名称、产品编码...',
  },
  typeFilter: {
    enabled: false,
    label: '',
    options: [],
  },
  dateRange: {
    enabled: true,
    startLabel: '开始日期',
    endLabel: '结束日期',
  },
};
