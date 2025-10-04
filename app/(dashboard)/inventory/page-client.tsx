'use client';

import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';
import { toast } from 'sonner';

import { ERPInventoryList } from '@/components/inventory/erp-inventory-list';
import { useOptimizedInventoryQuery } from '@/hooks/use-optimized-inventory-query';
import { useInventoryUpdates } from '@/hooks/use-websocket';
import type { CategoryOption } from '@/lib/types/category';
import type {
  Inventory,
  InventoryQueryParams,
  InventoryQueryResult,
} from '@/lib/types/inventory';

interface InventoryPageClientProps {
  initialData: {
    data: InventoryQueryResult[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams: InventoryQueryParams;
  categoryOptions: CategoryOption[];
}

/**
 * 库存管理页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 */
export function InventoryPageClient({
  initialData,
  initialParams,
  categoryOptions,
}: InventoryPageClientProps) {
  const queryClient = useQueryClient();
  const [queryParams, setQueryParams] =
    React.useState<InventoryQueryParams>(initialParams);

  // 获取库存列表数据（使用优化Hook，内置缓存与预取，保持上一页数据）
  const { data, isLoading, error } = useOptimizedInventoryQuery({
    params: queryParams,
    initialData: {
      success: true,
      data: {
        inventories: initialData.data,
        pagination: initialData.pagination,
      },
    },
  });

  // 订阅库存实时更新
  useInventoryUpdates(
    React.useCallback(
      event => {
        // 刷新库存列表
        queryClient.invalidateQueries({ queryKey: ['inventory'] });

        // 显示变更提示
        const changeType = event.changeAmount > 0 ? '增加' : '减少';
        const amount = Math.abs(event.changeAmount);
        toast.info(
          `库存变更: ${event.productName || '产品'} ${changeType} ${amount}`,
          {
            description: event.reason || event.action,
          }
        );
      },
      [queryClient]
    )
  );

  // 规范化列表数据结构，适配不同返回字段命名
  const normalizedData = React.useMemo(() => {
    if (!data) {
      return { data: [], pagination: undefined };
    }

    // 处理API响应的嵌套结构
    // API返回: { success: true, data: { data: [...], pagination: {...} } }
    // 组件期望: { data: [...], pagination: {...} }
    const response = data as {
      success?: boolean;
      data?: {
        data?: Inventory[];
        inventories?: Inventory[];
        pagination?: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
      // 直接格式（向后兼容）
      inventories?: Inventory[];
      pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    };

    // 优先从嵌套的data中提取
    const nestedData = response.data;
    const items =
      nestedData?.data ?? nestedData?.inventories ?? response.inventories ?? [];
    const pagination = nestedData?.pagination ?? response.pagination;

    return { data: items, pagination };
  }, [data]);

  // 搜索处理
  const handleSearch = React.useCallback((value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  }, []);

  // 筛选处理
  const handleFilter = React.useCallback(
    (
      key: keyof InventoryQueryParams,
      value: string | number | boolean | undefined
    ) => {
      setQueryParams(prev => ({ ...prev, [key]: value, page: 1 }));
    },
    []
  );

  // 分页处理
  const handlePageChange = React.useCallback((page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  }, []);

  if (error) {
    return (
      <div className="bg-card rounded border p-4 text-center text-red-600">
        加载失败: {error instanceof Error ? error.message : '未知错误'}
      </div>
    );
  }

  return (
    <ERPInventoryList
      data={normalizedData}
      categoryOptions={categoryOptions}
      queryParams={queryParams}
      onSearch={handleSearch}
      onFilter={handleFilter}
      onPageChange={handlePageChange}
      isLoading={isLoading}
    />
  );
}
