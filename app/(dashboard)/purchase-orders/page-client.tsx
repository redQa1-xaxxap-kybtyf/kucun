'use client';

import { Plus, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useDebouncedCallback } from 'use-debounce';

import { PageHeader } from '@/components/common/page-header';
import { PurchaseOrderList } from '@/components/purchase-orders/purchase-order-list';
import { SupplierSelector } from '@/components/suppliers/supplier-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PURCHASE_ORDER_STATUS,
  PURCHASE_ORDER_STATUS_LABELS,
  type PurchaseOrderStatus,
} from '@/lib/types/purchase-order';

interface PurchaseOrderQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: PurchaseOrderStatus;
  supplierId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: Date;
  endDate?: Date;
}

interface PurchaseOrdersPageClientProps {
  initialParams: PurchaseOrderQueryParams;
}

export function PurchaseOrdersPageClient({
  initialParams,
}: PurchaseOrdersPageClientProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  const [search, setSearch] = React.useState(initialParams.search || '');
  const [status, setStatus] = React.useState(initialParams.status);
  const [supplierId, setSupplierId] = React.useState(initialParams.supplierId);
  const [sortBy, _setSortBy] = React.useState(
    initialParams.sortBy || 'createdAt'
  );
  const [sortOrder, _setSortOrder] = React.useState<'asc' | 'desc'>(
    initialParams.sortOrder || 'desc'
  );
  const [startDate, setStartDate] = React.useState(initialParams.startDate);
  const [endDate, setEndDate] = React.useState(initialParams.endDate);

  const debouncedUpdateURL = useDebouncedCallback(
    (searchValue: string, filters: PurchaseOrderQueryParams) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) {
          params.set('search', searchValue);
        }
        if (filters.status) {
          params.set('status', filters.status);
        }
        if (filters.supplierId) {
          params.set('supplierId', filters.supplierId);
        }
        if (filters.sortBy) {
          params.set('sortBy', filters.sortBy);
        }
        if (filters.sortOrder) {
          params.set('sortOrder', filters.sortOrder);
        }
        if (filters.startDate) {
          params.set(
            'startDate',
            filters.startDate.toISOString().split('T')[0]
          );
        }
        if (filters.endDate) {
          params.set('endDate', filters.endDate.toISOString().split('T')[0]);
        }
        if (filters.page && filters.page > 1) {
          params.set('page', filters.page.toString());
        }
        if (filters.limit) {
          params.set('limit', filters.limit.toString());
        }

        router.push(`/purchase-orders?${params.toString()}`);
      });
    },
    300
  );

  const handleSearch = React.useCallback(
    (value: string) => {
      setSearch(value);
      debouncedUpdateURL(value, {
        ...initialParams,
        search: value,
        status,
        supplierId,
        sortBy,
        sortOrder,
        startDate,
        endDate,
      });
    },
    [
      debouncedUpdateURL,
      initialParams,
      status,
      supplierId,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    ]
  );

  const handleStatusChange = React.useCallback(
    (value: string) => {
      const newStatus =
        value === 'all' ? undefined : (value as PurchaseOrderStatus);
      setStatus(newStatus);
      debouncedUpdateURL(search, {
        ...initialParams,
        search,
        status: newStatus,
        supplierId,
        sortBy,
        sortOrder,
        startDate,
        endDate,
      });
    },
    [
      debouncedUpdateURL,
      search,
      initialParams,
      supplierId,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    ]
  );

  const handleSupplierChange = React.useCallback(
    (value: string) => {
      const newSupplierId = value === 'all' ? undefined : value;
      setSupplierId(newSupplierId);
      debouncedUpdateURL(search, {
        ...initialParams,
        search,
        status,
        supplierId: newSupplierId,
        sortBy,
        sortOrder,
        startDate,
        endDate,
      });
    },
    [
      debouncedUpdateURL,
      search,
      initialParams,
      status,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    ]
  );

  const handleDateRangeChange = React.useCallback(
    (range: { startDate?: string; endDate?: string }) => {
      const start = range.startDate ? new Date(range.startDate) : undefined;
      const end = range.endDate ? new Date(range.endDate) : undefined;
      setStartDate(start);
      setEndDate(end);
      debouncedUpdateURL(search, {
        ...initialParams,
        search,
        status,
        supplierId,
        sortBy,
        sortOrder,
        startDate: start,
        endDate: end,
      });
    },
    [
      debouncedUpdateURL,
      search,
      initialParams,
      status,
      supplierId,
      sortBy,
      sortOrder,
    ]
  );

  const handleClearFilters = React.useCallback(() => {
    setStatus(undefined);
    setSupplierId(undefined);
    setStartDate(undefined);
    setEndDate(undefined);
    setSearch('');
    router.push('/purchase-orders');
  }, [router]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="仓库进货"
        description="管理采购订单和仓库进货记录"
        icon={<Warehouse className="h-5 w-5" />}
        actions={
          <Link href="/purchase-orders/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新建采购订单
            </Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="mb-6 space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="搜索集装箱号或订单号..."
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  className="w-full"
                />
              </div>

              <Select
                value={status || 'all'}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  {Object.entries(PURCHASE_ORDER_STATUS).map(
                    ([_key, value]) => (
                      <SelectItem key={value} value={value}>
                        {PURCHASE_ORDER_STATUS_LABELS[value]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>

              <div className="w-full md:w-[220px]">
                <SupplierSelector
                  value={supplierId}
                  onValueChange={handleSupplierChange}
                  placeholder="选择供应商"
                />
              </div>

              <DateRangePicker
                value={{
                  startDate: startDate?.toISOString().split('T')[0],
                  endDate: endDate?.toISOString().split('T')[0],
                }}
                onChange={handleDateRangeChange}
                placeholder="选择日期范围"
                showPresets
                showClearButton
                className="w-full md:w-[240px]"
              />

              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full md:w-auto"
              >
                重置筛选
              </Button>
            </div>
          </div>

          <PurchaseOrderList
            page={initialParams.page}
            limit={initialParams.limit}
            search={search}
            status={status}
            supplierId={supplierId}
            startDate={startDate}
            endDate={endDate}
            sortBy={sortBy}
            sortOrder={sortOrder}
          />
        </CardContent>
      </Card>
    </div>
  );
}
