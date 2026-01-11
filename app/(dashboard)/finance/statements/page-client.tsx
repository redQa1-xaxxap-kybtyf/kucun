'use client';

import { Download, FileText, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

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
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1680px] space-y-12 p-4 lg:p-10 xl:p-14 transition-all duration-500">
        
        {/* Identity Wall Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white/60 p-8 backdrop-blur-xl border border-white shadow-sm transition-all duration-500 hover:shadow-xl">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-50/50 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-50/30 blur-3xl" />
          
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-2xl transition-transform hover:scale-110 duration-500">
                <FileText className="h-10 w-10" />
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-4xl font-black tracking-tighter text-slate-900">
                    往来账单
                  </h1>
                  <div className="text-xs uppercase font-bold tracking-wider px-4 py-1.5 rounded-full bg-purple-600 text-white shadow-lg shadow-purple-200">
                    Audit persistence
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                      <span className="uppercase text-xs tracking-wider text-slate-500">账务中枢</span>
                      <span className="text-slate-600 font-bold">统一查看业务伙伴账本流水</span>
                    </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="lg"
                asChild
                className="h-14 rounded-2xl bg-white font-black text-slate-600 shadow-sm border-none hover:bg-slate-900 hover:text-white transition-all active:scale-95 px-8"
              >
                <Link href="/finance/statements/export">
                  <Download className="mr-2 h-5 w-5" />
                  导出数据
                </Link>
              </Button>
              <Button 
                 size="lg" 
                 asChild
                 className="h-14 rounded-2xl bg-slate-900 font-black text-white shadow-xl hover:shadow-slate-200 transition-all active:scale-95 px-10"
              >
                <Link href="/customers">
                  <Users className="mr-2 h-5 w-5" />
                  伙伴管理
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* 客户端交互组件 */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-12 w-12 animate-spin text-slate-200" />
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
            isSearching={filters.isSearching}
          />
        </Suspense>
      </div>
    </div>
  );
}
