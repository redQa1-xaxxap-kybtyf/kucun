/* eslint-disable max-lines-per-function */

'use client';

import {
  Ban,
  Clock,
  Eye,
  Loader2,
  Package,
  Search,
  Truck,
  X,
} from 'lucide-react';
import * as React from 'react';

import { SearchFilterCard } from '@/components/common/search-filter-card';
import { CustomerSelector } from '@/components/sales-orders/customer-selector';
import { Button } from '@/components/ui/button';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { SALES_ORDER_FILTER_CONFIG } from '@/lib/configs/filter-configs';
import type { SalesOrderQueryParams } from '@/lib/types/sales-order';
import { cn } from '@/lib/utils';

interface SalesOrderSearchToolbarProps {
  queryParams: SalesOrderQueryParams;
  searchValue?: string;
  onSearch: (value: string) => void;
  onFilter: (key: string, value: string | undefined) => void;
  onClearFilters: () => void;
  isSearching?: boolean;
}

const STATUS_OPTIONS = [
  { label: '待处理', value: 'pending' },
  { label: '草稿', value: 'draft' },
  { label: '已确认', value: 'confirmed' },
  { label: '已发货', value: 'shipped' },
  { label: '已完成', value: 'completed' },
  { label: '已取消', value: 'cancelled' },
] as const;

const SORT_OPTIONS = [
  { label: '销售日期', value: 'orderDate' },
  { label: '创建时间', value: 'createdAt' },
  { label: '订单金额', value: 'totalAmount' },
  { label: '发货时间', value: 'shippedAt' },
  { label: '更新时间', value: 'updatedAt' },
  { label: '订单号', value: 'orderNumber' },
] as const;

const DESKTOP_FIELD_CLASS_NAME =
  'h-10 w-full rounded-lg border border-[hsl(var(--color-border-primary))] bg-white px-3 text-sm font-normal text-[hsl(var(--color-text-primary))] transition-colors outline-hidden focus:border-[hsl(var(--color-primary))] focus:ring-2 focus:ring-[hsl(var(--color-primary))] focus:ring-offset-2';

