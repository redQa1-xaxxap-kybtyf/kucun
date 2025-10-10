'use client';

/**
 * 统一搜索栏组件
 * 支持防抖搜索、筛选器、操作按钮等功能
 * 遵循全栈项目统一约定规范
 */

import { Search, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 筛选器选项
 */
export interface FilterOption {
  label: string;
  value: string;
}

/**
 * 筛选器配置
 */
export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  placeholder?: string;
  width?: string; // Tailwind类名,如 'w-32'
}

/**
 * 操作按钮配置
 */
export interface ActionButton {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  className?: string;
}

/**
 * 切换按钮配置
 */
export interface ToggleButton {
  key: string;
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

/**
 * 搜索栏配置
 */
export interface UnifiedSearchBarProps {
  // 搜索相关
  searchValue?: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  debounceDelay?: number;
  showClearButton?: boolean;

  // 筛选器
  filters?: FilterConfig[];
  filterValues?: Record<string, string | undefined>;
  onFilterChange?: (key: string, value: string | undefined) => void;

  // 切换按钮
  toggleButtons?: ToggleButton[];

  // 操作按钮
  actionButtons?: ActionButton[];

  // 样式
  className?: string;
  compact?: boolean; // 紧凑模式,用于移动端或空间有限的场景
}

// ============================================================================
// 统一搜索栏组件
// ============================================================================

export const UnifiedSearchBar = React.memo<UnifiedSearchBarProps>(
  ({
    searchValue = '',
    onSearchChange,
    searchPlaceholder = '搜索...',
    debounceDelay: _debounceDelay = 400, // 防抖由父组件处理
    showClearButton = true,
    filters = [],
    filterValues = {},
    onFilterChange,
    toggleButtons = [],
    actionButtons = [],
    className,
    compact = false,
  }) => {
    // ✅ 修复：使用受控输入，避免内部状态导致的双重渲染
    // 直接使用外部传入的 searchValue，不维护本地状态
    // 这样可以避免状态同步导致的抖动问题

    // 处理输入变化 - 直接调用父组件回调
    const handleInputChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        onSearchChange(newValue); // 父组件负责防抖和状态管理
      },
      [onSearchChange]
    );

    // 清空搜索
    const handleClearSearch = React.useCallback(() => {
      onSearchChange('');
    }, [onSearchChange]);

    // 筛选器变更处理
    const handleFilterChange = React.useCallback(
      (key: string) => (value: string) => {
        if (onFilterChange) {
          const newValue = value === 'all' ? undefined : value;
          onFilterChange(key, newValue);
        }
      },
      [onFilterChange]
    );

    const inputSize = compact ? 'h-8 text-sm' : 'h-10';
    const buttonSize = compact ? 'h-8' : 'h-10';

    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <div className="flex flex-wrap items-center gap-2">
          {/* 操作按钮组 */}
          {actionButtons.length > 0 && (
            <>
              {actionButtons.map((action, index) => (
                <Button
                  key={index}
                  size={compact ? 'sm' : 'default'}
                  variant={action.variant || 'default'}
                  className={cn(buttonSize, action.className)}
                  onClick={action.onClick}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
              {/* 分隔线 */}
              <div className="bg-border mx-1 h-6 w-px" />
            </>
          )}

          {/* 搜索框 */}
          <div className="relative w-[280px] min-w-[200px] sm:w-[320px]">
            <Search
              className={cn(
                'text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2',
                compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
              )}
            />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={handleInputChange}
              className={cn(
                'pl-10',
                showClearButton && searchValue && 'pr-10',
                inputSize
              )}
            />
            {/* 清空按钮 */}
            {showClearButton && searchValue && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSearch}
                className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 p-0 hover:bg-transparent"
                aria-label="清空搜索"
              >
                <X
                  className={cn(
                    'text-muted-foreground hover:text-foreground',
                    compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
                  )}
                />
              </Button>
            )}
          </div>

          {/* 切换按钮组 */}
          {toggleButtons.length > 0 &&
            toggleButtons.map(toggle => (
              <Button
                key={toggle.key}
                variant={toggle.active ? 'default' : 'outline'}
                size={compact ? 'sm' : 'default'}
                className={cn(buttonSize, 'gap-1')}
                onClick={toggle.onClick}
              >
                {toggle.icon}
                <span className={compact ? 'text-xs' : ''}>{toggle.label}</span>
              </Button>
            ))}

          {/* 筛选器组 */}
          {filters.length > 0 &&
            filters.map(filter => (
              <Select
                key={filter.key}
                value={filterValues[filter.key] || 'all'}
                onValueChange={handleFilterChange(filter.key)}
              >
                <SelectTrigger
                  className={cn(
                    inputSize,
                    filter.width || 'w-32',
                    compact && 'text-xs'
                  )}
                >
                  <SelectValue
                    placeholder={filter.placeholder || filter.label}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部{filter.label}</SelectItem>
                  {filter.options.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
        </div>
      </div>
    );
  }
);

UnifiedSearchBar.displayName = 'UnifiedSearchBar';
