'use client';

/**
 * 分类搜索和筛选组件
 * 使用统一的 SearchFilterCard 组件
 */

import { SearchFilterCard } from '@/components/common/search-filter-card';
import type { CategoryQueryParams } from '@/lib/api/categories';

interface CategorySearchFiltersProps {
  queryParams: CategoryQueryParams;
  searchValue?: string;
  isSearching?: boolean;
  onSearchChange?: (value: string) => void;
  onSearch: (value: string) => void;
  onFilter: <K extends keyof CategoryQueryParams>(
    key: K,
    value: CategoryQueryParams[K]
  ) => void;
}

export function CategorySearchFilters({
  queryParams,
  searchValue,
  isSearching = false,
  onSearchChange,
  onSearch,
  onFilter,
}: CategorySearchFiltersProps) {
  // 统一处理筛选器变更
  const handleFilterChange = (key: string, value: string | undefined) => {
    if (key === 'status') {
      onFilter('status', value as 'active' | 'inactive' | undefined);
    }
  };

  return (
    <SearchFilterCard
      searchValue={searchValue ?? (queryParams.search || '')}
      onSearchChange={onSearchChange ?? onSearch}
      searchPlaceholder="搜索分类名称、编码"
      isSearching={isSearching}
      // 筛选器配置
      filters={[
        {
          key: 'status',
          label: '分类状态',
          options: [
            { label: '启用', value: 'active' },
            { label: '禁用', value: 'inactive' },
          ],
          width: 'w-32',
        },
      ]}
      filterValues={{
        status: queryParams.status || 'all',
      }}
      onFilterChange={handleFilterChange}
      variant="pro"
      compact={true}
    />
  );
}
