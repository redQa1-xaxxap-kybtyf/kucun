'use client';

/**
 * 统一搜索栏组件
 * 支持防抖搜索、筛选器、操作按钮等功能
 * 遵循全栈项目统一约定规范
 */

import { Loader2, Search, X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  includeAllOption?: boolean;
  defaultValue?: string;
}

/**
 * 操作按钮配置
 */
export interface ActionButton {
  key?: string; // 唯一标识符，用于 React key prop
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  className?: string;
  disabled?: boolean;
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

  // ✅ 新增：搜索状态指示
  isSearching?: boolean; // 是否正在搜索
  resultCount?: number; // 搜索结果数量
  totalCount?: number; // 总结果数量

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
  variant?: 'default' | 'pro'; // 样式变体
}

function getResponsiveFilterWidthClass(width?: string) {
  if (!width) {
    return 'w-full sm:w-32';
  }

  const tokens = width.split(/\s+/).filter(Boolean);
  const normalizedTokens = tokens.map(token =>
    /^w-/.test(token) ? `sm:${token}` : token
  );

  return ['w-full', ...normalizedTokens].join(' ');
}

interface ActionButtonsSectionProps {
  actionButtons: ActionButton[];
  buttonSize: string;
  compact: boolean;
  disabled: boolean;
}

