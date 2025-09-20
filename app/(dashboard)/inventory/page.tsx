'use client';

import { useQuery } from '@tanstack/react-query';
import * as React from 'react';

// UI Components
import { ERPInventoryList } from '@/components/inventory/erp-inventory-list';

// API and Types
import { categoryQueryKeys, getCategoryOptions } from '@/lib/api/categories';
import { getInventories, inventoryQueryKeys } from '@/lib/api/inventory';
import type { InventoryQueryParams } from '@/lib/types/inventory';

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

  // 获取库存列表数据
  const { data, isLoading, error } = useQuery({
    queryKey: inventoryQueryKeys.list(queryParams),
    queryFn: () => getInventories(queryParams),
  });

  // 获取分类选项数据
  const { data: categoryOptions = [] } = useQuery({
    queryKey: categoryQueryKeys.options(),
    queryFn: getCategoryOptions,
  });

  // 搜索处理
  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  // 筛选处理
  const handleFilter = (key: keyof InventoryQueryParams, value: any) => {
    setQueryParams(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // 分页处理
  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  };

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
        data={data || { data: [] }}
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
