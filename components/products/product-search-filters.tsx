'use client';

/**
 * 产品搜索和筛选组件
 * 严格遵循全栈项目统一约定规范
 * 参考客户管理页面实现
 */

import { Filter } from 'lucide-react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Category } from '@/lib/types/category';

interface ProductSearchFiltersProps {
  searchValue: string;
  categoryId?: string;
  status?: 'active' | 'inactive';
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  categories: Category[];
  onSearchChange: (value: string) => void;
  onFilterChange: (filters: {
    categoryId?: string;
    status?: 'active' | 'inactive';
  }) => void;
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  onClearFilters: () => void;
}

export function ProductSearchFilters({
  searchValue,
  categoryId,
  status,
  sortBy,
  sortOrder,
  categories,
  onSearchChange,
  onFilterChange,
  onSortChange: _onSortChange,
  onClearFilters,
}: ProductSearchFiltersProps) {
  const hasActiveFilters = categoryId || status;

  // 统一处理筛选器变更
  const handleFilterChange = (key: string, value: string | undefined) => {
    if (key === 'status') {
      onFilterChange({
        categoryId,
        status: value as 'active' | 'inactive' | undefined,
      });
    } else if (key === 'categoryId') {
      onFilterChange({ categoryId: value, status });
    } else if (key === 'sortBy') {
      // 排序字段变更，保持当前排序方向
      _onSortChange(value || 'createdAt', sortOrder);
    } else if (key === 'sortOrder') {
      // 排序方向变更，保持当前排序字段
      _onSortChange(sortBy, (value as 'asc' | 'desc') || 'desc');
    }
  };

  // 排序选项
  const sortOptions = [
    { label: '创建时间', value: 'createdAt' },
    { label: '产品编码', value: 'code' },
    { label: '产品名称', value: 'name' },
    { label: '更新时间', value: 'updatedAt' },
  ];

  // 状态选项
  const statusOptions = [
    { label: '启用', value: 'active' },
    { label: '停用', value: 'inactive' },
  ];

  return (
    <Card
      className="border border-[hsl(var(--color-border-primary))]"
      style={{ boxShadow: 'var(--shadow-light)' }}
    >
      <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
        <UnifiedSearchBar
          // 搜索配置
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder="搜索产品编码、名称或规格..."
          // 筛选器配置
          filters={[
            {
              key: 'categoryId',
              label: '产品分类',
              options: categories.map(cat => ({
                label: cat.name,
                value: cat.id,
              })),
              width: 'w-36',
            },
            {
              key: 'status',
              label: '状态',
              options: statusOptions,
              width: 'w-32',
            },
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
            categoryId: categoryId || 'all',
            status: status || 'all',
            sortBy: sortBy,
            sortOrder: sortOrder,
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
              className="h-9 transition-all hover:border-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-light))] hover:text-[hsl(var(--color-primary))]"
            >
              <Filter className="mr-2 h-4 w-4" />
              清空筛选
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
