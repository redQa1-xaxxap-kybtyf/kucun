'use client';

/**
 * 分类搜索和筛选组件
 * 严格遵循全栈项目统一约定规范
 * ✅ 已迁移到使用 UnifiedSearchBar
 */

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Card, CardContent } from '@/components/ui/card';
import type { CategoryQueryParams } from '@/lib/api/categories';

interface CategorySearchFiltersProps {
  queryParams: CategoryQueryParams;
  onSearch: (value: string) => void;
  onFilter: <K extends keyof CategoryQueryParams>(
    key: K,
    value: CategoryQueryParams[K]
  ) => void;
}

export function CategorySearchFilters({
  queryParams,
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
    <Card className="shadow-md shadow-gray-200/50">
      <CardContent className="pt-6">
        <UnifiedSearchBar
          // 搜索配置
          searchValue={queryParams.search || ''}
          onSearchChange={onSearch}
          searchPlaceholder="搜索分类名称..."
          debounceDelay={400}
          // 筛选器配置
          filters={[
            {
              key: 'status',
              label: '状态',
              options: [
                { label: '启用', value: 'active' },
                { label: '禁用', value: 'inactive' },
              ],
              width: 'w-32',
            },
          ]}
          filterValues={{
            status: queryParams.status,
          }}
          onFilterChange={handleFilterChange}
        />
      </CardContent>
    </Card>
  );
}
