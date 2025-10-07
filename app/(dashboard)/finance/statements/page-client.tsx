'use client';

import { Download, FileText, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Suspense } from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { StatementsClient } from '@/components/finance/statements-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface AccountStatement {
  id: string;
  entityId: string;
  entityName: string;
  entityType: string;
  totalOrders: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  creditLimit: number;
  paymentTerms: string;
  lastTransactionDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StatementsQueryParams {
  page: number;
  limit: number;
  search?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface StatementsPageClientProps {
  initialData: {
    statements: AccountStatement[];
    statistics: {
      totalReceivable: number;
      totalPayable: number;
      totalCustomers: number;
      totalSuppliers: number;
    };
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams: StatementsQueryParams;
}

/**
 * 往来账单页面客户端组件
 * 负责用户交互和状态管理
 */
export function StatementsPageClient({
  initialData,
  initialParams,
}: StatementsPageClientProps) {
  const router = useRouter();
  const [_isPending, startTransition] = React.useTransition();

  // 本地状态管理 - 用于即时更新UI
  const [search, setSearch] = React.useState(initialParams.search || '');
  const [type, setType] = React.useState(initialParams.type || 'customer');
  const [sortBy, setSortBy] = React.useState(
    initialParams.sortBy || 'totalAmount'
  );
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );

  // 防抖更新URL - 避免每次输入都触发导航
  const debouncedUpdateURL = useDebouncedCallback(
    (searchValue: string, filters: StatementsQueryParams) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) {
          params.set('search', searchValue);
        }
        if (filters.type) {
          params.set('type', filters.type);
        }
        if (filters.sortBy) {
          params.set('sortBy', filters.sortBy);
        }
        if (filters.sortOrder) {
          params.set('sortOrder', filters.sortOrder);
        }
        if (filters.page && filters.page > 1) {
          params.set('page', filters.page.toString());
        }
        if (filters.limit) {
          params.set('limit', filters.limit.toString());
        }

        router.push(`/finance/statements?${params.toString()}`);
      });
    },
    300
  );

  // 搜索处理 - 立即更新本地状态，防抖更新URL
  const handleSearch = React.useCallback(
    (value: string) => {
      setSearch(value);
      debouncedUpdateURL(value, {
        ...initialParams,
        search: value,
        type,
        sortBy,
        sortOrder,
        page: 1,
      });
    },
    [debouncedUpdateURL, initialParams, type, sortBy, sortOrder]
  );

  // 筛选处理
  const handleFilter = React.useCallback(
    (key: string, value: string | undefined) => {
      const newFilters = { ...initialParams, [key]: value, page: 1 };

      if (key === 'type') {
        setType(value || 'customer');
      } else if (key === 'sortBy') {
        setSortBy(value || 'totalAmount');
      } else if (key === 'sortOrder') {
        setSortOrder((value as 'asc' | 'desc') || 'desc');
      }

      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (newFilters.type) {
          params.set('type', newFilters.type);
        }
        if (newFilters.sortBy) {
          params.set('sortBy', newFilters.sortBy);
        }
        if (newFilters.sortOrder) {
          params.set('sortOrder', newFilters.sortOrder);
        }
        if (newFilters.limit) {
          params.set('limit', newFilters.limit.toString());
        }

        router.push(`/finance/statements?${params.toString()}`);
      });
    },
    [router, search, initialParams]
  );

  // 分页处理
  const handlePageChange = React.useCallback(
    (page: number) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (search) {
          params.set('search', search);
        }
        if (type) {
          params.set('type', type);
        }
        if (sortBy) {
          params.set('sortBy', sortBy);
        }
        if (sortOrder) {
          params.set('sortOrder', sortOrder);
        }
        if (page > 1) {
          params.set('page', page.toString());
        }
        if (initialParams.limit) {
          params.set('limit', initialParams.limit.toString());
        }

        router.push(`/finance/statements?${params.toString()}`);
      });
    },
    [router, search, type, sortBy, sortOrder, initialParams.limit]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600 shadow-lg shadow-purple-600/30">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    往来账单
                  </h1>
                  <p className="text-sm text-gray-600">
                    管理客户和供应商的综合账务往来
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <Link href="/finance/statements/export">
                    <Download className="mr-2 h-4 w-4" />
                    导出
                  </Link>
                </Button>
                <Button
                  size="lg"
                  asChild
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <Link href="/customers">
                    <Users className="mr-2 h-4 w-4" />
                    客户管理
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
            onSearch={handleSearch}
            onFilter={handleFilter}
            onPageChange={handlePageChange}
          />
        </Suspense>
      </div>
    </div>
  );
}
