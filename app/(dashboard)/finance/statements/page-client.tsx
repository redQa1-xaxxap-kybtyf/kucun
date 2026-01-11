'use client';

import { Download, FileText, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { StatementsClient } from '@/components/finance/statements-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
        
        {/* 页面标题卡片 - v3 PRO 旗舰玻璃拟态对齐 */}
        <Card className="relative overflow-hidden border-none bg-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-[2.5rem]">
          {/* 装饰性极光光斑 */}
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl animate-pulse" />
          <div className="absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
          
          <CardContent className="relative z-10 p-8 lg:p-10">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-[0_15px_30px_rgba(0,0,0,0.3)] border border-slate-700/50 transition-transform hover:rotate-3 duration-500">
                  <FileText className="h-10 w-10 text-blue-400" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-black tracking-tighter text-white sm:text-4xl">
                      应收应付总账 <span className="ml-2 text-xs font-normal opacity-40 sm:text-sm uppercase tracking-widest">客户供应商往来汇总</span>
                    </h1>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-400 max-w-md">
                    集中化管理全球业务伙伴的应收与应付数据，实时监控财务水位，确保每一笔往来清晰透彻。
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="lg"
                  asChild
                  className="h-14 rounded-2xl bg-slate-800/50 border border-slate-700/50 font-black text-slate-200 shadow-xl backdrop-blur-md hover:bg-slate-700 hover:text-white transition-all active:scale-95 px-8"
                >
                  <Link href="/finance/statements/export">
                    <Download className="mr-2 h-5 w-5" />
                    安全导出
                  </Link>
                </Button>
                <Button 
                   size="lg" 
                   asChild
                   className="h-14 rounded-2xl bg-blue-600 font-black text-white shadow-[0_10px_25px_rgba(37,99,235,0.3)] hover:bg-blue-500 hover:shadow-blue-400/20 transition-all active:scale-95 px-10"
                >
                  <Link href="/customers">
                    <Users className="mr-2 h-5 w-5" />
                    伙伴档案
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
