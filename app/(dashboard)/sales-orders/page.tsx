'use client';

import { useQuery } from '@tanstack/react-query';
import {
    Calendar,
    DollarSign,
    Edit,
    Eye,
    MoreHorizontal,
    Plus,
    Search,
    ShoppingCart,
    Trash2,
    User
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

// UI Components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { MobileDataTable } from '@/components/ui/mobile-data-table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

// API and Types
import { getSalesOrders, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import type { SalesOrder, SalesOrderQueryParams, SalesOrderStatus } from '@/lib/types/sales-order';
import {
    SALES_ORDER_STATUS_LABELS,
    SALES_ORDER_STATUS_VARIANTS,
} from '@/lib/types/sales-order';

/**
 * 销售订单页面
 * 严格遵循全栈项目统一约定规范
 */
export default function SalesOrdersPage() {
  const router = useRouter();
  const [queryParams, setQueryParams] = React.useState<SalesOrderQueryParams>({
    page: 1,
    limit: 20,
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
  const handleFilter = (key: keyof SalesOrderQueryParams, value: any) => {
    setQueryParams(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // 分页处理
  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
  };

  // 状态标签渲染
  const getStatusBadge = (status: string) => {
    const variant = SALES_ORDER_STATUS_VARIANTS[status as SalesOrderStatus] || 'outline';
    return (
      <Badge variant={variant}>
        {SALES_ORDER_STATUS_LABELS[status as SalesOrderStatus] || status}
      </Badge>
    );
  };

  // 格式化金额
  const formatAmount = (amount?: number) => {
    if (!amount) return '¥0.00';
    return `¥${amount.toFixed(2)}`;
  };

  // 移动端表格列配置
  const mobileColumns = [
    { key: 'orderNumber', title: '订单号', mobilePrimary: true },
    {
      key: 'customer',
      title: '客户',
      render: (item: SalesOrder) => item.customer?.name || '-',
    },
    {
      key: 'status',
      title: '状态',
      render: (item: SalesOrder) => getStatusBadge(item.status),
    },
    {
      key: 'totalAmount',
      title: '金额',
      render: (item: SalesOrder) => formatAmount(item.totalAmount),
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">销售订单</h1>
          <p className="text-muted-foreground">
            管理所有销售订单和客户订单信息
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              加载失败: {error instanceof Error ? error.message : '未知错误'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">销售订单</h1>
          <p className="text-muted-foreground">
            管理所有销售订单和客户订单信息
          </p>
        </div>
        <Button onClick={() => router.push('/sales-orders/create')}>
          <Plus className="mr-2 h-4 w-4" />
          新建订单
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索订单号或客户名称..."
                  value={queryParams.search}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select
                value={queryParams.status || 'all'}
                onValueChange={value =>
                  handleFilter('status', value === 'all' ? undefined : value)
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
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
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">创建时间</SelectItem>
                  <SelectItem value="orderNumber">订单号</SelectItem>
                  <SelectItem value="totalAmount">订单金额</SelectItem>
                  <SelectItem value="updatedAt">更新时间</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 销售订单列表 */}
      <Card>
        <CardHeader>
          <CardTitle>订单列表</CardTitle>
          <CardDescription>
            {data?.pagination
              ? `共 ${data.pagination.total} 个订单`
              : '加载中...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* 桌面端表格 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>订单号</TableHead>
                      <TableHead>客户</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>订单金额</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="w-[100px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data?.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            {order.orderNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {order.customer?.name || '-'}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            {formatAmount(order.totalAmount)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {new Date(order.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/sales-orders/${order.id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(`/sales-orders/${order.id}/edit`)
                                }
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
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
              </div>

              {/* 移动端卡片 */}
              <div className="md:hidden">
                <MobileDataTable
                  data={data?.data || []}
                  columns={mobileColumns}
                  onItemClick={item => router.push(`/sales-orders/${item.id}`)}
                  renderActions={item => (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/sales-orders/${item.id}`)
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(`/sales-orders/${item.id}/edit`)
                          }
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                />
              </div>

              {/* 分页 */}
              {data?.pagination && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    显示第{' '}
                    {(data.pagination.page - 1) * data.pagination.limit + 1} -{' '}
                    {Math.min(
                      data.pagination.page * data.pagination.limit,
                      data.pagination.total
                    )}{' '}
                    条，共 {data.pagination.total} 条
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(data.pagination.page - 1)}
                      disabled={data.pagination.page <= 1}
                    >
                      上一页
                    </Button>
                    <div className="text-sm">
                      第 {data.pagination.page} / {data.pagination.totalPages}{' '}
                      页
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(data.pagination.page + 1)}
                      disabled={
                        data.pagination.page >= data.pagination.totalPages
                      }
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
