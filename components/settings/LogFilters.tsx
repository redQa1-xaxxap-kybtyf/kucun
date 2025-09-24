/**
 * 日志筛选组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { CalendarIcon, Filter, Search, X } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { formatDate } from '@/lib/utils/datetime';

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
  { value: 'info', label: '信息', color: 'text-blue-600' },
  { value: 'warning', label: '警告', color: 'text-yellow-600' },
  { value: 'error', label: '错误', color: 'text-red-600' },
  { value: 'critical', label: '严重', color: 'text-red-800' },
];

/**
 * 日志筛选组件
 */
export const LogFilters = ({ filters, onFiltersChange }: LogFiltersProps) => {
  const [startDate, setStartDate] = React.useState<Date | undefined>(
    filters.startDate ? new Date(filters.startDate) : undefined
  );
  const [endDate, setEndDate] = React.useState<Date | undefined>(
    filters.endDate ? new Date(filters.endDate) : undefined
  );

  const handleFilterChange = (
    key: keyof SystemLogFilters,
    value: string | null
  ) => {
    onFiltersChange({
      ...filters,
      [key]: value === 'all' ? null : value || null,
    });
  };

  const handleDateChange = (type: 'start' | 'end', date: Date | undefined) => {
    if (type === 'start') {
      setStartDate(date);
      handleFilterChange(
        'startDate',
        date ? date.toISOString().split('T')[0] : null
      );
    } else {
      setEndDate(date);
      handleFilterChange(
        'endDate',
        date ? date.toISOString().split('T')[0] : null
      );
    }
  };

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
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
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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

          {/* 开始日期 */}
          <div className="space-y-2">
            <Label>开始日期</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? formatDate(startDate) : '选择开始日期'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={date => handleDateChange('start', date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* 结束日期 */}
          <div className="space-y-2">
            <Label>结束日期</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? formatDate(endDate) : '选择结束日期'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={date => handleDateChange('end', date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
