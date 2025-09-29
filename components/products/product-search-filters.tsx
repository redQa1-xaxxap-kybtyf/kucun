'use client';

import { Filter, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PRODUCT_STATUS_OPTIONS,
  PRODUCT_UNIT_OPTIONS,
  type ProductStatus,
  type ProductUnit,
} from '@/lib/config/product';

interface Category {
  id: string;
  name: string;
  code: string;
}

interface ProductSearchFiltersProps {
  searchValue: string;
  statusFilter?: string;
  unitFilter?: string;
  categoryFilter?: string;
  categories: Category[];
  isLoadingCategories: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ProductStatus | undefined) => void;
  onUnitChange: (value: ProductUnit | undefined) => void;
  onCategoryChange: (value: string | undefined) => void;
  onClearFilters: () => void;
}

export function ProductSearchFilters({
  searchValue,
  statusFilter,
  unitFilter,
  categoryFilter,
  categories,
  isLoadingCategories,
  onSearchChange,
  onStatusChange,
  onUnitChange,
  onCategoryChange,
  onClearFilters,
}: ProductSearchFiltersProps) {
  const hasActiveFilters = statusFilter || unitFilter || categoryFilter;

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜索产品编码、名称或规格..."
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* 筛选器 */}
      <div className="flex flex-wrap gap-4">
        {/* 状态筛选 */}
        <Select
          value={statusFilter || ''}
          onValueChange={value =>
            onStatusChange(
              value === 'all' ? undefined : (value as ProductStatus)
            )
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {PRODUCT_STATUS_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 单位筛选 */}
        <Select
          value={unitFilter || ''}
          onValueChange={value =>
            onUnitChange(value === 'all' ? undefined : (value as ProductUnit))
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="单位" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部单位</SelectItem>
            {PRODUCT_UNIT_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 分类筛选 */}
        <Select
          value={categoryFilter || ''}
          onValueChange={value =>
            onCategoryChange(value === 'all' ? undefined : value)
          }
          disabled={isLoadingCategories}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {categories.map(category => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 清空筛选按钮 */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="h-10"
          >
            <Filter className="mr-2 h-4 w-4" />
            清空筛选
          </Button>
        )}
      </div>
    </div>
  );
}
