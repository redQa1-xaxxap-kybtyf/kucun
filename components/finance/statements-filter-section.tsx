import { FileText } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { SearchFilterCard } from '@/components/common/search-filter-card';
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
  onClearFilters?: () => void;
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
  onClearFilters,
  isSearching = false,
}: StatementsFilterSectionProps) {
  return (
    <div className="space-y-12">
      <FilterControls
        filters={filters}
        onSearch={onSearch}
        onFilter={onFilter}
        onDateRangeChange={onDateRangeChange}
        onClearFilters={onClearFilters}
        isSearching={isSearching}
      />
      <StatementsList
        statements={statements}
        pagination={pagination}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function FilterControls({
  filters,
  onSearch,
  onFilter,
  onDateRangeChange,
  onClearFilters,
  isSearching = false,
}: {
  filters: StatementsFiltersState;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  onClearFilters?: () => void;
  isSearching?: boolean;
}) {
  const fallbackClearFilters = () => {
    onSearch?.('');
    onFilter?.('type', undefined);
    onFilter?.('sortBy', 'totalAmount');
    onDateRangeChange?.({
      startDate: undefined,
      endDate: undefined,
    });
  };

  const hasActiveFilters =
    Boolean(filters.search?.trim()) ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate) ||
    (filters.type ?? 'all') !== 'all' ||
    (filters.sortBy ?? 'totalAmount') !== 'totalAmount';

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
          筛选条件
        </h3>
        <p className="text-muted-foreground text-xs">
          手机端优先保留搜索，筛选收进抽屉；常用只需搜名称、选对象类型、看日期。
        </p>
      </div>

      <SearchFilterCard
        searchValue={filters.search || ''}
        onSearchChange={value => onSearch?.(value)}
        searchPlaceholder="搜索客户、供应商、联系人或编号"
        isSearching={isSearching}
        filters={[
          {
            key: 'type',
            label: '对象',
            options: [
              { label: '仅客户', value: 'customer' },
              { label: '仅供应商', value: 'supplier' },
              { label: '其他往来单位', value: 'partner' },
            ],
            width: 'w-[150px]',
          },
          {
            key: 'sortBy',
            label: '排序',
            options: [
              { label: '按累计金额', value: 'totalAmount' },
              { label: '按当前余额', value: 'pendingAmount' },
              { label: '按业务笔数', value: 'totalOrders' },
            ],
            width: 'w-[160px]',
            includeAllOption: false,
            defaultValue: 'totalAmount',
          },
        ]}
        filterValues={{
          type: filters.type || 'all',
          sortBy: filters.sortBy || 'totalAmount',
        }}
        onFilterChange={(key, value) => {
          if (key === 'sortBy') {
            onFilter?.('sortBy', value || 'totalAmount');
            return;
          }

          onFilter?.(key, value);
        }}
        dateRangeFilter={{
          key: 'dateRange',
          label: '往来日期',
          value: {
            startDate: filters.startDate,
            endDate: filters.endDate,
          },
          onChange: range => onDateRangeChange?.(range),
          placeholder: '选择日期范围',
          showPresets: true,
        }}
        onClearFilters={onClearFilters ?? fallbackClearFilters}
        hasActiveFilters={hasActiveFilters}
        compact
        variant="bordered"
      />
    </div>
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
          title="暂无往来对账"
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
