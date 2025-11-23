import { FileText } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { SearchFilterCard } from '@/components/common/search-filter-card';
import { Card, CardContent } from '@/components/ui/card';
import type { DateRangeValue } from '@/components/ui/date-range-picker';
import { Pagination } from '@/components/ui/pagination';

import { StatementCardItem } from './statements-card-item';
import type {
  AccountStatementItem,
  StatementsFiltersState,
  StatementsPagination,
} from './statements-types';

interface StatementsFilterSectionProps {
  filters: StatementsFiltersState;
  statements: AccountStatementItem[];
  pagination: StatementsPagination;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  onPageChange?: (page: number) => void;
  /** ✅ 新增：搜索状态指示 */
  isSearching?: boolean;
}

export function StatementsFilterSection({
  filters,
  statements,
  pagination,
  onSearch,
  onFilter,
  onDateRangeChange,
  onPageChange,
  isSearching = false,
}: StatementsFilterSectionProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <FilterControls
          filters={filters}
          onSearch={onSearch}
          onFilter={onFilter}
          onDateRangeChange={onDateRangeChange}
          isSearching={isSearching}
        />
        <StatementsList
          statements={statements}
          pagination={pagination}
          onPageChange={onPageChange}
        />
      </CardContent>
    </Card>
  );
}

function FilterControls({
  filters,
  onSearch,
  onFilter,
  onDateRangeChange,
  isSearching = false,
}: {
  filters: StatementsFiltersState;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  isSearching?: boolean;
}) {
  return (
    <SearchFilterCard
      searchValue={filters.search}
      onSearchChange={value => onSearch?.(value)}
      searchPlaceholder="搜索伙伴名称..."
      isSearching={isSearching}
      // 筛选器配置
      filters={[
        {
          key: 'type',
          label: '类型',
          options: [
            { label: '客户', value: 'customer' },
            { label: '供应商', value: 'supplier' },
            { label: '往来伙伴', value: 'partner' },
          ],
          width: 'w-[140px]',
        },
        {
          key: 'sortBy',
          label: '排序',
          options: [
            { label: '总金额', value: 'totalAmount' },
            { label: '余额', value: 'pendingAmount' },
            { label: '订单数量', value: 'totalOrders' },
          ],
          width: 'w-[140px]',
        },
      ]}
      filterValues={{
        type: filters.type || 'all',
        sortBy: filters.sortBy || 'totalAmount',
      }}
      onFilterChange={(key, value) =>
        onFilter?.(key, value === 'all' ? undefined : value)
      }
      // 日期范围筛选
      dateRangeFilter={{
        key: 'dateRange',
        label: '账单日期',
        value: {
          startDate: filters.startDate,
          endDate: filters.endDate,
        },
        onChange: range => onDateRangeChange?.(range),
        placeholder: '选择账单日期范围',
      }}
      variant="default"
      compact={true}
    />
  );
}

function StatementsList({
  statements,
  pagination,
  onPageChange,
}: {
  statements: AccountStatementItem[];
  pagination: StatementsPagination;
  onPageChange?: (page: number) => void;
}) {
  if (statements.length === 0) {
    return (
      <div className="mt-6 space-y-4">
        <EmptyState
          icon={<FileText className="text-muted-foreground h-8 w-8" />}
          title="暂无往来账单"
          compact
        />
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 space-y-4">
        {statements.map(statement => (
          <StatementCardItem key={statement.id} statement={statement} />
        ))}
      </div>
      {pagination.totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            pagination={{
              page: pagination.page,
              limit: pagination.limit,
              total: pagination.total,
              totalPages: pagination.totalPages,
            }}
            onPageChange={page => onPageChange?.(page)}
          />
        </div>
      )}
    </>
  );
}
