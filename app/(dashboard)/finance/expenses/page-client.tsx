'use client';

import { Plus, Receipt } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ExpenseFilters } from '@/components/finance/expenses/expense-filters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type {
  ExpenseQueryParams,
  ExpenseStatisticsParams,
  ExpenseType,
} from '@/lib/types/expense';

const ExpenseList = dynamic(
  () =>
    import('@/components/finance/expenses/expense-list').then(
      mod => mod.ExpenseList
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        列表加载中...
      </div>
    ),
  }
);

const ExpenseStatistics = dynamic(
  () =>
    import('@/components/finance/expenses/expense-statistics').then(
      mod => mod.ExpenseStatistics
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        统计加载中...
      </div>
    ),
  }
);

interface ExpensesPageClientProps {
  hasManagePermission: boolean;
  initialParams: {
    page: number;
    pageSize: number;
    expenseType?: string;
    startDate?: string;
    endDate?: string;
    relatedType?: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    includeTest?: boolean;
    includeVoided?: boolean;
  };
}

export function ExpensesPageClient({
  initialParams,
  hasManagePermission,
}: ExpensesPageClientProps) {
  const router = useRouter();

  // 查询参数状态
  const [filters, setFilters] = React.useState<ExpenseQueryParams>({
    page: initialParams.page,
    pageSize: initialParams.pageSize,
    expenseType: initialParams.expenseType as ExpenseType | undefined,
    startDate: initialParams.startDate,
    endDate: initialParams.endDate,
    relatedType: initialParams.relatedType as
      | 'inbound'
      | 'outbound'
      | 'sales_order'
      | undefined,
    sortBy: initialParams.sortBy as
      | 'expenseDate'
      | 'expenseAmount'
      | 'createdAt',
    sortOrder: initialParams.sortOrder,
    includeTest: initialParams.includeTest,
    includeVoided: initialParams.includeVoided,
  });

  const getDefaultDateRange = React.useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  }, []);

  // ✅ P1修复: 统计参数初始化时包含 relatedType
  // 统计参数（默认最近30天）
  const [statisticsParams, setStatisticsParams] =
    React.useState<ExpenseStatisticsParams>(() => {
      const defaultRange = getDefaultDateRange();

      return {
        startDate: filters.startDate || defaultRange.startDate,
        endDate: filters.endDate || defaultRange.endDate,
        groupBy: 'type',
        expenseType: filters.expenseType,
        relatedType: filters.relatedType, // ✅ P1修复: 添加 relatedType
      };
    });

  // 更新 URL 查询参数
  const updateURL = React.useCallback(
    (newFilters: ExpenseQueryParams) => {
      const params = new URLSearchParams();

      if (newFilters.page && newFilters.page > 1) {
        params.set('page', newFilters.page.toString());
      }
      if (newFilters.pageSize && newFilters.pageSize !== 20) {
        params.set('pageSize', newFilters.pageSize.toString());
      }
      if (newFilters.expenseType) {
        params.set('expenseType', newFilters.expenseType);
      }
      if (newFilters.startDate) {
        params.set('startDate', newFilters.startDate);
      }
      if (newFilters.endDate) {
        params.set('endDate', newFilters.endDate);
      }
      if (newFilters.relatedType) {
        params.set('relatedType', newFilters.relatedType);
      }
      if (newFilters.sortBy && newFilters.sortBy !== 'expenseDate') {
        params.set('sortBy', newFilters.sortBy);
      }
      if (newFilters.sortOrder && newFilters.sortOrder !== 'desc') {
        params.set('sortOrder', newFilters.sortOrder);
      }
      if (newFilters.includeTest) {
        params.set('includeTest', 'true');
      }
      if (newFilters.includeVoided) {
        params.set('includeVoided', 'true');
      }

      const queryString = params.toString();
      router.push(`/finance/expenses${queryString ? `?${queryString}` : ''}`, {
        scroll: false,
      });
    },
    [router]
  );

  // 处理筛选变化
  const handleFilterChange = React.useCallback(
    (newFilters: Partial<ExpenseQueryParams>) => {
      const updatedFilters = {
        ...filters,
        ...newFilters,
        page: 1, // 重置到第一页
      };

      setFilters(updatedFilters);
      updateURL(updatedFilters);

      // ✅ P1修复: 同时更新统计参数，包括 relatedType
      const shouldUpdateDates =
        Object.prototype.hasOwnProperty.call(newFilters, 'startDate') ||
        Object.prototype.hasOwnProperty.call(newFilters, 'endDate');
      const shouldUpdateType = Object.prototype.hasOwnProperty.call(
        newFilters,
        'expenseType'
      );
      // ✅ P1修复: 添加 relatedType 变化检测
      const shouldUpdateRelatedType = Object.prototype.hasOwnProperty.call(
        newFilters,
        'relatedType'
      );

      if (shouldUpdateDates || shouldUpdateType || shouldUpdateRelatedType) {
        const defaultRange = getDefaultDateRange();
        setStatisticsParams(prev => {
          const next = { ...prev };

          if (shouldUpdateDates) {
            const hasStartDate = Object.prototype.hasOwnProperty.call(
              newFilters,
              'startDate'
            );
            const hasEndDate = Object.prototype.hasOwnProperty.call(
              newFilters,
              'endDate'
            );

            if (hasStartDate) {
              next.startDate = newFilters.startDate ?? defaultRange.startDate;
            }

            if (hasEndDate) {
              next.endDate = newFilters.endDate ?? defaultRange.endDate;
            }

            if (
              hasStartDate &&
              hasEndDate &&
              newFilters.startDate === undefined &&
              newFilters.endDate === undefined
            ) {
              next.startDate = defaultRange.startDate;
              next.endDate = defaultRange.endDate;
            }
          }

          if (shouldUpdateType) {
            next.expenseType = newFilters.expenseType as
              | ExpenseType
              | undefined;
          }

          // ✅ P1修复: 同步 relatedType 到统计参数
          if (shouldUpdateRelatedType) {
            next.relatedType = newFilters.relatedType as
              | 'inbound'
              | 'outbound'
              | 'sales_order'
              | undefined;
          }

          return next;
        });
      }
    },
    [filters, getDefaultDateRange, updateURL]
  );

  // 处理分页变化
  const handlePageChange = React.useCallback(
    (page: number) => {
      const updatedFilters = { ...filters, page };
      setFilters(updatedFilters);
      updateURL(updatedFilters);
    },
    [filters, updateURL]
  );

  // 处理排序变化
  const handleSortChange = React.useCallback(
    (sortBy: string, sortOrder: 'asc' | 'desc') => {
      const updatedFilters = {
        ...filters,
        sortBy: sortBy as 'expenseDate' | 'expenseAmount' | 'createdAt',
        sortOrder,
      };
      setFilters(updatedFilters);
      updateURL(updatedFilters);
    },
    [filters, updateURL]
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* 页面标题卡片 - v3 PRO 旗舰玻璃拟态 */}
        <Card className="relative overflow-hidden border-none bg-slate-900 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
          {/* 装饰性光斑 */}
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

          <CardContent className="relative z-10 p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_10px_20px_rgba(37,99,235,0.3)]">
                  <Receipt className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                    费用支出流水{' '}
                    <span className="ml-2 text-xs font-normal tracking-widest uppercase opacity-40 sm:text-sm">
                      费用开支明细台账
                    </span>
                  </h1>
                  <p className="mt-1 text-sm font-medium text-slate-400">
                    智能财务开支监控 · 业务关联穿透审计
                  </p>
                </div>
              </div>
              {hasManagePermission && (
                <Button
                  size="lg"
                  asChild
                  className="h-12 border-none bg-blue-600 px-8 text-white shadow-[0_10px_20px_rgba(37,99,235,0.2)] transition-all hover:scale-105 hover:bg-blue-500 sm:text-sm"
                >
                  <Link href="/finance/expenses/create">
                    <Plus className="mr-2 h-5 w-5" />
                    新增费用记录
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 统计卡片 */}
        <ExpenseStatistics params={statisticsParams} />

        {/* 筛选器 */}
        <Card>
          <CardContent className="pt-6">
            <ExpenseFilters
              filters={filters}
              onFilterChange={handleFilterChange}
            />
          </CardContent>
        </Card>

        {/* 费用记录列表 */}
        <ExpenseList
          filters={filters}
          onPageChange={handlePageChange}
          onSortChange={handleSortChange}
          hasManagePermission={hasManagePermission}
        />
      </div>
    </div>
  );
}
