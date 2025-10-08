'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Edit, Eye, MoreHorizontal, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ScrollableTableContainer } from '@/components/common/ScrollableTableContainer';
import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  initialParams?: SalesOrderQueryParams;
  onSearch?: (value: string) => void;
  onFilter?: (key: string, value: string | undefined) => void;
  onPageChange?: (page: number) => void;
  searchValue?: string;
}

/**
 * ERP风格销售订单列表组件
 * 符合中国ERP系统的标准布局和用户体验
 *
 * ✅ 修复：使用 HydrationBoundary 而不是 initialData prop
 */
export function ERPSalesOrderList({
  onOrderSelect,
  initialParams,
  onSearch: externalOnSearch,
  onFilter: externalOnFilter,
  onPageChange: externalOnPageChange,
  searchValue,
}: ERPSalesOrderListProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showEditWarning, setShowEditWarning] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<SalesOrder | null>(
    null
  );

  // ✅ 移除内部 queryParams 状态，完全依赖外部传入的 initialParams
  // ✅ 单一数据源原则：状态统一在父组件管理

  // ✅ 默认查询参数（确保类型正确）
  const queryParams: SalesOrderQueryParams = {
    page: initialParams?.page || 1,
    limit: initialParams?.limit || 20,
    search: initialParams?.search,
    status: initialParams?.status,
    customerId: initialParams?.customerId,
    sortBy: initialParams?.sortBy || 'createdAt',
    sortOrder: initialParams?.sortOrder || 'desc',
  };

  // ✅ 获取销售订单列表数据 - 从 HydrationBoundary 自动获取服务端预取的数据
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: salesOrderQueryKeys.list(queryParams),
    queryFn: () => getSalesOrders(queryParams),
    // ✅ 移除 initialData - 数据已在 QueryClient 中（通过 HydrationBoundary）
    staleTime: 30 * 1000, // ✅ 30秒内数据视为新鲜，避免频繁请求导致数据闪烁
    refetchOnWindowFocus: false, // 避免窗口聚焦时不必要的刷新
    placeholderData: (previousData) => previousData, // ✅ 保持上一次数据，避免数据清空
    refetchOnMount: false, // 避免挂载时重新获取
    gcTime: 10 * 60 * 1000, // ✅ 缓存时间10分钟，提升后退/前进体验
  });

  // 搜索处理 - 直接使用外部传入的处理函数
  const handleSearch = React.useCallback(
    (value: string) => {
      if (externalOnSearch) {
        externalOnSearch(value);
      }
    },
    [externalOnSearch]
  );

  // 筛选处理 - 直接使用外部传入的处理函数
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (externalOnFilter) {
        externalOnFilter(key, value);
      }
    },
    [externalOnFilter]
  );

  // 分页处理 - 直接使用外部传入的处理函数
  const handlePageChange = React.useCallback(
    (page: number) => {
      if (externalOnPageChange) {
        externalOnPageChange(page);
      }
    },
    [externalOnPageChange]
  );

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
    <div className="flex h-full flex-col space-y-4">
      {/* 可滚动表格容器 */}
      <ScrollableTableContainer
        header={
          /* 固定的搜索筛选卡片 */
          <Card className="mb-4 shadow-md shadow-gray-200/50">
            <CardContent className="pt-6">
              {/* ✅ 加载指示器：提升用户体验 */}
              {isFetching && (
                <div className="mb-2 flex items-center gap-2 text-xs text-blue-600">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                  <span>搜索中...</span>
                </div>
              )}
              <UnifiedSearchBar
                // 搜索配置
                searchValue={searchValue ?? initialParams?.search ?? ''}
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
                  status: initialParams?.status || 'all',
                  sortBy: initialParams?.sortBy || 'createdAt',
                }}
                onFilterChange={handleFilterChange}
              />
            </CardContent>
          </Card>
        }
        footer={
          /* 固定的分页器 */
          data?.pagination &&
          data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between bg-gray-50/50 px-4 py-3 text-xs">
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
          )
        }
      >
        {/* 可滚动的数据表格 */}
        <div className="relative overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
          <Table>
            <TableHeader>
              <TableRow className="border-b bg-gradient-to-r from-slate-50 to-gray-50 hover:bg-gradient-to-r hover:from-slate-50 hover:to-gray-50">
                <TableHead className="h-8 text-xs font-medium">序号</TableHead>
                <TableHead className="h-8 text-xs font-medium">
                  订单号
                </TableHead>
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
                      {((initialParams?.page || 1) - 1) *
                        (initialParams?.limit || 10) +
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
                              if (order.status === 'draft') {
                                router.push(`/sales-orders/${order.id}/edit`);
                              } else {
                                setSelectedOrder(order);
                                setShowEditWarning(true);
                              }
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
      </ScrollableTableContainer>

      {/* 编辑警告模态框 */}
      <AlertDialog open={showEditWarning} onOpenChange={setShowEditWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <AlertDialogTitle>无法编辑订单</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-4">
              订单号 <strong>{selectedOrder?.orderNumber}</strong> 的状态为"
              <strong>
                {selectedOrder?.status === 'confirmed'
                  ? '已确认'
                  : selectedOrder?.status === 'shipped'
                    ? '已发货'
                    : selectedOrder?.status === 'completed'
                      ? '已完成'
                      : selectedOrder?.status === 'cancelled'
                        ? '已取消'
                        : selectedOrder?.status}
              </strong>
              "，只有<strong>草稿状态</strong>的订单才能编辑。
              <br />
              <br />
              如需修改订单信息，请联系管理员或创建退货单。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>知道了</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedOrder) {
                  router.push(`/sales-orders/${selectedOrder.id}`);
                }
              }}
            >
              查看详情
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}