export const SalesOrderSearchToolbar = React.memo<SalesOrderSearchToolbarProps>(
  ({
    queryParams,
    searchValue,
    onSearch,
    onFilter,
    onClearFilters,
    isSearching = false,
  }) => {
    const isHistoryView = queryParams.recordScope === 'history';
    const desktopSearchValue = searchValue ?? queryParams.search ?? '';

    const hasActiveFilters = React.useMemo(
      () =>
        Boolean(
          queryParams.status ||
            queryParams.customerId ||
            queryParams.startDate ||
            queryParams.endDate ||
            queryParams.orderType ||
            queryParams.isSampleOrder ||
            queryParams.hasReturns ||
            (!isHistoryView && queryParams.includeTest) ||
            queryParams.includeVoided ||
            queryParams.search ||
            searchValue
        ),
      [
        isHistoryView,
        queryParams.customerId,
        queryParams.endDate,
        queryParams.hasReturns,
        queryParams.includeTest,
        queryParams.includeVoided,
        queryParams.isSampleOrder,
        queryParams.orderType,
        queryParams.search,
        queryParams.startDate,
        queryParams.status,
        searchValue,
      ]
    );

    const handleDateRangeChange = React.useCallback(
      ({ startDate, endDate }: DateRangeValue) => {
        onFilter('dateRange', JSON.stringify({ startDate, endDate }));
      },
      [onFilter]
    );

    const handleCustomerFilterChange = React.useCallback(
      (customerId: string) => {
        onFilter('customerId', customerId || undefined);
      },
      [onFilter]
    );

    const handleClearCustomerFilter = React.useCallback(() => {
      onFilter('customerId', undefined);
    }, [onFilter]);

    const handleToggleHistoryOrders = React.useCallback(() => {
      onFilter('recordScope', isHistoryView ? undefined : 'history');
    }, [isHistoryView, onFilter]);

    const handleToggleTransferOrders = React.useCallback(() => {
      const isTransferActive = queryParams.orderType === 'TRANSFER';
      onFilter('orderType', isTransferActive ? undefined : 'TRANSFER');
    }, [onFilter, queryParams.orderType]);

    const handleToggleSampleOrders = React.useCallback(() => {
      const isSampleActive = queryParams.isSampleOrder === true;
      onFilter('isSampleOrder', isSampleActive ? undefined : 'true');
    }, [onFilter, queryParams.isSampleOrder]);

    const handleToggleHasReturns = React.useCallback(() => {
      const currentValue = queryParams.hasReturns === true;
      onFilter('hasReturns', currentValue ? undefined : 'true');
    }, [onFilter, queryParams.hasReturns]);

    const handleToggleIncludeVoided = React.useCallback(() => {
      const currentValue = queryParams.includeVoided === true;
      onFilter('includeVoided', currentValue ? undefined : 'true');
    }, [onFilter, queryParams.includeVoided]);

    const handleToggleIncludeTest = React.useCallback(() => {
      const currentValue = queryParams.includeTest === true;
      onFilter('includeTest', currentValue ? undefined : 'true');
    }, [onFilter, queryParams.includeTest]);

    const filters = React.useMemo(
      () => [
        {
          key: 'status',
          label: '订单状态',
          options: [...STATUS_OPTIONS],
          width: 'w-[160px]',
        },
        {
          key: 'sortBy',
          label: '排序方式',
          options: [...SORT_OPTIONS],
          width: 'w-[180px]',
          includeAllOption: false,
          defaultValue: 'orderDate',
        },
      ],
      []
    );

    const toggleButtons = React.useMemo(
      () => [
        {
          key: 'historyOrders',
          label: '历史',
          icon: <Clock className="mr-1 h-3 w-3" />,
          active: isHistoryView,
          onClick: handleToggleHistoryOrders,
        },
        {
          key: 'transferOrders',
          label: '调货',
          icon: <Truck className="mr-1 h-3 w-3" />,
          active: queryParams.orderType === 'TRANSFER',
          onClick: handleToggleTransferOrders,
        },
        {
          key: 'sampleOrders',
          label: '样品单',
          icon: <Package className="mr-1 h-3 w-3" />,
          active: !!queryParams.isSampleOrder,
          onClick: handleToggleSampleOrders,
        },
        {
          key: 'hasReturns',
          label: '有退货',
          icon: <Package className="mr-1 h-3 w-3" />,
          active: !!queryParams.hasReturns,
          onClick: handleToggleHasReturns,
        },
        ...(!isHistoryView
          ? [
              {
                key: 'includeTest',
                label: '测试',
                icon: <Eye className="mr-1 h-3 w-3" />,
                active: !!queryParams.includeTest,
                onClick: handleToggleIncludeTest,
              },
            ]
          : []),
        {
          key: 'includeVoided',
          label: '作废',
          icon: <Ban className="mr-1 h-3 w-3" />,
          active: !!queryParams.includeVoided,
          onClick: handleToggleIncludeVoided,
        },
      ],
      [
        handleToggleHasReturns,
        handleToggleHistoryOrders,
        handleToggleIncludeTest,
        handleToggleIncludeVoided,
        handleToggleSampleOrders,
        handleToggleTransferOrders,
        isHistoryView,
        queryParams.hasReturns,
        queryParams.includeTest,
        queryParams.includeVoided,
        queryParams.isSampleOrder,
        queryParams.orderType,
      ]
    );

    const customerFilter = (
      <div className="w-full min-w-0 space-y-1.5 xl:w-[320px]">
        <div className="text-muted-foreground text-xs font-medium">
          客户筛选
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <CustomerSelector
            value={queryParams.customerId}
            onValueChange={handleCustomerFilterChange}
            placeholder="选择客户筛选订单"
            allowCreate={false}
            className="h-10 min-w-0 flex-1 rounded-lg bg-white"
          />
          {queryParams.customerId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearCustomerFilter}
              className="h-10 shrink-0 rounded-lg px-3"
            >
              清空
            </Button>
          ) : null}
        </div>
      </div>
    );

    return (
      <div className="space-y-3">
        <div
          className="sm:hidden"
          data-testid="sales-order-mobile-search-toolbar"
        >
          <SearchFilterCard
            searchValue={desktopSearchValue}
            onSearchChange={onSearch}
            searchPlaceholder={SALES_ORDER_FILTER_CONFIG.searchPlaceholder}
            isSearching={isSearching}
            filters={filters}
            filterValues={{
              status: queryParams.status || 'all',
              sortBy: queryParams.sortBy || 'orderDate',
            }}
            onFilterChange={onFilter}
            dateRangeFilter={{
              key: 'dateRange',
              label: SALES_ORDER_FILTER_CONFIG.dateRangeLabel,
              value: {
                startDate: queryParams.startDate,
                endDate: queryParams.endDate,
              },
              onChange: handleDateRangeChange,
              placeholder: SALES_ORDER_FILTER_CONFIG.dateRangePlaceholder,
            }}
            customFilters={customerFilter}
            toggleButtons={toggleButtons}
            onClearFilters={onClearFilters}
            hasActiveFilters={hasActiveFilters}
            variant="elevated"
            compact
            className="overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-white shadow-sm"
          />
        </div>

        <div
          className="hidden sm:block"
          data-testid="sales-order-desktop-search-toolbar"
        >
          <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-white p-3 shadow-sm">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {toggleButtons.map(toggle => (
                    <Button
                      key={toggle.key}
                      type="button"
                      variant="outline"
                      data-active={toggle.active || undefined}
                      className="h-10 rounded-lg px-3 font-medium whitespace-nowrap data-[active=true]:border-[hsl(var(--color-primary))] data-[active=true]:bg-[hsl(var(--color-primary-light))] data-[active=true]:text-[hsl(var(--color-primary))]"
                      onClick={toggle.onClick}
                    >
                      {toggle.icon}
                      {toggle.label}
                    </Button>
                  ))}
                </div>

                <div className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                  <div className="relative min-w-[260px] flex-1 xl:max-w-[480px]">
                    {isSearching ? (
                      <Loader2 className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 animate-spin" />
                    ) : (
                      <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    )}
                    <Input
                      data-testid="sales-order-desktop-search-input"
                      type="search"
                      inputMode="search"
                      enterKeyHint="search"
                      autoCapitalize="off"
                      autoCorrect="off"
                      placeholder={SALES_ORDER_FILTER_CONFIG.searchPlaceholder}
                      value={desktopSearchValue}
                      onChange={event => onSearch(event.target.value)}
                      className={cn(
                        DESKTOP_FIELD_CLASS_NAME,
                        'w-full pl-10',
                        desktopSearchValue && 'pr-10'
                      )}
                    />
                    {desktopSearchValue ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2 rounded-md p-0"
                        onClick={() => onSearch('')}
                        aria-label="清空销售订单搜索"
                      >
                        <X className="text-muted-foreground h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-[160px_180px_minmax(260px,1fr)_minmax(260px,320px)_auto] xl:items-center">
                <div className="min-w-0">
                  <select
                    data-testid="sales-order-desktop-status-filter"
                    aria-label="订单状态"
                    value={queryParams.status || 'all'}
                    onChange={event =>
                      onFilter(
                        'status',
                        event.target.value === 'all'
                          ? undefined
                          : event.target.value
                      )
                    }
                    className={DESKTOP_FIELD_CLASS_NAME}
                  >
                    <option value="all">全部订单状态</option>
                    {STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <select
                    data-testid="sales-order-desktop-sort-filter"
                    aria-label="排序方式"
                    value={queryParams.sortBy || 'orderDate'}
                    onChange={event => onFilter('sortBy', event.target.value)}
                    className={DESKTOP_FIELD_CLASS_NAME}
                  >
                    {SORT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <DateRangePicker
                    value={{
                      startDate: queryParams.startDate,
                      endDate: queryParams.endDate,
                    }}
                    onChange={handleDateRangeChange}
                    label=""
                    placeholder={SALES_ORDER_FILTER_CONFIG.dateRangePlaceholder}
                    showPresets={true}
                    className="w-full"
                    triggerClassName={cn(
                      DESKTOP_FIELD_CLASS_NAME,
                      'justify-start'
                    )}
                  />
                </div>

                <div
                  data-testid="sales-order-desktop-customer-filter"
                  className="min-w-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <CustomerSelector
                      value={queryParams.customerId}
                      onValueChange={handleCustomerFilterChange}
                      placeholder="选择客户筛选订单"
                      allowCreate={false}
                      className="h-10 min-w-0 flex-1 rounded-lg bg-white"
                    />
                    {queryParams.customerId ? (
                      <Button
                        data-testid="sales-order-desktop-clear-customer"
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearCustomerFilter}
                        className="h-10 shrink-0 rounded-lg px-3 text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-primary-light))]"
                      >
                        清空
                      </Button>
                    ) : null}
                  </div>
                </div>

                {hasActiveFilters ? (
                  <div className="lg:col-span-2 xl:col-span-1 xl:justify-self-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={onClearFilters}
                      className="h-10 rounded-lg px-3 text-[hsl(var(--color-text-secondary))] hover:bg-[hsl(var(--color-primary-light))]"
                    >
                      清空条件
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

SalesOrderSearchToolbar.displayName = 'SalesOrderSearchToolbar';
