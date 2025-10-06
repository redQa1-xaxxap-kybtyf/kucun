'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Eye, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOrderUpdates } from '@/hooks/use-websocket';
import { getSalesOrders, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import { paginationConfig } from '@/lib/env';
import { type PaginatedResponse } from '@/lib/types/api';
import {
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_VARIANTS,
  type SalesOrder,
  type SalesOrderQueryParams,
  type SalesOrderStatus,
} from '@/lib/types/sales-order';

interface ERPSalesOrderListProps {
  onOrderSelect?: (order: SalesOrder) => void;
  _initialData?: PaginatedResponse<SalesOrder>;
  initialParams?: SalesOrderQueryParams;
}

/**
 * ERP风格销售订单列表组件
 * 符合中国ERP系统的标准布局和用户体验
 */
export function ERPSalesOrderList({
  onOrderSelect,
  _initialData,
  initialParams,
}: ERPSalesOrderListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [queryParams, setQueryParams] = React.useState<SalesOrderQueryParams>(
    initialParams || {
      page: 1,
      limit: paginationConfig.defaultPageSize, // 使用统一的分页配置
      search: '',
      status: undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }
  );

  // 获取销售订单列表数据 - 使用服务器端提供的初始数据
  const { data, isLoading, error } = useQuery({
    queryKey: salesOrderQueryKeys.list(queryParams),
    queryFn: () => getSalesOrders(queryParams),
    initialData: _initialData, // 使用服务端预取的数据优化首屏加载
    staleTime: 5 * 60 * 1000, // 5分钟内认为数据是新鲜的
    refetchOnWindowFocus: false, // 避免不必要的重新获取
    placeholderData: previousData => previousData, // 切换查询参数时保持上一次数据
    refetchOnMount: false, // 避免挂载时重新获取
  });

  // 订阅订单状态实时更新
  useOrderUpdates(
    React.useCallback(
      event => {
        // 更新本地订单缓存
        queryClient.setQueryData(
          salesOrderQueryKeys.detail(event.orderId),
          (old: SalesOrder | undefined) =>
            old ? { ...old, status: event.newStatus } : old
        );

        // 刷新订单列表
        queryClient.invalidateQueries({
          queryKey: salesOrderQueryKeys.lists(),
        });

        // 显示状态变更通知
        const statusLabel =
          SALES_ORDER_STATUS_LABELS[event.newStatus as SalesOrderStatus] ||
          event.newStatus;
        toast.info(`订单 ${event.orderNumber} 状态更新`, {
          description: `${event.oldStatus} → ${statusLabel}`,
        });
      },
      [queryClient]
    )
  );

  // 搜索处理
  const handleSearch = React.useCallback((value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  }, []);

  // 筛选处理 - 统一处理筛选器变更
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'status') {
        setQueryParams(prev => ({
          ...prev,
          status:
            value === 'all' || !value ? undefined : (value as SalesOrderStatus),
          page: 1,
        }));
      } else if (key === 'sortBy') {
        setQueryParams(prev => ({
          ...prev,
          sortBy: value as SalesOrderQueryParams['sortBy'],
          page: 1,
        }));
      }
    },
    []
  );

  // 分页处理
  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  };

  // 状态标签渲染
  const getStatusBadge = (status: string) => {
    const variant =
      SALES_ORDER_STATUS_VARIANTS[status as SalesOrderStatus] || 'outline';
    return (
      <Badge variant={variant} className="text-xs">
        {SALES_ORDER_STATUS_LABELS[status as SalesOrderStatus] || status}
      </Badge>
    );
  };

  // 格式化金额
  const formatAmount = (amount?: number) => {
    if (!amount) {
      return '¥0.00';
    }
    return `¥${amount.toFixed(2)}`;
  };

  // 格式化日期
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

  if (error) {
    return (
      <div className="bg-card rounded border p-4">
        <div className="text-center text-red-600">
          加载失败: {error instanceof Error ? error.message : '未知错误'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 搜索筛选卡片 */}
      <Card className="shadow-md shadow-gray-200/50">
        <CardContent className="pt-6">
          <UnifiedSearchBar
            // 搜索配置
            searchValue={queryParams.search || ''}
            onSearchChange={handleSearch}
            searchPlaceholder="搜索订单号或客户名称..."
            debounceDelay={400}
            compact={true}
            // 筛选器配置
            filters={[
              {
                key: 'status',
                label: '状态',
                options: [
                  { label: '全部', value: 'all' },
                  { label: '草稿', value: 'draft' },
                  { label: '已确认', value: 'confirmed' },
                  { label: '已发货', value: 'shipped' },
                  { label: '已完成', value: 'completed' },
                  { label: '已取消', value: 'cancelled' },
                ],
                width: 'w-24',
              },
              {
                key: 'sortBy',
                label: '排序',
                options: [
                  { label: '创建时间', value: 'createdAt' },
                  { label: '订单号', value: 'orderNumber' },
                  { label: '金额', value: 'totalAmount' },
                  { label: '更新时间', value: 'updatedAt' },
                ],
                width: 'w-24',
              },
            ]}
            filterValues={{
              status: queryParams.status || 'all',
              sortBy: queryParams.sortBy || 'createdAt',
            }}
            onFilterChange={handleFilterChange}
          />
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="h-8 text-xs font-medium">序号</TableHead>
              <TableHead className="h-8 text-xs font-medium">订单号</TableHead>
              <TableHead className="h-8 text-xs font-medium">
                客户名称
              </TableHead>
              <TableHead className="h-8 text-xs font-medium">状态</TableHead>
              <TableHead className="h-8 text-right text-xs font-medium">
                订单金额
              </TableHead>
              <TableHead className="h-8 text-xs font-medium">
                创建日期
              </TableHead>
              <TableHead className="h-8 text-xs font-medium">
                更新日期
              </TableHead>
              <TableHead className="h-8 w-16 text-xs font-medium">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // 加载状态
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">加载中...</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                  <TableCell className="h-8 text-xs">-</TableCell>
                </TableRow>
              ))
            ) : data?.data && data.data.length > 0 ? (
              data.data.map((order, index) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer transition-colors hover:bg-blue-50/50"
                  onClick={() => onOrderSelect?.(order)}
                >
                  <TableCell className="text-muted-foreground h-8 text-xs">
                    {((queryParams.page || 1) - 1) * (queryParams.limit || 10) +
                      index +
                      1}
                  </TableCell>
                  <TableCell className="h-8 font-mono text-xs font-medium text-blue-600">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell className="h-8 text-xs font-medium text-gray-900">
                    {order.customer?.name || '-'}
                  </TableCell>
                  <TableCell className="h-8 text-xs">
                    {getStatusBadge(order.status)}
                  </TableCell>
                  <TableCell className="h-8 text-right text-xs font-medium">
                    {formatAmount(order.totalAmount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground h-8 text-xs">
                    {formatDate(order.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground h-8 text-xs">
                    {formatDate(order.updatedAt)}
                  </TableCell>
                  <TableCell className="h-8 text-xs">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            router.push(`/sales-orders/${order.id}`);
                          }}
                          className="text-xs"
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          查看
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={e => {
                            e.stopPropagation();
                            router.push(`/sales-orders/${order.id}/edit`);
                          }}
                          className="text-xs"
                        >
                          <Edit className="mr-1 h-3 w-3" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-red-600"
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-muted-foreground h-20 text-center text-xs"
                >
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ERP标准分页 */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            显示 {(data.pagination.page - 1) * data.pagination.limit + 1} -{' '}
            {Math.min(
              data.pagination.page * data.pagination.limit,
              data.pagination.total
            )}{' '}
            条，共 {data.pagination.total} 条
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.pagination.page - 1)}
              disabled={data.pagination.page <= 1}
              className="h-7 text-xs"
            >
              上一页
            </Button>
            <div className="text-muted-foreground">
              {data.pagination.page} / {data.pagination.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(data.pagination.page + 1)}
              disabled={data.pagination.page >= data.pagination.totalPages}
              className="h-7 text-xs"
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
