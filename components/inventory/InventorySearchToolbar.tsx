/**
 * 库存搜索工具栏组件
 * 包含搜索框、筛选器和操作按钮
 */

'use client';

import { AlertTriangle, Edit, Package, Plus, Search } from 'lucide-react';
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
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import type { InventoryQueryParams } from '@/lib/types/inventory';

interface InventorySearchToolbarProps {
  queryParams: InventoryQueryParams;
  categoryOptions: Array<{ id: string; name: string }>;
  onSearch: (value: string) => void;
  onFilter: (
    key: keyof InventoryQueryParams,
    value: string | number | boolean | undefined
  ) => void;
  onInbound: () => void;
  onOutbound: () => void;
  onAdjust: () => void;
  selectedCount?: number;
}

/**
 * 库存搜索工具栏组件
 * 使用防抖搜索优化性能
 */
export const InventorySearchToolbar = React.memo<InventorySearchToolbarProps>(
  ({
    queryParams,
    categoryOptions,
    onSearch,
    onFilter,
    onInbound,
    onOutbound,
    onAdjust,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    selectedCount = 0, // 保留参数但不使用
  }) => {
    // 使用防抖搜索Hook
    const { inputValue, debouncedValue, isDebouncing, setInputValue } =
      useDebouncedSearch({
        delay: 400,
        minLength: 0,
      });

    // 监听防抖后的值变化，触发搜索
    React.useEffect(() => {
      onSearch(debouncedValue);
    }, [debouncedValue, onSearch]);

    // 初始化搜索值
    const prevSearchRef = React.useRef(queryParams.search);
    React.useEffect(() => {
      if (queryParams.search !== prevSearchRef.current) {
        setInputValue(queryParams.search || '');
        prevSearchRef.current = queryParams.search;
      }
    }, [queryParams.search, setInputValue]); // 使用ref避免inputValue依赖

    // 优化的事件处理函数
    const handleLowStockFilter = React.useCallback(() => {
      onFilter('lowStock', !queryParams.lowStock);
    }, [onFilter, queryParams.lowStock]);

    const handleHasStockFilter = React.useCallback(() => {
      onFilter('hasStock', !queryParams.hasStock);
    }, [onFilter, queryParams.hasStock]);

    const handleCategoryChange = React.useCallback(
      (value: string) => {
        onFilter('categoryId', value === 'all' ? undefined : value);
      },
      [onFilter]
    );

    const handleSortChange = React.useCallback(
      (value: string) => {
        onFilter('sortBy', value);
      },
      [onFilter]
    );

    return (
      <div className="p-3">
        <div className="flex items-center gap-2">
          {/* 操作按钮 */}
          <Button size="sm" className="h-7" onClick={onInbound}>
            <Plus className="mr-1 h-3 w-3" />
            入库
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={onOutbound}
          >
            <Package className="mr-1 h-3 w-3" />
            出库
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={onAdjust}
          >
            <Edit className="mr-1 h-3 w-3" />
            调整
          </Button>
          <div className="bg-border mx-2 h-4 w-px" />

          {/* 防抖搜索框 */}
          <div className="relative max-w-xs flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
            <Input
              placeholder="搜索产品名称、编码..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
            {isDebouncing && (
              <div className="absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2">
                <div className="border-primary h-3 w-3 animate-spin rounded-full border-2 border-t-transparent" />
              </div>
            )}
          </div>

          {/* 筛选器 */}
          <Button
            variant={queryParams.lowStock ? 'default' : 'outline'}
            size="sm"
            className="h-7"
            onClick={handleLowStockFilter}
          >
            <AlertTriangle className="mr-1 h-3 w-3" />
            库存偏低
          </Button>

          <Button
            variant={queryParams.hasStock ? 'default' : 'outline'}
            size="sm"
            className="h-7"
            onClick={handleHasStockFilter}
          >
            <Package className="mr-1 h-3 w-3" />
            有库存
          </Button>

          <Select
            value={queryParams.categoryId || 'all'}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue placeholder="分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {categoryOptions.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={queryParams.sortBy || 'updatedAt'}
            onValueChange={handleSortChange}
          >
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue placeholder="排序" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">更新时间</SelectItem>
              <SelectItem value="quantity">库存数量</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }
);

InventorySearchToolbar.displayName = 'InventorySearchToolbar';
