/**
 * 日志筛选组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { Filter, Search, X } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import type {
  SystemLogFilters,
  SystemLogLevel,
  SystemLogType,
} from '@/lib/types/settings';
import { cn } from '@/lib/utils';

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Filter className="mr-2 h-5 w-5" />
            筛选条件
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="mr-2 h-4 w-4" />
              清除筛选
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          根据日志类型、级别、时间范围等条件筛选日志记录
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* 关键词搜索 */}
          <div className="space-y-2">
            <Label htmlFor="search">关键词搜索</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
              <Input
                id="search"
                placeholder="搜索描述、操作等..."
                value={filters.search || ''}
                onChange={e => handleFilterChange('search', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* 日志类型 */}
          <div className="space-y-2">
            <Label>日志类型</Label>
            <Select
              value={filters.type || 'all'}
              onValueChange={value => handleFilterChange('type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择日志类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {LOG_TYPE_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 日志级别 */}
          <div className="space-y-2">
            <Label>日志级别</Label>
            <Select
              value={filters.level || 'all'}
              onValueChange={value => handleFilterChange('level', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择日志级别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部级别</SelectItem>
                {LOG_LEVEL_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className={cn('font-medium', option.color)}>
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 操作动作 */}
          <div className="space-y-2">
            <Label htmlFor="action">操作动作</Label>
            <Input
              id="action"
              placeholder="如：login, create_user..."
              value={filters.action || ''}
              onChange={e => handleFilterChange('action', e.target.value)}
            />
          </div>

          {/* 日期范围筛选 - 统一组件 */}
          <div className="space-y-2 md:col-span-2">
            <DateRangePicker
              value={{
                startDate: filters.startDate || undefined,
                endDate: filters.endDate || undefined,
              }}
              onChange={handleDateRangeChange}
              label="日期范围"
              showPresets={true}
              showClearButton={true}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
