'use client';

/**
 * 分类搜索和筛选组件
 * 严格遵循全栈项目统一约定规范
 */

import { Search } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索分类名称..."
                value={queryParams.search}
                onChange={e => onSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Select
              value={queryParams.status || 'all'}
              onValueChange={value => {
                const statusValue =
                  value === 'all'
                    ? undefined
                    : (value as 'active' | 'inactive');
                onFilter('status', statusValue);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="active">启用</SelectItem>
                <SelectItem value="inactive">禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
