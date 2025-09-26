'use client';

import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

import { ERPInventoryList } from '@/components/inventory/erp-inventory-list';
import { useOptimizedInventoryQuery } from '@/hooks/use-optimized-inventory-query';
import { categoryQueryKeys, getCategoryOptions } from '@/lib/api/categories';
import type { Inventory, InventoryQueryParams } from '@/lib/types/inventory';

/**
 * 库存管理页面 - ERP风格
 * 严格遵循全栈项目统一约定规范
 */
export default function InventoryPage() {
  const [queryParams, setQueryParams] = React.useState<InventoryQueryParams>({
    page: 1,
    limit: 20,
    search: '',
    categoryId: '',
    lowStock: false,
    hasStock: false,
    groupByVariant: false,
    includeVariants: true,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  // 获取库存列表数据（使用优化Hook，内置缓存与预取，保持上一页数据）
  const { data, isLoading, error } = useOptimizedInventoryQuery({
    params: queryParams,
  });

  // 获取分类选项数据
  const { data: categoryOptions = [] } = useQuery({
    queryKey: categoryQueryKeys.options(),
    queryFn: getCategoryOptions,
  });

  // 规范化列表数据结构，适配不同返回字段命名
  const normalizedData = React.useMemo(() => {
    if (!data) return { data: [], pagination: undefined };

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
      <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="rounded border bg-card p-4 text-center text-red-600">
          加载失败: {error instanceof Error ? error.message : '未知错误'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ERPInventoryList
        data={normalizedData}
        categoryOptions={categoryOptions}
        queryParams={queryParams}
        onSearch={handleSearch}
        onFilter={handleFilter}
        onPageChange={handlePageChange}
        isLoading={isLoading}
      />
    </div>
  );
}
