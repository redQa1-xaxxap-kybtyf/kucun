import { FileText } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Card, CardContent } from '@/components/ui/card';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
import { Pagination } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <FilterControls
            filters={filters}
            onSearch={onSearch}
            onFilter={onFilter}
            onDateRangeChange={onDateRangeChange}
            isSearching={isSearching}
            statements={statements}
            pagination={pagination}
          />
        </div>
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
  statements,
  pagination,
}: {
  filters: StatementsFiltersState;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: DateRangeValue) => void;
  isSearching?: boolean;
  statements: AccountStatementItem[];
  pagination: StatementsPagination;
}) {
  return (
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <UnifiedSearchBar
        searchValue={filters.search}
        onSearchChange={value => onSearch?.(value)}
        searchPlaceholder="搜索伙伴名称..."
        className="max-w-sm"
        // ✅ 新增：搜索状态指示
        isSearching={isSearching}
        resultCount={statements.length}
        totalCount={pagination.total}
      />

      <Select
        value={filters.type || 'all'}
        onValueChange={value =>
          onFilter?.('type', value === 'all' ? undefined : value)
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="类型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          <SelectItem value="customer">客户</SelectItem>
          <SelectItem value="supplier">供应商</SelectItem>
          <SelectItem value="partner">往来伙伴</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.sortBy || 'totalAmount'}
        onValueChange={value => onFilter?.('sortBy', value)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="排序" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="totalAmount">总金额</SelectItem>
          <SelectItem value="pendingAmount">余额</SelectItem>
          <SelectItem value="totalOrders">订单数量</SelectItem>
        </SelectContent>
      </Select>

      <DateRangePicker
        value={{
          startDate: filters.startDate,
          endDate: filters.endDate,
        }}
        onChange={range => onDateRangeChange?.(range)}
        label=""
        placeholder="选择账单日期范围"
        showPresets
        showClearButton
        className="w-full min-w-[220px] sm:w-auto"
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
