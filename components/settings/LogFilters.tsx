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
  { value: 'system_event', label: '系统事件' },
  { value: 'error', label: '错误日志' },
  { value: 'security', label: '安全日志' },
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
    <div className="group relative flex flex-col rounded-[32px] border border-white bg-white/60 p-8 shadow-sm backdrop-blur-md transition-all duration-500 hover:shadow-xl hover:shadow-slate-200/50">
      <div className="mb-8 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-slate-900" />
            <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
              Filter / 条件筛选
            </p>
          </div>
          <p className="text-xl font-black tracking-tight text-slate-900">
            精细化审计检索
          </p>
        </div>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="rounded-xl border-slate-200 font-bold text-slate-500 transition-all hover:bg-slate-900 hover:text-white active:scale-95"
          >
            <X className="mr-2 h-4 w-4" />
            清空所有条件
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* 关键词搜索 */}
        <div className="space-y-2.5">
          <Label
            htmlFor="search"
            className="ml-1 text-[11px] font-black tracking-widest text-slate-400 uppercase"
          >
            关键词检索
          </Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="search"
              placeholder="搜索描述、操作、摘要..."
              value={filters.search || ''}
              onChange={e => handleFilterChange('search', e.target.value)}
              className="h-11 rounded-2xl border-slate-100 bg-slate-50/50 pl-11 font-bold text-slate-900 transition-all focus:bg-white focus:ring-slate-900/5"
            />
          </div>
        </div>

        {/* 日志类型 */}
        <div className="space-y-2.5">
          <Label className="ml-1 text-[11px] font-black tracking-widest text-slate-400 uppercase">
            日志类型
          </Label>
          <select
            value={filters.type || 'all'}
            onChange={e => handleFilterChange('type', e.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-3 font-bold text-slate-900 transition-all focus:bg-white focus:ring-2 focus:ring-slate-900/5 focus:outline-hidden"
            aria-label="日志类型"
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
        <div className="space-y-2.5">
          <Label className="ml-1 text-[11px] font-black tracking-widest text-slate-400 uppercase">
            风险级别
          </Label>
          <select
            value={filters.level || 'all'}
            onChange={e => handleFilterChange('level', e.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-3 font-bold text-slate-900 transition-all focus:bg-white focus:ring-2 focus:ring-slate-900/5 focus:outline-hidden"
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
        <div className="space-y-2.5">
          <Label
            htmlFor="action"
            className="ml-1 text-[11px] font-black tracking-widest text-slate-400 uppercase"
          >
            操作指令
          </Label>
          <Input
            id="action"
            placeholder="如：login, sync_data..."
            value={filters.action || ''}
            onChange={e => handleFilterChange('action', e.target.value)}
            className="h-11 rounded-2xl border-slate-100 bg-slate-50/50 font-bold text-slate-900 focus:bg-white focus:ring-slate-900/5"
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
            label="时间跨度检索"
            className="rounded-2xl border-slate-100 bg-slate-50/50 font-black"
            showPresets={true}
            showClearButton={true}
          />
        </div>
      </div>

      {/* 背景装饰轨迹 */}
      <div className="absolute -right-4 -bottom-4 h-32 w-32 rounded-full bg-slate-900 opacity-5 blur-3xl transition-all group-hover:opacity-10" />
    </div>
  );
};
