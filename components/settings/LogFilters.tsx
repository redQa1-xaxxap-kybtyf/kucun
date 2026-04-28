/**
 * 日志筛选组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
  SystemLogFilters,
  SystemLogLevel,
  SystemLogType,
} from '@/lib/types/settings';

interface LogFiltersProps {
  /** 当前筛选条件 */
  filters: SystemLogFilters;
  /** 筛选条件变更回调 */
  onFiltersChange: (filters: SystemLogFilters) => void;
}

// 日志类型选项
const LOG_TYPE_OPTIONS: { value: SystemLogType; label: string }[] = [
  { value: 'user_action', label: '用户操作' },
  { value: 'business_operation', label: '业务操作' },
  { value: 'system_event', label: '系统提醒' },
  { value: 'error', label: '异常记录' },
  { value: 'security', label: '安全提醒' },
];

// 日志级别选项
const LOG_LEVEL_OPTIONS: {
  value: SystemLogLevel;
  label: string;
  color: string;
}[] = [
  {
    value: 'info',
    label: '信息',
    color: 'text-[hsl(var(--color-info))]',
  },
  { value: 'warning', label: '警告', color: 'text-yellow-600' },
  { value: 'error', label: '错误', color: 'text-red-600' },
  { value: 'critical', label: '严重', color: 'text-red-800' },
];

/**
 * 日志筛选组件
 */
export const LogFilters = ({ filters, onFiltersChange }: LogFiltersProps) => {
  const controlClassName =
    'h-10 rounded-lg border border-[hsl(var(--color-border-primary))] bg-white px-3 text-sm font-normal text-[hsl(var(--color-text-primary))] transition-colors focus:border-[hsl(var(--color-primary))] focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-2';

  const handleFilterChange = (
    key: keyof SystemLogFilters,
    value: string | null
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'all' ? null : value || null,
    });
  };

  const handleDateRangeChange = (range: {
    startDate?: string;
    endDate?: string;
  }) => {
    onFiltersChange({
      ...filters,
      startDate: range.startDate || null,
      endDate: range.endDate || null,
    });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(filters).some(
    value => value !== null && value !== ''
  );

  return (
    <div className="relative flex flex-col rounded-lg border border-[hsl(var(--color-border-primary))] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--color-primary))]" />
            <p className="text-[11px] font-medium text-[hsl(var(--color-text-secondary))]">
              筛选条件
            </p>
          </div>
          <p className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
            操作记录筛选
          </p>
        </div>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="h-10 rounded-lg px-3 font-medium text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-primary-light))] hover:text-[hsl(var(--color-primary))]"
          >
            <X className="mr-2 h-4 w-4" />
            清空所有条件
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* 关键词搜索 */}
        <div className="space-y-1.5">
          <Label
            htmlFor="search"
            className="text-xs font-medium text-[hsl(var(--color-text-secondary))]"
          >
            关键词
          </Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[hsl(var(--color-text-tertiary))]" />
            <Input
              id="search"
              placeholder="搜索描述、操作、摘要..."
              value={filters.search || ''}
              onChange={e => handleFilterChange('search', e.target.value)}
              className={`${controlClassName} pl-10`}
            />
          </div>
        </div>

        {/* 记录类型 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-[hsl(var(--color-text-secondary))]">
            记录类型
          </Label>
          <select
            value={filters.type || 'all'}
            onChange={e => handleFilterChange('type', e.target.value)}
            className={`${controlClassName} w-full focus:outline-hidden`}
            aria-label="记录类型"
          >
            <option value="all">全部类型</option>
            {LOG_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 日志级别 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-[hsl(var(--color-text-secondary))]">
            风险级别
          </Label>
          <select
            value={filters.level || 'all'}
            onChange={e => handleFilterChange('level', e.target.value)}
            className={`${controlClassName} w-full focus:outline-hidden`}
            aria-label="风险级别"
          >
            <option value="all">全部级别</option>
            {LOG_LEVEL_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 操作动作 */}
        <div className="space-y-1.5">
          <Label
            htmlFor="action"
            className="text-xs font-medium text-[hsl(var(--color-text-secondary))]"
          >
            操作名称
          </Label>
          <Input
            id="action"
            placeholder="如：登录、导出、同步..."
            value={filters.action || ''}
            onChange={e => handleFilterChange('action', e.target.value)}
            className={controlClassName}
          />
        </div>

        {/* 日期范围筛选 */}
        <div className="md:col-span-2">
          <DateRangePicker
            value={{
              startDate: filters.startDate || undefined,
              endDate: filters.endDate || undefined,
            }}
            onChange={handleDateRangeChange}
            label="时间范围"
            triggerClassName={controlClassName}
            showPresets={true}
            showClearButton={true}
          />
        </div>
      </div>
    </div>
  );
};
