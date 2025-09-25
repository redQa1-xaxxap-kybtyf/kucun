'use client';

import { Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { InventorySearchToolbar } from '@/components/inventory/inventory-search-toolbar';
import { InventoryTableRow } from '@/components/inventory/inventory-table-row';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Inventory, InventoryQueryParams } from '@/lib/types/inventory';

interface ERPInventoryListProps {
  data: {
    data: Inventory[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  categoryOptions: Array<{ id: string; name: string }>;
  queryParams: InventoryQueryParams;
  onSearch: (value: string) => void;
  onFilter: (
    key: keyof InventoryQueryParams,
    value: string | number | boolean | undefined
  ) => void;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

/**
 * ERP风格库存列表组件
 * 符合中国ERP系统的用户体验标准
 * 使用React.memo和子组件优化性能
 */
export const ERPInventoryList = React.memo<ERPInventoryListProps>(
  ({
    data,
    categoryOptions,
    queryParams,
    onSearch,
    onFilter,
    onPageChange,
    isLoading = false,
  }) => {
    const router = useRouter();
    const [selectedInventoryIds, setSelectedInventoryIds] = React.useState<
      string[]
    >([]);

    // 处理行选择
    const handleRowSelect = (inventoryId: string, checked: boolean) => {
      if (checked) {
        setSelectedInventoryIds(prev => [...prev, inventoryId]);
      } else {
        setSelectedInventoryIds(prev => prev.filter(id => id !== inventoryId));
      }
    };

    // 处理全选
    const handleSelectAll = (checked: boolean) => {
      if (checked) {
        setSelectedInventoryIds(data.data.map(item => item.id));
      } else {
        setSelectedInventoryIds([]);
      }
    };

    // 优化的事件处理函数
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

    const handleInbound = React.useCallback(() => {
      router.push('/inventory/inbound');
    }, [router]);

    const handleOutbound = React.useCallback(() => {
      router.push('/inventory/outbound');
    }, [router]);

    if (isLoading) {
      return (
        <div className="rounded border bg-card">
          <div className="border-b bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">库存管理</h3>
              <div className="text-xs text-muted-foreground">加载中...</div>
            </div>
          </div>
          <div className="p-3">
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-muted" />
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* ERP标准工具栏 */}
        <div className="rounded border bg-card">
          <div className="border-b bg-muted/30 px-3 py-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">库存管理</h3>
              <div className="text-xs text-muted-foreground">
                {data?.pagination ? `共 ${data.pagination.total} 条记录` : ''}
                {selectedInventoryIds.length > 0 && (
                  <span className="ml-2 text-blue-600">
                    已选择 {selectedInventoryIds.length} 个库存记录
                  </span>
                )}
              </div>
            </div>
          </div>
          <InventorySearchToolbar
            queryParams={queryParams}
            categoryOptions={categoryOptions}
            onSearch={onSearch}
            onFilter={onFilter}
            onInbound={handleInbound}
            onOutbound={handleOutbound}
            onAdjust={handleAdjust}
            selectedCount={selectedInventoryIds.length}
          />
        </div>

        {/* ERP标准数据表格 */}
        <div className="rounded border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-12 text-xs">
                  <input
                    type="checkbox"
                    checked={
                      selectedInventoryIds.length === data.data.length &&
                      data.data.length > 0
                    }
                    onChange={e => handleSelectAll(e.target.checked)}
                    className="rounded border border-input"
                  />
                </TableHead>
                <TableHead className="text-xs">产品编码</TableHead>
                <TableHead className="text-xs">产品名称</TableHead>
                <TableHead className="text-xs">规格</TableHead>
                <TableHead className="text-xs">批次号</TableHead>
                <TableHead className="text-xs">库存数量</TableHead>
                <TableHead className="text-xs">预留数量</TableHead>
                <TableHead className="text-xs">可用数量</TableHead>
                <TableHead className="text-xs">库存状态</TableHead>
                <TableHead className="text-xs">最后更新</TableHead>
                <TableHead className="w-20 text-xs">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8" />
                      <div>暂无库存数据</div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map(item => (
                  <InventoryTableRow
                    key={item.id}
                    item={item}
                    isSelected={selectedInventoryIds.includes(item.id)}
                    onSelect={handleRowSelect}
                    onAdjust={handleAdjust}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              第 {data.pagination.page} 页，共 {data.pagination.totalPages} 页
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() =>
                  data.pagination && onPageChange(data.pagination.page - 1)
                }
                disabled={data.pagination.page <= 1}
              >
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() =>
                  data.pagination && onPageChange(data.pagination.page + 1)
                }
                disabled={data.pagination.page >= data.pagination.totalPages}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ERPInventoryList.displayName = 'ERPInventoryList';
