'use client';

import { FileText, Loader2, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import type { StatementsClientProps } from '@/components/finance/statements-client';
import { Button } from '@/components/ui/button';

import { useStatementsFilters } from './hooks/useStatementsFilters';

const StatementsClient = dynamic<StatementsClientProps>(
  () =>
    import('@/components/finance/statements-client').then(
      mod => mod.StatementsClient
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-12 w-12 animate-spin text-slate-200" />
      </div>
    ),
  }
);

interface AccountStatement {
  id: string;
  name: string;
  type: 'customer' | 'supplier' | 'partner';
  partnerRole: 'customer' | 'supplier' | 'both';
  status: 'active' | 'settled' | 'suspended';
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  currentBalance: number;
  lastTransactionDate: string | null;
  lastPaymentDate: string | null;
}

interface StatementsQueryParams {
  page: number;
  limit: number;
  search?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

interface StatementsPageClientProps {
  initialData: {
    statements: AccountStatement[];
    summary: {
      totalReceivable: number;
      totalPayable: number;
      totalCustomers: number;
      totalSuppliers: number;
    };
    pagination: {
      page: number;
      limit: number;
      pageSize?: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams: StatementsQueryParams;
}

/**
 * 往来账单页面客户端组件
 * 职责：渲染页面布局和协调子组件
 */
export function StatementsPageClient({
  initialData,
  initialParams,
}: StatementsPageClientProps) {
  const { filters, handlers } = useStatementsFilters({ initialParams });

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <PageHeader
          title="往来对账"
          description="查看客户和供应商往来余额。"
          icon={<FileText className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-primary))"
          actions={
            <>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)]"
              >
                <Link href="/finance/customer-statements">
                  <FileText className="mr-2 h-4 w-4" />
                  客户往来明细
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)]"
              >
                <Link href="/customers">
                  <Users className="mr-2 h-4 w-4" />
                  客户资料
                </Link>
              </Button>
            </>
          }
        />

        <StatementsClient
          initialData={initialData}
          initialParams={initialParams}
          filters={filters}
          onSearch={handlers.handleSearch}
          onFilter={handlers.handleFilter}
          onDateRangeChange={handlers.handleDateRangeChange}
          onPageChange={handlers.handlePageChange}
          onClearFilters={handlers.handleClearFilters}
          isSearching={filters.isSearching}
        />
      </div>
    </div>
  );
}
