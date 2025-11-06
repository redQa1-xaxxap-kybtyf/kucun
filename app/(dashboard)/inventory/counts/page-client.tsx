'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { CountFilters } from '@/components/inventory/counts/count-filters';
import { CountList } from '@/components/inventory/counts/count-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { can } from '@/lib/auth/permissions';
import type {
  CountStatus,
  CountType,
  InventoryCountQueryParams,
} from '@/lib/types/inventory-count';

interface CountsPageClientProps {
  initialParams: {
    page: number;
    pageSize: number;
    status?: string;
    countType?: string;
    location?: string;
    categoryId?: string;
    startDate?: string;
    endDate?: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
}

export function CountsPageClient({ initialParams }: CountsPageClientProps) {
  const router = useRouter();
  const { data: session } = useSession();

  // 权限检查
  const hasManagePermission = React.useMemo(
    () => can(session?.user ?? null, 'inventory:manage'),
    [session?.user]
  );

  // 查询参数状态
  const [filters, setFilters] = React.useState<InventoryCountQueryParams>({
    page: initialParams.page,
    pageSize: initialParams.pageSize,
    status: initialParams.status as CountStatus | undefined,
    countType: initialParams.countType as CountType | undefined,
    location: initialParams.location,
    categoryId: initialParams.categoryId,
    startDate: initialParams.startDate,
    endDate: initialParams.endDate,
    sortBy: initialParams.sortBy as 'planDate' | 'createdAt',
    sortOrder: initialParams.sortOrder,
  });

  // 更新 URL 查询参数
  const updateURL = React.useCallback(
    (newFilters: InventoryCountQueryParams) => {
      const params = new URLSearchParams();

      if (newFilters.page && newFilters.page > 1) {
        params.set('page', newFilters.page.toString());
      }
      if (newFilters.pageSize && newFilters.pageSize !== 20) {
        params.set('pageSize', newFilters.pageSize.toString());
      }
      if (newFilters.status) {
        params.set('status', newFilters.status);
      }
      if (newFilters.countType) {
        params.set('countType', newFilters.countType);
      }
      if (newFilters.location) {
        params.set('location', newFilters.location);
      }
      if (newFilters.categoryId) {
        params.set('categoryId', newFilters.categoryId);
      }
      if (newFilters.startDate) {
        params.set('startDate', newFilters.startDate);
      }
      if (newFilters.endDate) {
        params.set('endDate', newFilters.endDate);
      }
      if (newFilters.sortBy && newFilters.sortBy !== 'planDate') {
        params.set('sortBy', newFilters.sortBy);
      }
      if (newFilters.sortOrder && newFilters.sortOrder !== 'desc') {
        params.set('sortOrder', newFilters.sortOrder);
      }

      const queryString = params.toString();
      router.push(`/inventory/counts${queryString ? `?${queryString}` : ''}`, {
        scroll: false,
      });
    },
    [router]
  );

  // 处理筛选变化
  const handleFilterChange = React.useCallback(
    (newFilters: Partial<InventoryCountQueryParams>) => {
      const updatedFilters = {
        ...filters,
        ...newFilters,
        page: 1, // 重置到第一页
      };

      setFilters(updatedFilters);
      updateURL(updatedFilters);
    },
    [filters, updateURL]
  );

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">库存盘点</h1>
          <p className="text-muted-foreground">
            管理库存盘点计划，跟踪盘点进度
          </p>
        </div>
        {hasManagePermission && (
          <Button asChild>
            <Link href="/inventory/counts/new">
              <Plus className="mr-2 h-4 w-4" />
              新建盘点计划
            </Link>
          </Button>
        )}
      </div>

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <CountFilters filters={filters} onFilterChange={handleFilterChange} />
        </CardContent>
      </Card>

      {/* 盘点计划列表 */}
      <Card>
        <CardHeader>
          <CardTitle>盘点计划列表</CardTitle>
        </CardHeader>
        <CardContent>
          <CountList filters={filters} />
        </CardContent>
      </Card>
    </div>
  );
}
