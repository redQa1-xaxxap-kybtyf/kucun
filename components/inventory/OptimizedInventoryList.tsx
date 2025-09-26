/**
 * 优化的库存列表组件
 * 集成所有性能优化技术：防抖搜索、虚拟滚动、React Query优化、组件性能优化
 */

'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { InventorySearchToolbar } from '@/components/inventory/InventorySearchToolbar';
import { VirtualizedInventoryTable } from '@/components/inventory/VirtualizedInventoryTable';
import { Button } from '@/components/ui/button';
import { useOptimizedInventoryQuery } from '@/hooks/use-optimized-inventory-query';
import type { InventoryQueryParams } from '@/lib/types/inventory';

interface OptimizedInventoryListProps {
  initialParams?: Partial<InventoryQueryParams>;
  categoryOptions: Array<{ id: string; name: string }>;
  /** 是否启用虚拟滚动 */
  enableVirtualization?: boolean;
  /** 虚拟滚动配置 */
  virtualizationConfig?: {
    itemHeight?: number;
    containerHeight?: number;
    overscan?: number;
  };
}

/**
 * 优化的库存列表组件
 * 使用React.memo和所有性能优化技术
 */
export const OptimizedInventoryList = React.memo<OptimizedInventoryListProps>(
  ({
    initialParams = {},
    categoryOptions,
    enableVirtualization = true,
    virtualizationConfig = {
      itemHeight: 60,
      containerHeight: 400,
      overscan: 5,
    },
  }) => {
    const router = useRouter();

    // 查询参数状态
    const [queryParams, setQueryParams] = React.useState<InventoryQueryParams>({
      page: 1,
      limit: 20,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      ...initialParams,
    });

    // 选中的库存ID
    const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

    // 使用优化的查询Hook
    const { data, isLoading, isError, error, cache } =
      useOptimizedInventoryQuery({
        params: queryParams,
        prefetchNext: true,
        prefetchPrev: false,
      });

    // 优化的搜索处理函数（防抖已在InventorySearchToolbar中实现）
    const handleSearch = React.useCallback((value: string) => {
      setQueryParams(prev => ({
        ...prev,
        search: value,
        page: 1, // 搜索时重置到第一页
      }));
    }, []);

    // 优化的筛选处理函数
    const handleFilter = React.useCallback(
      (
        key: keyof InventoryQueryParams,
        value: string | number | boolean | undefined
      ) => {
        setQueryParams(prev => ({
          ...prev,
          [key]: value,
          page: 1, // 筛选时重置到第一页
        }));
      },
      []
    );

    // 优化的分页处理函数
    const handlePageChange = React.useCallback((page: number) => {
      setQueryParams(prev => ({ ...prev, page }));
    }, []);

    // 优化的导航处理函数
    const handleInbound = React.useCallback(() => {
      router.push('/inventory/inbound');
    }, [router]);

    const handleOutbound = React.useCallback(() => {
      router.push('/inventory/outbound');
    }, [router]);

    const handleAdjust = React.useCallback(
      (inventoryId?: string) => {
        if (inventoryId) {
          router.push(`/inventory/adjust?id=${inventoryId}`);
        } else {
          router.push('/inventory/adjust');
        }
      },
      [router]
    );

    // 优化的选择处理函数
    const handleSelectAll = React.useCallback(
      (checked: boolean) => {
        if (checked && data?.data) {
          setSelectedIds(data.data.map(item => item.id));
        } else {
          setSelectedIds([]);
        }
      },
      [data?.data]
    );

    const handleSelectRow = React.useCallback(
      (id: string, checked: boolean) => {
        setSelectedIds(prev => {
          if (checked) {
            return [...prev, id];
          } else {
            return prev.filter(selectedId => selectedId !== id);
          }
        });
      },
      []
    );

    // 使用useMemo优化计算
    const inventoryData = React.useMemo(() => data?.data || [], [data?.data]);
    const pagination = React.useMemo(
      () => data?.pagination,
      [data?.pagination]
    );

    // 错误处理
    if (isError) {
      return (
        <div className="space-y-4">
          <div className="rounded border bg-card p-6 text-center">
            <div className="text-destructive">
              加载库存数据时出错: {error?.message || '未知错误'}
            </div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => cache.invalidate()}
            >
              重试
            </Button>
          </div>
        </div>
      );
    }

    // 加载状态
    if (isLoading && inventoryData.length === 0) {
      return (
        <div className="space-y-4">
          {/* 工具栏骨架 */}
          <div className="rounded border bg-card">
            <div className="border-b bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-7 w-16 animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 表格骨架 */}
          <div className="rounded border bg-card">
            <div className="p-4">
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* 工具栏 */}
        <div className="rounded border bg-card">
          <div className="border-b bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">库存管理</h3>
              <div className="text-xs text-muted-foreground">
                {pagination ? `共 ${pagination.total} 条记录` : ''}
                {selectedIds.length > 0 && (
                  <span className="ml-2 text-blue-600">
                    已选择 {selectedIds.length} 个库存记录
                  </span>
                )}
              </div>
            </div>
          </div>
          <InventorySearchToolbar
            queryParams={queryParams}
            categoryOptions={categoryOptions}
            onSearch={handleSearch}
            onFilter={handleFilter}
            onInbound={handleInbound}
            onOutbound={handleOutbound}
            onAdjust={handleAdjust}
            selectedCount={selectedIds.length}
          />
        </div>

        {/* 数据表格 */}
        {enableVirtualization ? (
          <VirtualizedInventoryTable
            data={inventoryData}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectRow={handleSelectRow}
            onAdjust={handleAdjust}
            {...virtualizationConfig}
          />
        ) : (
          <div className="rounded border bg-card">
            {/* 非虚拟化表格实现 */}
            <div className="p-4 text-center text-muted-foreground">
              非虚拟化表格待实现
            </div>
          </div>
        )}

        {/* 分页 */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              第 {pagination.page} 页，共 {pagination.totalPages} 页
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || isLoading}
              >
                下一页
              </Button>
            </div>
          </div>
        )}

        {/* 加载指示器 */}
        {isLoading && inventoryData.length > 0 && (
          <div className="text-center text-xs text-muted-foreground">
            正在加载...
          </div>
        )}
      </div>
    );
  }
);

OptimizedInventoryList.displayName = 'OptimizedInventoryList';
