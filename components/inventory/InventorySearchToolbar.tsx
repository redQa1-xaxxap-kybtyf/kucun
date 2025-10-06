/**
 * 库存搜索工具栏组件
 * 包含搜索框、筛选器和操作按钮
 * ✅ 已迁移到使用 UnifiedSearchBar
 */

'use client';

import { AlertTriangle, Edit, Package, Plus } from 'lucide-react';
import * as React from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
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
 * 使用统一搜索栏优化性能
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
  }) => {
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

    return (
      <div className="p-3">
        <UnifiedSearchBar
          // 搜索配置
          searchValue={queryParams.search || ''}
          onSearchChange={onSearch}
          searchPlaceholder="搜索产品名称、编码..."
          debounceDelay={400}
          compact={true}

          // 操作按钮
          actionButtons={[
            {
              label: '入库',
              icon: <Plus className="mr-1 h-3 w-3" />,
              onClick: onInbound,
            },
            {
              label: '出库',
              icon: <Package className="mr-1 h-3 w-3" />,
              onClick: onOutbound,
              variant: 'outline',
            },
            {
              label: '调整',
              icon: <Edit className="mr-1 h-3 w-3" />,
              onClick: onAdjust,
              variant: 'outline',
            },
          ]}

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
              width: 'w-24',
            },
            {
              key: 'sortBy',
              label: '排序',
              options: [
                { label: '更新时间', value: 'updatedAt' },
                { label: '库存数量', value: 'quantity' },
              ],
              width: 'w-20',
            },
          ]}
          filterValues={{
            categoryId: queryParams.categoryId,
            sortBy: queryParams.sortBy,
          }}
          onFilterChange={handleFilterChange}
        />
      </div>
    );
  }
);

InventorySearchToolbar.displayName = 'InventorySearchToolbar';
