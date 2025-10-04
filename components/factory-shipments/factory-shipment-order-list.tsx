'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Eye, Package, Plus, Search, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { paginationConfig } from '@/lib/env';
import { queryKeys } from '@/lib/queryKeys';
import {
  FACTORY_SHIPMENT_STATUS_LABELS,
  type FactoryShipmentOrder,
  type FactoryShipmentStatus,
} from '@/lib/types/factory-shipment';

interface FactoryShipmentOrderListProps {
  onOrderSelect?: (order: FactoryShipmentOrder) => void;
}

interface FetchOrdersParams {
  page: number;
  pageSize: number;
  containerNumber?: string;
  status?: FactoryShipmentStatus;
}

interface OrdersResponse {
  orders: FactoryShipmentOrder[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

// 模拟API调用 - 后续替换为真实API
const fetchFactoryShipmentOrders = async (
  _params?: FetchOrdersParams
): Promise<OrdersResponse> =>
  // TODO: 实现真实API调用
  ({
    orders: [],
    pagination: {
      page: 1,
      pageSize: paginationConfig.defaultPageSize,
      totalCount: 0,
      totalPages: 0,
    },
  });
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
  const currentPage = 1;

  // 查询厂家发货订单列表
  const { data, isLoading, error } = useQuery<OrdersResponse>({
    queryKey: queryKeys.factoryShipments.ordersList({
      page: currentPage,
      search: searchTerm,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    queryFn: () =>
      fetchFactoryShipmentOrders({
        page: currentPage,
        pageSize: paginationConfig.defaultPageSize,
        containerNumber: searchTerm,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  });

  const orders = data?.orders || [];
  const pagination = data?.pagination;

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            加载厂家发货订单失败，请稍后重试
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">厂家发货管理</h1>
          <p className="text-muted-foreground">
            管理厂家直发订单，支持多供应商和临时商品
          </p>
        </div>
        <Link href="/factory-shipments/create">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            创建发货订单
          </Button>
        </Link>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="搜索集装箱号码或订单编号..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select
              value={statusFilter}
              onValueChange={value =>
                setStatusFilter(value as FactoryShipmentStatus | 'all')
              }
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(FACTORY_SHIPMENT_STATUS_LABELS).map(
                  ([status, label]) => (
                    <SelectItem key={status} value={status}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 订单列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            厂家发货订单列表
            {pagination && (
              <Badge variant="outline">共 {pagination.totalCount} 条记录</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
            </div>
          ) : orders.length === 0 ? (
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
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    创建发货订单
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/factory-shipments/${order.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {order.containerNumber || (
                          <span className="text-gray-400">未填写</span>
                        )}
                      </TableCell>
                      <TableCell>{order.customer?.name || '-'}</TableCell>
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
                      <TableCell>{formatDate(order.createdAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOrderSelect?.(order)}
                          title="查看详情"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
