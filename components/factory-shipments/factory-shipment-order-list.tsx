'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Edit, Eye, MoreHorizontal, Package, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useState } from 'react';

import { ContentLoading } from '@/components/common/loading';
import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  factoryShipmentQueryKeys,
  getFactoryShipmentOrders,
  useDeleteFactoryShipmentOrder,
} from '@/lib/api/factory-shipments';
import {
  FACTORY_SHIPMENT_STATUS_LABELS,
  type FactoryShipmentOrder,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';
import { getFactoryShipmentStatusBadgeVariant } from '@/lib/utils/badge-helpers';

interface FactoryShipmentQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: FactoryShipmentStatus;
  startDate?: Date;
  endDate?: Date;
}

interface FactoryShipmentOrderListProps {
  onOrderSelect?: (order: FactoryShipmentOrder) => void;
  initialParams?: FactoryShipmentQueryParams;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onDateRangeChange?: (range: { startDate?: string; endDate?: string }) => void;
  onPageChange?: (page: number) => void;
}

// 格式化金额 - 使用人民币符号和千分位分隔符
const formatAmount = (amount: number): string =>
  `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// 格式化日期 - 统一使用 YYYY-MM-DD 格式
const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy-MM-dd', { locale: zhCN });
};

export function FactoryShipmentOrderList({
  onOrderSelect,
  initialParams,
  onSearch: externalOnSearch,
  onFilter: externalOnFilter,
  onDateRangeChange: externalOnDateRangeChange,
  onPageChange: externalOnPageChange,
}: FactoryShipmentOrderListProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(initialParams?.search || '');
  const [statusFilter, setStatusFilter] = useState<
    FactoryShipmentStatus | 'all'
  >(initialParams?.status || 'all');
  const [currentPage, setCurrentPage] = useState(initialParams?.page || 1);
  const pageSize = initialParams?.limit || 20;

  // 删除订单的 mutation
  const deleteOrderMutation = useDeleteFactoryShipmentOrder();

  // 查询厂家发货订单列表 - 使用真实API
  const { data, isLoading, error } = useQuery({
    queryKey: factoryShipmentQueryKeys.list({
      page: initialParams?.page || currentPage,
      limit: pageSize,
      status:
        initialParams?.status ||
        (statusFilter === 'all' ? undefined : statusFilter),
      containerNumber: initialParams?.search || searchTerm || undefined,
    }),
    queryFn: () =>
      getFactoryShipmentOrders({
        page: initialParams?.page || currentPage,
        limit: pageSize,
        status:
          initialParams?.status ||
          (statusFilter === 'all' ? undefined : statusFilter),
        containerNumber: initialParams?.search || searchTerm || undefined,
      }),
  });

  const orders = data?.data || [];
  const pagination = data
    ? {
        page: data.page,
        limit: data.limit,
        totalCount: data.total,
        totalPages: Math.ceil(data.total / data.limit),
      }
    : undefined;

  // 处理搜索 - 优先使用外部传入的处理函数
  const handleSearch = React.useCallback(
    (value: string) => {
      if (externalOnSearch) {
        externalOnSearch(value);
      } else {
        setSearchTerm(value);
        setCurrentPage(1);
      }
    },
    [externalOnSearch]
  );

  // 统一处理筛选器变更 - 优先使用外部传入的处理函数
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (externalOnFilter) {
        externalOnFilter(key, value);
      } else {
        if (key === 'status') {
          setStatusFilter(
            (value === 'all' || !value ? 'all' : value) as
              | FactoryShipmentStatus
              | 'all'
          );
          setCurrentPage(1);
        }
      }
    },
    [externalOnFilter]
  );

  // 处理页码变化 - 优先使用外部传入的处理函数
  const handlePageChange = React.useCallback(
    (page: number) => {
      if (externalOnPageChange) {
        externalOnPageChange(page);
      } else {
        setCurrentPage(page);
      }
    },
    [externalOnPageChange]
  );

  // 处理删除订单
  const handleDelete = React.useCallback(
    async (orderId: string, orderNumber: string) => {
      if (!confirm(`确定要删除订单 ${orderNumber} 吗？此操作不可恢复。`)) {
        return;
      }

      try {
        await deleteOrderMutation.mutateAsync(orderId);
        // 删除成功后会自动刷新列表（因为 mutation 配置了 invalidateQueries）
      } catch (error) {
        alert(
          error instanceof Error ? error.message : '删除订单失败，请稍后重试'
        );
      }
    },
    [deleteOrderMutation]
  );

  // 加载状态
  if (isLoading) {
    return <ContentLoading text="加载厂家发货订单..." />;
  }

  if (error) {
    return (
      <Card
        className="overflow-hidden border border-[hsl(var(--color-border-primary))]"
        style={{ boxShadow: 'var(--shadow-light)' }}
      >
        <CardContent className="bg-[hsl(var(--color-error-light))] pt-6">
          <div className="text-center text-[hsl(var(--color-error))]">
            加载厂家发货订单失败，请稍后重试
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 搜索和筛选 */}
      <Card
        className="border border-[hsl(var(--color-border-primary))]"
        style={{ boxShadow: 'var(--shadow-light)' }}
      >
        <CardContent className="bg-[hsl(var(--color-bg-card))] pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="min-w-[280px] flex-1">
              <UnifiedSearchBar
                searchValue={searchTerm}
                onSearchChange={handleSearch}
                searchPlaceholder="搜索集装箱号码或订单编号..."
                debounceDelay={400}
                filters={[
                  {
                    key: 'status',
                    label: '状态',
                    options: Object.entries(FACTORY_SHIPMENT_STATUS_LABELS).map(
                      ([status, label]) => ({
                        label,
                        value: status,
                      })
                    ),
                    width: 'w-full sm:w-48',
                  },
                ]}
                filterValues={{
                  status: statusFilter,
                }}
                onFilterChange={handleFilterChange}
              />
            </div>

            <DateRangePicker
              value={{
                startDate: initialParams?.startDate
                  ?.toISOString()
                  .split('T')[0],
                endDate: initialParams?.endDate?.toISOString().split('T')[0],
              }}
              onChange={range => {
                if (externalOnDateRangeChange) {
                  externalOnDateRangeChange(range);
                }
              }}
              showPresets={true}
              showClearButton={true}
              label=""
              className="min-w-[220px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* 订单列表 */}
      <div
        className="overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]"
        style={{ boxShadow: 'var(--shadow-medium)' }}
      >
        {orders.length === 0 ? (
          <div className="py-8 text-center">
            <Package className="mx-auto h-12 w-12 text-[hsl(var(--color-text-tertiary))]" />
            <h3 className="mt-2 text-sm font-medium text-[hsl(var(--color-text-primary))]">
              暂无厂家发货订单
            </h3>
          </div>
        ) : (
          <Table>
            <TableHeader style={{ boxShadow: 'var(--shadow-light)' }}>
              <TableRow>
                <TableHead>订单编号</TableHead>
                <TableHead>集装箱号码</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">订单金额</TableHead>
                <TableHead className="text-right">应收金额</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(order => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer border-b border-[hsl(var(--color-border-primary))] transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                  onClick={() => {
                    if (onOrderSelect) {
                      onOrderSelect(order);
                      return;
                    }
                    router.push(`/factory-shipments/${order.id}`);
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      if (onOrderSelect) {
                        onOrderSelect(order);
                      } else {
                        router.push(`/factory-shipments/${order.id}`);
                      }
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <TableCell className="font-mono font-medium text-[hsl(var(--color-primary))]">
                    <Link
                      href={`/factory-shipments/${order.id}`}
                      prefetch={false}
                      className="hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[hsl(var(--color-text-secondary))]">
                    {order.containerNumber || (
                      <span className="text-[hsl(var(--color-text-tertiary))]">
                        未填写
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-[hsl(var(--color-text-primary))]">
                    {order.customer?.name || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getFactoryShipmentStatusBadgeVariant(
                        order.status
                      )}
                      className="text-xs font-medium"
                    >
                      {
                        FACTORY_SHIPMENT_STATUS_LABELS[
                          order.status as FactoryShipmentStatus
                        ]
                      }
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-[hsl(var(--color-text-primary))]">
                    {formatAmount(order.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right text-[hsl(var(--color-text-primary))]">
                    {formatAmount(order.receivableAmount)}
                  </TableCell>
                  <TableCell className="text-[hsl(var(--color-text-secondary))]">
                    {formatDate(order.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            router.push(`/factory-shipments/${order.id}`);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          查看
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            router.push(`/factory-shipments/${order.id}/edit`);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            handleDelete(order.id, order.orderNumber);
                          }}
                          className="text-[hsl(var(--color-error))]"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* 分页组件 */}
        {pagination && (
          <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
            <Pagination
              pagination={{
                page: pagination.page,
                limit: pagination.limit,
                total: pagination.totalCount,
                totalPages: pagination.totalPages,
              }}
              onPageChange={handlePageChange}
              showRange
              showTotal
              disabled={isLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
}
