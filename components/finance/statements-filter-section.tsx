import { Calendar, FileText, Search, SlidersHorizontal } from 'lucide-react';

import { EmptyState } from '@/components/common/empty-state';
import { DateRangePicker, type DateRangeValue } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <div className="flex flex-col gap-4">
      {/* Search & Main Filters Layer */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* Search Input */}
        <div className="relative flex-1 group">
          <Input
            placeholder="搜索伙伴名称、编号或联系方式..."
            value={filters.search || ''}
            onChange={e => onSearch?.(e.target.value)}
            className="h-14 rounded-2xl border-white bg-white/60 pl-12 font-bold shadow-sm backdrop-blur-md transition-all focus:bg-white focus:ring-2 focus:ring-purple-500/20 group-hover:shadow-md"
          />
          <Search className={cn(
            "absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 transition-colors",
            isSearching ? "text-purple-500" : "text-slate-300 group-hover:text-purple-500"
          )} />
        </div>

        {/* Type Filter */}
        <Select
          value={filters.type || 'all'}
          onValueChange={value => onFilter?.('type', value === 'all' ? undefined : value)}
        >
          <SelectTrigger className="h-14 w-full rounded-2xl border-white bg-white/60 font-bold shadow-sm backdrop-blur-md transition-all hover:bg-white sm:w-[200px] lg:w-[180px]">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-400" />
              <SelectValue placeholder="类型" />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-none shadow-2xl">
            <SelectItem value="all" className="rounded-xl font-bold">全部类型</SelectItem>
            <SelectItem value="customer" className="rounded-xl font-bold">仅客户</SelectItem>
            <SelectItem value="supplier" className="rounded-xl font-bold">仅供应商</SelectItem>
            <SelectItem value="partner" className="rounded-xl font-bold">仅往来伙伴</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort By Filter */}
        <Select
          value={filters.sortBy || 'totalAmount'}
          onValueChange={value => onFilter?.('sortBy', value)}
        >
          <SelectTrigger className="h-14 w-full rounded-2xl border-white bg-white/60 font-bold shadow-sm backdrop-blur-md transition-all hover:bg-white sm:w-[200px] lg:w-[180px]">
            <SelectValue placeholder="排序方式" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-none shadow-2xl">
            <SelectItem value="totalAmount" className="rounded-xl font-bold">按总金额</SelectItem>
            <SelectItem value="pendingAmount" className="rounded-xl font-bold text-rose-600">按欠款余额</SelectItem>
            <SelectItem value="totalOrders" className="rounded-xl font-bold">按订单量</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range Picker Area */}
        <div className="flex-none lg:w-[320px]">
          <div className="relative rounded-2xl border border-white bg-white/60 px-4 py-1.5 backdrop-blur-md shadow-sm transition-all hover:bg-white hover:shadow-md">
             <DateRangePicker
               value={{
                 startDate: filters.startDate,
                 endDate: filters.endDate,
               }}
               onChange={range => onDateRangeChange?.(range)}
               label=""
               placeholder="账单时段"
               showPresets={true}
               showClearButton={false}
               className="border-none bg-transparent shadow-none"
             />
             <Calendar className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
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
