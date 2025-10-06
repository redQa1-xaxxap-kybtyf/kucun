'use client';

/**
 * 客户搜索和筛选组件
 * 严格遵循全栈项目统一约定规范
 * 参考：components/categories/category-search-filters.tsx
 */

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Card, CardContent } from '@/components/ui/card';

interface CustomerSearchFiltersProps {
  searchValue: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSearchChange: (value: string) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
}

export function CustomerSearchFilters({
  searchValue,
  sortBy,
  sortOrder,
  onSearchChange,
  onSortChange,
}: CustomerSearchFiltersProps) {
  // 排序选项
  const sortOptions = [
    { label: '创建时间', value: 'createdAt' },
    { label: '客户名称', value: 'name' },
    { label: '订单总额', value: 'totalAmount' },
    { label: '订单数量', value: 'totalOrders' },
    { label: '合作天数', value: 'cooperationDays' },
  ];

  // 统一处理筛选器变更
  const handleFilterChange = (key: string, value: string | undefined) => {
    if (key === 'sortBy' && value) {
      onSortChange(value, sortOrder);
    } else if (key === 'sortOrder' && value) {
      onSortChange(sortBy, value as 'asc' | 'desc');
    }
  };

  return (
    <Card className="shadow-md shadow-gray-200/50">
      <CardContent className="pt-6">
        <UnifiedSearchBar
          // 搜索配置
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder="搜索客户名称、电话或地址..."
          debounceDelay={400}
          // 筛选器配置
          filters={[
            {
              key: 'sortBy',
              label: '排序字段',
              options: sortOptions,
              width: 'w-36',
            },
            {
              key: 'sortOrder',
              label: '排序方式',
              options: [
                { label: '升序', value: 'asc' },
                { label: '降序', value: 'desc' },
              ],
              width: 'w-28',
            },
          ]}
          filterValues={{
            sortBy: sortBy,
            sortOrder: sortOrder,
          }}
          onFilterChange={handleFilterChange}
        />
      </CardContent>
    </Card>
  );
}