const ActionButtonsSection: React.FC<ActionButtonsSectionProps> = ({
  actionButtons,
  buttonSize,
  compact,
  disabled,
}) => {
  if (actionButtons.length === 0) {
    return null;
  }

  return (
    <>
      {actionButtons.map((action, index) => (
        <Button
          key={action.key || action.label || `action-${index}`}
          size={compact ? 'sm' : 'default'}
          variant={action.variant || 'default'}
          className={cn(
            'w-full justify-center sm:w-auto',
            buttonSize,
            action.className
          )}
          onClick={action.onClick}
          disabled={disabled || action.disabled}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
      <div className="bg-border mx-1 hidden h-6 w-px sm:block" />
    </>
  );
};

interface SearchInputBoxProps {
  compact: boolean;
  disabled: boolean;
  inputSize: string;
  isSearching: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  searchPlaceholder: string;
  searchValue: string;
  showClearButton: boolean;
}

const SearchInputBox: React.FC<SearchInputBoxProps> = ({
  compact,
  disabled,
  inputSize,
  isSearching,
  onChange,
  onClear,
  searchPlaceholder,
  searchValue,
  showClearButton,
}) => (
  <div className="relative w-full min-w-0 flex-1 sm:max-w-[320px] sm:min-w-[200px]">
    {isSearching ? (
      <Loader2
        className={cn(
          'text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 animate-spin',
          compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
        )}
      />
    ) : (
      <Search
        className={cn(
          'text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2',
          compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
        )}
      />
    )}
    <Input
      type="text"
      inputMode="search"
      enterKeyHint="search"
      autoCapitalize="off"
      autoCorrect="off"
      placeholder={searchPlaceholder}
      value={searchValue}
      onChange={onChange}
      disabled={disabled}
      className={cn(
        'pl-10',
        showClearButton && searchValue && 'pr-10',
        inputSize
      )}
    />
    {showClearButton && searchValue && (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onClear}
        disabled={disabled}
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
);

interface ResultInfoProps {
  isSearching: boolean;
  resultCount?: number;
  searchValue: string;
  totalCount?: number;
}

const ResultInfo: React.FC<ResultInfoProps> = ({
  isSearching,
  resultCount,
  searchValue,
  totalCount,
}) => {
  if (!searchValue || isSearching || resultCount === undefined) {
    return null;
  }

  const content =
    resultCount === 0
      ? '未找到结果'
      : `找到 ${resultCount}${totalCount ? ` / ${totalCount}` : ''} 个结果`;

  return (
    <span className="text-muted-foreground text-xs whitespace-nowrap">
      {content}
    </span>
  );
};

interface ToggleButtonsSectionProps {
  buttonSize: string;
  compact: boolean;
  disabled: boolean;
  toggleButtons: ToggleButton[];
}

const ToggleButtonsSection: React.FC<ToggleButtonsSectionProps> = ({
  buttonSize,
  compact,
  disabled,
  toggleButtons,
}) => {
  if (toggleButtons.length === 0) {
    return null;
  }

  return (
    <>
      {toggleButtons.map(toggle => (
        <Button
          key={toggle.key}
          variant={'outline'}
          size={compact ? 'sm' : 'default'}
          data-active={toggle.active || undefined}
          className={cn(
            buttonSize,
            'gap-1',
            // 将激活态局部化，避免大面积背景/阴影变动
            'data-[active=true]:border-[hsl(var(--color-primary))] data-[active=true]:bg-[hsl(var(--color-primary-light))] data-[active=true]:text-[hsl(var(--color-primary))]'
          )}
          onClick={toggle.onClick}
          disabled={disabled}
        >
          {toggle.icon}
          <span className={compact ? 'text-xs' : ''}>{toggle.label}</span>
        </Button>
      ))}
    </>
  );
};

interface FiltersSectionProps {
  compact: boolean;
  createHandler: (filter: FilterConfig) => (value: string) => void;
  disabled: boolean;
  filterValues: Record<string, string | undefined>;
  filters: FilterConfig[];
  inputSize: string;
}

const FiltersSection: React.FC<FiltersSectionProps> = ({
  compact,
  createHandler,
  disabled,
  filterValues,
  filters,
  inputSize,
}) => {
  if (filters.length === 0) {
    return null;
  }

  return (
    <>
      {filters.map(filter => {
        const includeAllOption = filter.includeAllOption ?? true;
        const selectedValue =
          filterValues[filter.key] ??
          filter.defaultValue ??
          (includeAllOption ? 'all' : '');

        return (
          <select
            key={filter.key}
            aria-label={filter.label}
            value={selectedValue}
            onChange={e => createHandler(filter)(e.target.value)}
            disabled={disabled}
            className={cn(
              'border-input bg-background ring-offset-background focus:ring-ring rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
              getResponsiveFilterWidthClass(filter.width),
              inputSize,
              compact && 'text-xs'
            )}
          >
            {includeAllOption ? (
              <option value="all">全部{filter.label}</option>
            ) : (
              <option value="">{filter.placeholder || filter.label}</option>
            )}
            {filter.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      })}
    </>
  );
};

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
    isSearching = false, // ✅ 新增：搜索状态
    resultCount, // ✅ 新增：结果数量
    totalCount, // ✅ 新增：总数量
    filters = [],
    filterValues = {},
    onFilterChange,
    toggleButtons = [],
    actionButtons = [],
    className,
    compact = false,
    variant = 'default',
  }) => {
    const [isHydrated, setIsHydrated] = React.useState(false);

    React.useEffect(() => {
      setIsHydrated(true);
    }, []);

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
      (filter: FilterConfig) => (value: string) => {
        if (onFilterChange) {
          const includeAllOption = filter.includeAllOption ?? true;
          const isResetValue =
            value === '' ||
            (includeAllOption && value === 'all') ||
            (filter.defaultValue !== undefined &&
              value === filter.defaultValue);
          onFilterChange(filter.key, isResetValue ? undefined : value);
        }
      },
      [onFilterChange]
    );

    const isPro = variant === 'pro';
    const inputSize = isPro
      ? 'h-11 rounded-lg border-[hsl(var(--color-border-primary))] bg-white font-medium'
      : compact
        ? 'h-8 text-sm'
        : 'h-10';
    const buttonSize = isPro
      ? 'h-10 rounded-lg px-3'
      : compact
        ? 'h-8'
        : 'h-10';

    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <ActionButtonsSection
          actionButtons={actionButtons}
          buttonSize={buttonSize}
          compact={compact}
          disabled={!isHydrated}
        />
        <SearchInputBox
          compact={compact}
          disabled={!isHydrated}
          inputSize={inputSize}
          isSearching={isSearching}
          onChange={handleInputChange}
          onClear={handleClearSearch}
          searchPlaceholder={searchPlaceholder}
          searchValue={searchValue}
          showClearButton={showClearButton}
        />
        <ResultInfo
          isSearching={isSearching}
          resultCount={resultCount}
          searchValue={searchValue}
          totalCount={totalCount}
        />
        <ToggleButtonsSection
          buttonSize={buttonSize}
          compact={compact}
          disabled={!isHydrated}
          toggleButtons={toggleButtons}
        />
        <FiltersSection
          compact={compact}
          createHandler={handleFilterChange}
          disabled={!isHydrated}
          filterValues={filterValues ?? {}}
          filters={filters}
          inputSize={inputSize}
        />
      </div>
    );
  }
);

UnifiedSearchBar.displayName = 'UnifiedSearchBar';
