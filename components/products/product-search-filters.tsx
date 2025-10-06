'use client';

/**
 * 产品搜索和筛选组件
 * ✅ 已迁移到使用 UnifiedSearchBar
 */

import { Filter } from 'lucide-react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Button } from '@/components/ui/button';
import {
  PRODUCT_STATUS_OPTIONS,
  type ProductStatus,
} from '@/lib/config/product';
import { SEARCH_CONFIG } from '@/lib/config/search';

interface Category {
  id: string;
  name: string;
  code: string;
}

interface ProductSearchFiltersProps {
  searchValue: string;
  statusFilter?: string;
  categoryFilter?: string;
  categories: Category[];
  isLoadingCategories: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ProductStatus | undefined) => void;
  onCategoryChange: (value: string | undefined) => void;
  onClearFilters: () => void;
}

export function ProductSearchFilters({
  searchValue,
  statusFilter,
  categoryFilter,
  categories,
  isLoadingCategories: _isLoadingCategories,
  onSearchChange,
  onStatusChange,
  onCategoryChange,
  onClearFilters,
}: ProductSearchFiltersProps) {
  const hasActiveFilters = statusFilter || categoryFilter;

  // 统一处理筛选器变更
  const handleFilterChange = (key: string, value: string | undefined) => {
    if (key === 'status') {
      onStatusChange(value as ProductStatus | undefined);
    } else if (key === 'category') {
      onCategoryChange(value);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4 shadow-md shadow-gray-200/50">
        <UnifiedSearchBar
          // 搜索配置
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder="搜索产品编码、名称或规格..."
          debounceDelay={SEARCH_CONFIG.DEBOUNCE_DELAY.DEFAULT}
          // 筛选器配置
          filters={[
            {
              key: 'status',
              label: '状态',
              options: PRODUCT_STATUS_OPTIONS.map(opt => ({
                label: opt.label,
                value: opt.value,
              })),
              width: 'w-[140px]',
            },
            {
              key: 'category',
              label: '分类',
              options: categories.map(cat => ({
                label: cat.name,
                value: cat.id,
              })),
              width: 'w-[140px]',
            },
          ]}
          filterValues={{
            status: statusFilter,
            category: categoryFilter,
          }}
          onFilterChange={handleFilterChange}
        />

        {/* 清空筛选按钮 */}
        {hasActiveFilters && (
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="h-9 transition-all hover:border-blue-300 hover:bg-blue-50"
            >
              <Filter className="mr-2 h-4 w-4" />
              清空筛选
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
