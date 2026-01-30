import {
  ArrowUpDown,
  Calendar,
  FileText,
  Search,
  SlidersHorizontal,
} from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

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
    <div className="space-y-12">
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
    </div>
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
    <div className="flex flex-col gap-6">
      {/* Search & Main Filters Layer */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* Search Input */}
        <div className="group relative flex-1">
          <Input
            placeholder="输入伙伴名称、编号、联系方式或经营范围关键词..."
            value={filters.search || ''}
            onChange={e => onSearch?.(e.target.value)}
            className="h-14 rounded-2xl border-none bg-white pl-12 font-bold shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all group-hover:shadow-md focus:ring-2 focus:ring-blue-500/10"
          />
          <Search
            className={cn(
              'absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 transition-colors',
              isSearching
                ? 'text-blue-500'
                : 'text-slate-300 group-hover:text-blue-500'
            )}
          />
        </div>

        {/* Type Filter */}
        <div className="relative w-full sm:w-[200px] lg:w-[180px]">
          <SlidersHorizontal className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={filters.type || 'all'}
            onChange={e =>
              onFilter?.(
                'type',
                e.target.value === 'all' ? undefined : e.target.value
              )
            }
            className="h-14 w-full rounded-2xl border-none bg-white pr-10 pl-11 text-sm font-black shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all hover:shadow-md focus:ring-2 focus:ring-blue-500/10 focus:outline-hidden"
            aria-label="伙伴类型"
          >
            <option value="all">全部伙伴类型</option>
            <option value="customer">战略合作客户</option>
            <option value="supplier">核心供应厂家</option>
            <option value="partner">其他往来单位</option>
          </select>
        </div>

        {/* Sort By Filter */}
        <div className="relative w-full sm:w-[200px] lg:w-[180px]">
          <ArrowUpDown className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={filters.sortBy || 'totalAmount'}
            onChange={e => onFilter?.('sortBy', e.target.value)}
            className="h-14 w-full rounded-2xl border-none bg-white pr-10 pl-11 text-sm font-black shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all hover:shadow-md focus:ring-2 focus:ring-blue-500/10 focus:outline-hidden"
            aria-label="排序准则"
          >
            <option value="totalAmount">按累计流水金额</option>
            <option value="pendingAmount">按当前欠款余额</option>
            <option value="totalOrders">按对账单项总数</option>
          </select>
        </div>

        {/* Date Range Picker Area */}
        <div className="flex-none lg:w-[320px]">
          <div className="relative rounded-2xl border-none bg-white px-4 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all hover:shadow-md">
            <DateRangePicker
              value={{
                startDate: filters.startDate,
                endDate: filters.endDate,
              }}
              onChange={range => onDateRangeChange?.(range)}
              label=""
              placeholder="账单审计时段"
              showPresets={true}
              showClearButton={false}
              className="border-none bg-transparent shadow-none"
            />
            <Calendar className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-slate-300" />
          </div>
        </div>
      </div>
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
