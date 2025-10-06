'use client';

/**
 * 销售订单搜索和筛选组件
 * 严格遵循全栈项目统一约定规范
 * 参考：components/categories/category-search-filters.tsx
 */

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Card, CardContent } from '@/components/ui/card';
import {
  SALES_ORDER_STATUS_LABELS,
  type SalesOrderStatus,
} from '@/lib/types/sales-order';

interface SalesOrderSearchFiltersProps {
  searchValue: string;
  statusFilter?: SalesOrderStatus;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: SalesOrderStatus | undefined) => void;
}

export function SalesOrderSearchFilters({
  searchValue,
  statusFilter,
  onSearchChange,
  onStatusChange,
}: SalesOrderSearchFiltersProps) {
  // 状态选项
  const statusOptions = Object.entries(SALES_ORDER_STATUS_LABELS).map(
    ([value, label]) => ({
      label,
      value,
    })
  );

  // 统一处理筛选器变更
  const handleFilterChange = (key: string, value: string | undefined) => {
    if (key === 'status') {
      onStatusChange(value as SalesOrderStatus | undefined);
    }
  };

  return (
    <Card className="shadow-md shadow-gray-200/50">
      <CardContent className="pt-6">
        <UnifiedSearchBar
          // 搜索配置
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          searchPlaceholder="搜索订单号、客户名称..."
          debounceDelay={400}
          // 筛选器配置
          filters={[
            {
              key: 'status',
              label: '订单状态',
              options: statusOptions,
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
