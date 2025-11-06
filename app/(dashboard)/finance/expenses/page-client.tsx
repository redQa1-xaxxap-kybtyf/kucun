'use client';

import { Plus, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { ExpenseFilters } from '@/components/finance/expenses/expense-filters';
import { ExpenseList } from '@/components/finance/expenses/expense-list';
import { ExpenseStatistics } from '@/components/finance/expenses/expense-statistics';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { can } from '@/lib/auth/permissions';
import type {
  ExpenseQueryParams,
  ExpenseStatisticsParams,
  ExpenseType,
} from '@/lib/types/expense';

interface ExpensesPageClientProps {
  initialParams: {
    page: number;
    pageSize: number;
    expenseType?: string;
    startDate?: string;
    endDate?: string;
    relatedType?: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
}

export function ExpensesPageClient({ initialParams }: ExpensesPageClientProps) {
  const router = useRouter();
  const { data: session } = useSession();

  // 权限检查
  const hasManagePermission = React.useMemo(
    () => can(session?.user ?? null, 'finance:manage'),
    [session?.user]
  );

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

  // 统计参数（默认最近30天）
  const [statisticsParams, setStatisticsParams] =
    React.useState<ExpenseStatisticsParams>(() => {
      const defaultRange = getDefaultDateRange();

      return {
        startDate: filters.startDate || defaultRange.startDate,
        endDate: filters.endDate || defaultRange.endDate,
        groupBy: 'type',
        expenseType: filters.expenseType,
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

      // 同时更新统计参数
      const shouldUpdateDates =
        Object.prototype.hasOwnProperty.call(newFilters, 'startDate') ||
        Object.prototype.hasOwnProperty.call(newFilters, 'endDate');
      const shouldUpdateType = Object.prototype.hasOwnProperty.call(
        newFilters,
        'expenseType'
      );

      if (shouldUpdateDates || shouldUpdateType) {
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
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                  <Receipt className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    费用记录
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    管理各类费用记录，跟踪费用支出情况
                  </p>
                </div>
              </div>
              {hasManagePermission && (
                <Button
                  size="lg"
                  asChild
                  className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                >
                  <Link href="/finance/expenses/create">
                    <Plus className="mr-2 h-4 w-4" />
                    新增费用
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
