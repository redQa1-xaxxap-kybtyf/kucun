'use client';

/**
 * 供应商搜索和筛选组件
 * 严格遵循全栈项目统一约定规范
 * 参考：components/categories/category-search-filters.tsx
 */

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Card, CardContent } from '@/components/ui/card';
import { SEARCH_CONFIG } from '@/lib/config/search';

interface SupplierSearchFiltersProps {
  searchValue: string;
  statusFilter?: 'active' | 'inactive';
  onSearchChange: (value: string) => void;
  onStatusChange: (value: 'active' | 'inactive' | undefined) => void;
}

export function SupplierSearchFilters({
  searchValue,
  statusFilter,
  onSearchChange,
  onStatusChange,
}: SupplierSearchFiltersProps) {
  // 统一处理筛选器变更
  const handleFilterChange = (key: string, value: string | undefined) => {
    if (key === 'status') {
      onStatusChange(value as 'active' | 'inactive' | undefined);
    }
  };

  return (
    <Card className="shadow-md shadow-gray-200/50">
      <CardContent className="pt-6">
        <UnifiedSearchBar
          // 搜索配置
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder="搜索供应商名称、联系人或电话..."
          debounceDelay={SEARCH_CONFIG.DEBOUNCE_DELAY.DEFAULT}
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
            status: statusFilter,
          }}
          onFilterChange={handleFilterChange}
        />
      </CardContent>
    </Card>
  );
}
