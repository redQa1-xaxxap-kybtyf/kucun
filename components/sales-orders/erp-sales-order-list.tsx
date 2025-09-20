'use client';

import { useQuery } from '@tanstack/react-query';
import { Edit, Eye, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getSalesOrders, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import type {
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_VARIANTS,
  SalesOrder,
  SalesOrderQueryParams,
  SalesOrderStatus,
} from '@/lib/types/sales-order';

interface ERPSalesOrderListProps {
  onOrderSelect?: (order: SalesOrder) => void;
}

/**
 * ERP风格销售订单列表组件
 * 符合中国ERP系统的标准布局和用户体验
 */
export function ERPSalesOrderList({ onOrderSelect }: ERPSalesOrderListProps) {
  const router = useRouter();
  const [queryParams, setQueryParams] = React.useState<SalesOrderQueryParams>({
    page: 1,
    limit: 50, // ERP系统通常显示更多数据
    search: '',
    status: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 获取销售订单列表数据
  const { data, isLoading, error } = useQuery({
    queryKey: salesOrderQueryKeys.list(queryParams),
    queryFn: () => getSalesOrders(queryParams),
  });

  // 搜索处理
  const handleSearch = (value: string) => {
    setQueryParams(prev => ({ ...prev, search: value, page: 1 }));
  };

  // 筛选处理
  const handleFilter = (
    key: keyof SalesOrderQueryParams,
    value: string | number | boolean
  ) => {
    setQueryParams(prev => ({ ...prev, [key]: value, page: 1 }));
  };

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
    if (!amount) return '¥0.00';
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
      <div className="rounded border bg-card p-4">
        <div className="text-center text-red-600">
          加载失败: {error instanceof Error ? error.message : '未知错误'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ERP标准工具栏 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">销售订单</h3>
            <div className="text-xs text-muted-foreground">
              {data?.pagination ? `共 ${data.pagination.total} 条记录` : ''}
            </div>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => router.push('/sales-orders/create')}
              className="h-7 text-xs"
            >
              <Plus className="mr-1 h-3 w-3" />
              新建
            </Button>
            <div className="flex-1">
              <div className="relative max-w-sm">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="订单号/客户名称"
                  value={queryParams.search}
                  onChange={e => handleSearch(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
            </div>
            <Select
              value={queryParams.status || 'all'}
              onValueChange={value =>
                handleFilter('status', value === 'all' ? undefined : value)
              }
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="confirmed">已确认</SelectItem>
                <SelectItem value="shipped">已发货</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
                <SelectItem value="cancelled">已取消</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={queryParams.sortBy || 'createdAt'}
              onValueChange={value => handleFilter('sortBy', value)}
            >
              <SelectTrigger className="h-7 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">创建时间</SelectItem>
                <SelectItem value="orderNumber">订单号</SelectItem>
                <SelectItem value="totalAmount">金额</SelectItem>
                <SelectItem value="updatedAt">更新时间</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ERP标准数据表格 */}
      <div className="rounded border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
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
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onOrderSelect?.(order)}
                >
                  <TableCell className="h-8 text-xs text-muted-foreground">
                    {(queryParams.page - 1) * queryParams.limit + index + 1}
                  </TableCell>
                  <TableCell className="h-8 text-xs font-medium">
                    {order.orderNumber}
                  </TableCell>
                  <TableCell className="h-8 text-xs">
                    {order.customer?.name || '-'}
                  </TableCell>
                  <TableCell className="h-8 text-xs">
                    {getStatusBadge(order.status)}
                  </TableCell>
                  <TableCell className="h-8 text-right text-xs font-medium">
                    {formatAmount(order.totalAmount)}
                  </TableCell>
                  <TableCell className="h-8 text-xs text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </TableCell>
                  <TableCell className="h-8 text-xs text-muted-foreground">
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
                  className="h-20 text-center text-xs text-muted-foreground"
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
