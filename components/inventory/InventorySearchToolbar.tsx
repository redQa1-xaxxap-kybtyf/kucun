/**
 * 库存搜索工具栏组件
 * 包含搜索框、筛选器和操作按钮
 * ✅ 已迁移到使用 UnifiedSearchBar
 * ✅ 符合产品模块UI风格规范
 */

'use client';

import { AlertTriangle, Filter, Package } from 'lucide-react';
import * as React from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Button } from '@/components/ui/button';
import type { InventoryQueryParams } from '@/lib/types/inventory';

interface InventorySearchToolbarProps {
  queryParams: InventoryQueryParams;
  categoryOptions: Array<{ id: string; name: string }>;
  onSearch: (value: string) => void;
  onFilter: (
    key: keyof InventoryQueryParams,
    value: string | number | boolean | undefined
  ) => void;
}

/**
 * 库存搜索工具栏组件
 * 使用统一搜索栏优化性能
 * 符合产品模块UI风格规范
 */
export const InventorySearchToolbar = React.memo<InventorySearchToolbarProps>(
  ({ queryParams, categoryOptions, onSearch, onFilter }) => {
    // 统一处理筛选器变更
    const handleFilterChange = React.useCallback(
      (key: string, value: string | undefined) => {
        if (key === 'categoryId') {
          onFilter('categoryId', value);
        } else if (key === 'sortBy') {
          onFilter('sortBy', value);
        }
      },
      [onFilter]
    );

    // 处理切换按钮点击
    const handleToggleLowStock = React.useCallback(() => {
      onFilter('lowStock', !queryParams.lowStock);
    }, [onFilter, queryParams.lowStock]);

    const handleToggleHasStock = React.useCallback(() => {
      onFilter('hasStock', !queryParams.hasStock);
    }, [onFilter, queryParams.hasStock]);

    // 清空所有筛选（保留 sortBy 因为它是默认排序，不算筛选）
    const handleClearFilters = React.useCallback(() => {
      onFilter('categoryId', undefined);
      onFilter('lowStock', false);
      onFilter('hasStock', false);
    }, [onFilter]);

    // 检查是否有激活的筛选器（排除默认值）
    const hasActiveFilters =
      !!queryParams.categoryId || // 有选择分类
      queryParams.lowStock || // 开启了库存偏低
      queryParams.hasStock; // 开启了有库存
    // 注意：不包括 sortBy，因为它总是有默认值 'updatedAt'

    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-white p-4 shadow-md shadow-gray-200/50">
          <div className="flex flex-wrap items-center gap-2">
            <UnifiedSearchBar
              // 搜索配置
              searchValue={queryParams.search || ''}
              onSearchChange={onSearch}
              searchPlaceholder="搜索产品名称、编码..."
              debounceDelay={400}
              compact={true}
              // 切换按钮
              toggleButtons={[
                {
                  key: 'lowStock',
                  label: '库存偏低',
                  icon: <AlertTriangle className="mr-1 h-3 w-3" />,
                  active: !!queryParams.lowStock,
                  onClick: handleToggleLowStock,
                },
                {
                  key: 'hasStock',
                  label: '有库存',
                  icon: <Package className="mr-1 h-3 w-3" />,
                  active: !!queryParams.hasStock,
                  onClick: handleToggleHasStock,
                },
              ]}
              // 筛选器
              filters={[
                {
                  key: 'categoryId',
                  label: '分类',
                  options: categoryOptions.map(cat => ({
                    label: cat.name,
                    value: cat.id,
                  })),
                  width: 'w-[140px]',
                },
                {
                  key: 'sortBy',
                  label: '排序',
                  options: [
                    { label: '更新时间', value: 'updatedAt' },
                    { label: '库存数量', value: 'quantity' },
                  ],
                  width: 'w-[140px]',
                },
              ]}
              filterValues={{
                categoryId: queryParams.categoryId,
                sortBy: queryParams.sortBy,
              }}
              onFilterChange={handleFilterChange}
            />

            {/* 清空筛选按钮 - 仅在有激活的筛选时显示，显示在筛选器右侧 */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="h-8 gap-1.5 transition-all hover:border-blue-300 hover:bg-blue-50"
              >
                <Filter className="h-3.5 w-3.5" />
                清空筛选
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

InventorySearchToolbar.displayName = 'InventorySearchToolbar';
