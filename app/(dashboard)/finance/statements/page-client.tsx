'use client';

import { Download, FileText, Users } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { StatementsClient } from '@/components/finance/statements-client';
import { Button } from '@/components/ui/button';

import { useStatementsFilters } from './hooks/useStatementsFilters';

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
  // 筛选状态管理（已提取到自定义Hook）
  const { filters, handlers } = useStatementsFilters({ initialParams });

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题 */}
        <PageHeader
          title="往来账单"
          description="统一查看业务伙伴账本流水"
          icon={<FileText className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-purple))"
          actions={
            <>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/finance/statements/export">
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/customers">
                  <Users className="mr-2 h-4 w-4" />
                  客户管理
                </Link>
              </Button>
            </>
          }
        />

        {/* 客户端交互组件 */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          }
        >
          <StatementsClient
            initialData={initialData}
            initialParams={initialParams}
            filters={filters}
            onSearch={handlers.handleSearch}
            onFilter={handlers.handleFilter}
            onDateRangeChange={handlers.handleDateRangeChange}
            onPageChange={handlers.handlePageChange}
            // ✅ 新增：搜索状态指示
            isSearching={filters.isSearching}
          />
        </Suspense>
      </div>
    </div>
  );
}
