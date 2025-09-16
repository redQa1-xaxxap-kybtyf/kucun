// 移动端搜索栏组件 - 优化的移动端搜索体验
// 支持快速搜索、筛选器和排序功能

import {
  Search,
  Filter,
  SortAsc,
  SortDesc,
  X,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

// 筛选器选项接口
export interface FilterOption {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'date' | 'daterange' | 'number';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}

// 排序选项接口
export interface SortOption {
  key: string;
  label: string;
  direction?: 'asc' | 'desc';
}

// 搜索状态接口
export interface SearchState {
  keyword: string;
  filters: Record<string, any>;
  sort?: {
    key: string;
    direction: 'asc' | 'desc';
  };
}

export interface MobileSearchBarProps {
  value: SearchState;
  onChange: (value: SearchState) => void;
  placeholder?: string;
  filterOptions?: FilterOption[];
  sortOptions?: SortOption[];
  onSearch?: (state: SearchState) => void;
  onReset?: () => void;
  className?: string;
  showFilterCount?: boolean;
  showSortIndicator?: boolean;
}

const MobileSearchBar = React.forwardRef<HTMLDivElement, MobileSearchBarProps>(
  (
    {
      value,
      onChange,
      placeholder = '搜索...',
      filterOptions = [],
      sortOptions = [],
      onSearch,
      onReset,
      className,
      showFilterCount = true,
      showSortIndicator = true,
      ...props
    },
    ref
  ) => {
    const [isFilterOpen, setIsFilterOpen] = React.useState(false);
    const [isSortOpen, setIsSortOpen] = React.useState(false);
    const [localKeyword, setLocalKeyword] = React.useState(value.keyword);

    // 同步外部关键词变化
    React.useEffect(() => {
      setLocalKeyword(value.keyword);
    }, [value.keyword]);

    // 处理搜索
    const handleSearch = (keyword?: string) => {
      const searchKeyword = keyword !== undefined ? keyword : localKeyword;
      const newState = { ...value, keyword: searchKeyword };
      onChange(newState);
      onSearch?.(newState);
    };

    // 处理关键词变化
    const handleKeywordChange = (keyword: string) => {
      setLocalKeyword(keyword);
      // 实时搜索（可选）
      if (keyword === '' || keyword.length >= 2) {
        handleSearch(keyword);
      }
    };

    // 处理筛选器变化
    const handleFilterChange = (key: string, filterValue: any) => {
      const newFilters = { ...value.filters };
      if (
        filterValue === undefined ||
        filterValue === '' ||
        filterValue === null
      ) {
        delete newFilters[key];
      } else {
        newFilters[key] = filterValue;
      }

      const newState = { ...value, filters: newFilters };
      onChange(newState);
    };

    // 处理排序变化
    const handleSortChange = (sortKey: string, direction: 'asc' | 'desc') => {
      const newState = {
        ...value,
        sort: { key: sortKey, direction },
      };
      onChange(newState);
      setIsSortOpen(false);
    };

    // 重置所有筛选
    const handleReset = () => {
      const resetState: SearchState = {
        keyword: '',
        filters: {},
        sort: undefined,
      };
      setLocalKeyword('');
      onChange(resetState);
      onReset?.();
    };

    // 计算活跃筛选器数量
    const activeFilterCount = Object.keys(value.filters).filter(
      key => value.filters[key] !== undefined && value.filters[key] !== ''
    ).length;

    // 获取当前排序标签
    const currentSortLabel = React.useMemo(() => {
      if (!value.sort) return undefined;
      const sortOption = sortOptions.find(
        option => option.key === value.sort?.key
      );
      return sortOption?.label;
    }, [value.sort, sortOptions]);

    return (
      <div className={cn('space-y-3', className)} ref={ref} {...props}>
        {/* 搜索输入框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            type="text"
            placeholder={placeholder}
            value={localKeyword}
            onChange={e => handleKeywordChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            className="pl-10 pr-4"
          />
          {localKeyword && (
            <button
              type="button"
              onClick={() => handleKeywordChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 transform text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 筛选和排序按钮 */}
        <div className="flex items-center gap-2">
          {/* 筛选器按钮 */}
          {filterOptions.length > 0 && (
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <Filter className="mr-2 h-4 w-4" />
                  筛选
                  {showFilterCount && activeFilterCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center p-0 text-xs"
                    >
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh]">
                <SheetHeader>
                  <SheetTitle>筛选条件</SheetTitle>
                  <SheetDescription>
                    设置筛选条件来精确查找数据
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-4">
                  {filterOptions.map(filter => (
                    <div key={filter.key} className="space-y-2">
                      <label className="text-sm font-medium">
                        {filter.label}
                      </label>

                      {filter.type === 'select' && (
                        <Select
                          value={value.filters[filter.key] || ''}
                          onValueChange={val =>
                            handleFilterChange(filter.key, val)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                filter.placeholder || `选择${filter.label}`
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {filter.options?.map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {filter.type === 'number' && (
                        <Input
                          type="number"
                          placeholder={filter.placeholder}
                          value={value.filters[filter.key] || ''}
                          onChange={e =>
                            handleFilterChange(filter.key, e.target.value)
                          }
                        />
                      )}

                      {filter.type === 'date' && (
                        <Input
                          type="date"
                          value={value.filters[filter.key] || ''}
                          onChange={e =>
                            handleFilterChange(filter.key, e.target.value)
                          }
                        />
                      )}
                    </div>
                  ))}

                  {/* 筛选器操作按钮 */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => setIsFilterOpen(false)}
                      className="flex-1"
                    >
                      应用筛选
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="flex-1"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      重置
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}

          {/* 排序按钮 */}
          {sortOptions.length > 0 && (
            <Sheet open={isSortOpen} onOpenChange={setIsSortOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  {value.sort?.direction === 'desc' ? (
                    <SortDesc className="mr-2 h-4 w-4" />
                  ) : (
                    <SortAsc className="mr-2 h-4 w-4" />
                  )}
                  排序
                  {showSortIndicator && currentSortLabel && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {currentSortLabel}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-auto">
                <SheetHeader>
                  <SheetTitle>排序方式</SheetTitle>
                  <SheetDescription>选择排序字段和排序方向</SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-2">
                  {sortOptions.map(sort => (
                    <div key={sort.key} className="space-y-2">
                      <div className="text-sm font-medium">{sort.label}</div>
                      <div className="flex gap-2">
                        <Button
                          variant={
                            value.sort?.key === sort.key &&
                            value.sort?.direction === 'asc'
                              ? 'default'
                              : 'outline'
                          }
                          size="sm"
                          onClick={() => handleSortChange(sort.key, 'asc')}
                          className="flex-1"
                        >
                          <SortAsc className="mr-2 h-4 w-4" />
                          升序
                        </Button>
                        <Button
                          variant={
                            value.sort?.key === sort.key &&
                            value.sort?.direction === 'desc'
                              ? 'default'
                              : 'outline'
                          }
                          size="sm"
                          onClick={() => handleSortChange(sort.key, 'desc')}
                          className="flex-1"
                        >
                          <SortDesc className="mr-2 h-4 w-4" />
                          降序
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          )}

          {/* 重置按钮 */}
          {(activeFilterCount > 0 || value.sort || localKeyword) && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 活跃筛选器标签 */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(value.filters).map(([key, filterValue]) => {
              if (!filterValue) return null;

              const filter = filterOptions.find(f => f.key === key);
              if (!filter) return null;

              let displayValue = filterValue;
              if (filter.type === 'select' && filter.options) {
                const option = filter.options.find(
                  opt => opt.value === filterValue
                );
                displayValue = option?.label || filterValue;
              }

              return (
                <Badge key={key} variant="secondary" className="text-xs">
                  {filter.label}: {displayValue}
                  <button
                    type="button"
                    onClick={() => handleFilterChange(key, undefined)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

MobileSearchBar.displayName = 'MobileSearchBar';

export {
  MobileSearchBar,
  type SearchState,
  type FilterOption,
  type SortOption,
};
