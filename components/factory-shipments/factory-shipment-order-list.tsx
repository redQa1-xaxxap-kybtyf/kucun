'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Eye, Package, Plus, Truck } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useState } from 'react';

import { UnifiedSearchBar } from '@/components/common/unified-search-bar';
import { FactoryShipmentOrderListSkeleton } from '@/components/factory-shipments/factory-shipment-order-list-skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
} from '@/lib/api/factory-shipments';
import {
  FACTORY_SHIPMENT_STATUS_LABELS,
  type FactoryShipmentOrder,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';

interface FactoryShipmentOrderListProps {
  onOrderSelect?: (order: FactoryShipmentOrder) => void;
}
// 获取状态徽章样式 - 符合中国ERP系统的颜色规范
const getStatusBadgeVariant = (
  status: FactoryShipmentStatus
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'draft':
      return 'secondary'; // 草稿 - 灰色
    case 'planning':
      return 'outline'; // 计划中 - 轮廓
    case 'waiting_deposit':
      return 'destructive'; // 等待定金 - 红色
    case 'deposit_paid':
    case 'factory_shipped':
    case 'in_transit':
    case 'arrived':
    case 'delivered':
    case 'completed':
      return 'default'; // 其他状态 - 默认蓝色
    default:
      return 'secondary';
  }
};

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
}: FactoryShipmentOrderListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    FactoryShipmentStatus | 'all'
  >('all');
  const [currentPage, setCurrentPage] = useState(1);

  // 查询厂家发货订单列表 - 使用真实API
  const { data, isLoading, error } = useQuery({
    queryKey: factoryShipmentQueryKeys.list({
      page: currentPage,
      limit: 20,
      status: statusFilter === 'all' ? undefined : statusFilter,
      containerNumber: searchTerm || undefined,
    }),
    queryFn: () =>
      getFactoryShipmentOrders({
        page: currentPage,
        limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
        containerNumber: searchTerm || undefined,
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

  // 处理搜索 - 重置到第一页
  const handleSearch = React.useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  // 统一处理筛选器变更
  const handleFilterChange = React.useCallback(
    (key: string, value: string | undefined) => {
      if (key === 'status') {
        setStatusFilter(
          (value === 'all' || !value ? 'all' : value) as
            | FactoryShipmentStatus
            | 'all'
        );
        setCurrentPage(1);
      }
    },
    []
  );

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // 加载状态 - 使用骨架屏
  if (isLoading) {
    return <FactoryShipmentOrderListSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    厂家发货管理
                  </h1>
                  <p className="text-sm text-gray-600">
                    管理厂家直发订单，支持多供应商和临时商品
                  </p>
                </div>
              </div>
              <Link href="/factory-shipments/create">
                <Button
                  size="lg"
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  创建发货订单
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg shadow-gray-200/50">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              加载厂家发货订单失败，请稍后重试
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 页面标题卡片 */}
      <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
        <CardContent className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                  厂家发货管理
                </h1>
                <p className="text-sm text-gray-600">
                  管理厂家直发订单，支持多供应商和临时商品
                </p>
              </div>
            </div>
            <Link href="/factory-shipments/create">
              <Button
                size="lg"
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <Plus className="mr-2 h-4 w-4" />
                创建发货订单
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 搜索和筛选 */}
      <Card className="shadow-md shadow-gray-200/50">
        <CardContent className="pt-6">
          <UnifiedSearchBar
            // 搜索配置
            searchValue={searchTerm}
            onSearchChange={handleSearch}
            searchPlaceholder="搜索集装箱号码或订单编号..."
            debounceDelay={400}
            // 筛选器配置
            filters={[
              {
                key: 'status',
                label: '状态',
                options: [
                  { label: '全部状态', value: 'all' },
                  ...Object.entries(FACTORY_SHIPMENT_STATUS_LABELS).map(
                    ([status, label]) => ({
                      label,
                      value: status,
                    })
                  ),
                ],
                width: 'w-full sm:w-48',
              },
            ]}
            filterValues={{
              status: statusFilter,
            }}
            onFilterChange={handleFilterChange}
          />
        </CardContent>
      </Card>

      {/* 订单列表 */}
      <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
        {orders.length === 0 ? (
          <div className="py-8 text-center">
            <Package className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              暂无厂家发货订单
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              开始创建您的第一个厂家发货订单
            </p>
            <div className="mt-6">
              <Link href="/factory-shipments/create">
                <Button
                  size="lg"
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  创建发货订单
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>订单编号</TableHead>
                <TableHead>集装箱号码</TableHead>
                <TableHead>客户</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>订单金额</TableHead>
                <TableHead>应收金额</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(order => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer transition-colors hover:bg-blue-50/50"
                  onClick={() => onOrderSelect?.(order)}
                >
                  <TableCell className="font-mono font-medium text-blue-600">
                    <Link
                      href={`/factory-shipments/${order.id}`}
                      className="hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      {order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {order.containerNumber || (
                      <span className="text-gray-400">未填写</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
                    {order.customer?.name || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(order.status)}>
                      {
                        FACTORY_SHIPMENT_STATUS_LABELS[
                          order.status as FactoryShipmentStatus
                        ]
                      }
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(order.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAmount(order.receivableAmount)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={e => {
                        e.stopPropagation();
                        onOrderSelect?.(order);
                      }}
                      title="查看详情"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 分页 */}
      {pagination && (
        <div className="mt-4">
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
  );
}
