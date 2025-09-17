// 收款记录列表组件
// 实现收款记录的列表展示，支持搜索、筛选、分页功能

'use client';

import { format } from 'date-fns';
import {
    Check,
    DollarSign,
    Edit,
    Eye,
    MoreHorizontal,
    RefreshCw,
    Search,
    Trash2,
    X
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
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
import { paymentUtils } from '@/lib/api/payments';
import type {
    PaymentRecordDetail,
    PaymentRecordQuery
} from '@/lib/types/payment';
import {
    DEFAULT_PAYMENT_METHODS,
    DEFAULT_PAYMENT_STATUSES,
} from '@/lib/types/payment';
import { cn } from '@/lib/utils';

// 使用T11移动端组件

export interface PaymentListProps {
  payments: PaymentRecordDetail[];
  total: number;
  page: number;
  pageSize: number;
  query: PaymentRecordQuery;
  loading?: boolean;
  onQueryChange: (query: Partial<PaymentRecordQuery>) => void;
  onView?: (payment: PaymentRecordDetail) => void;
  onEdit?: (payment: PaymentRecordDetail) => void;
  onDelete?: (payment: PaymentRecordDetail) => void;
  onConfirm?: (payment: PaymentRecordDetail) => void;
  onCancel?: (payment: PaymentRecordDetail) => void;
  onRefresh?: () => void;
  className?: string;
}

const PaymentList = React.forwardRef<HTMLDivElement, PaymentListProps>(
  (
    {
      payments,
      total,
      page,
      pageSize,
      query,
      loading = false,
      onQueryChange,
      onView,
      onEdit,
      onDelete,
      onConfirm,
      onCancel,
      onRefresh,
      className,
      ...props
    },
    ref
  ) => {
    // 搜索和筛选状态
    const [searchValue, setSearchValue] = React.useState(query.search || '');
    const [isFiltering, setIsFiltering] = React.useState(false);

    // 处理搜索
    const handleSearch = (value: string) => {
      setSearchValue(value);
      onQueryChange({ search: value, page: 1 });
    };

    // 处理筛选
    const handleFilter = (key: keyof PaymentRecordQuery, value: any) => {
      onQueryChange({ [key]: value, page: 1 });
    };

    // 处理分页
    const handlePageChange = (newPage: number) => {
      onQueryChange({ page: newPage });
    };

    // 处理页面大小变化
    const handlePageSizeChange = (newPageSize: number) => {
      onQueryChange({ pageSize: newPageSize, page: 1 });
    };

    // 处理排序
    const handleSort = (sortBy: string, sortOrder: 'asc' | 'desc') => {
      onQueryChange({ sortBy: sortBy as any, sortOrder });
    };

    // 桌面端表格列定义
    const columns = [
      {
        key: 'paymentNumber',
        title: '收款单号',
        width: '120px',
        render: (payment: PaymentRecordDetail) => (
          <div className="font-medium">{payment.paymentNumber}</div>
        ),
      },
      {
        key: 'salesOrder',
        title: '销售订单',
        width: '120px',
        render: (payment: PaymentRecordDetail) => (
          <Link
            href={`/sales-orders/${payment.salesOrder.id}`}
            className="text-blue-600 hover:text-blue-800 hover:underline"
          >
            {payment.salesOrder.orderNumber}
          </Link>
        ),
      },
      {
        key: 'customer',
        title: '客户',
        width: '150px',
        render: (payment: PaymentRecordDetail) => (
          <div>
            <div className="font-medium">{payment.customer.name}</div>
            {payment.customer.phone && (
              <div className="text-sm text-muted-foreground">
                {payment.customer.phone}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'paymentMethod',
        title: '收款方式',
        width: '100px',
        render: (payment: PaymentRecordDetail) => (
          <div className="flex items-center space-x-2">
            <span>
              {paymentUtils.getPaymentMethodIcon(payment.paymentMethod)}
            </span>
            <span>
              {paymentUtils.formatPaymentMethod(payment.paymentMethod)}
            </span>
          </div>
        ),
      },
      {
        key: 'paymentAmount',
        title: '收款金额',
        width: '120px',
        align: 'right' as const,
        render: (payment: PaymentRecordDetail) => (
          <div className="font-medium text-green-600">
            {paymentUtils.formatAmount(payment.paymentAmount)}
          </div>
        ),
      },
      {
        key: 'paymentDate',
        title: '收款日期',
        width: '100px',
        render: (payment: PaymentRecordDetail) => (
          <div className="text-sm">
            {format(new Date(payment.paymentDate), 'yyyy-MM-dd')}
          </div>
        ),
      },
      {
        key: 'status',
        title: '状态',
        width: '80px',
        render: (payment: PaymentRecordDetail) => (
          <Badge
            variant="outline"
            className={cn(
              `text-${paymentUtils.getPaymentStatusColor(payment.status)}-600`,
              `border-${paymentUtils.getPaymentStatusColor(payment.status)}-200`
            )}
          >
            {paymentUtils.formatPaymentStatus(payment.status)}
          </Badge>
        ),
      },
      {
        key: 'user',
        title: '操作人',
        width: '100px',
        render: (payment: PaymentRecordDetail) => (
          <div className="text-sm">{payment.user.name}</div>
        ),
      },
      {
        key: 'actions',
        title: '操作',
        width: '80px',
        render: (payment: PaymentRecordDetail) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>操作</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onView && (
                <DropdownMenuItem onClick={() => onView(payment)}>
                  <Eye className="mr-2 h-4 w-4" />
                  查看详情
                </DropdownMenuItem>
              )}
              {onEdit && payment.status === 'pending' && (
                <DropdownMenuItem onClick={() => onEdit(payment)}>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
              )}
              {onConfirm && payment.status === 'pending' && (
                <DropdownMenuItem onClick={() => onConfirm(payment)}>
                  <Check className="mr-2 h-4 w-4" />
                  确认收款
                </DropdownMenuItem>
              )}
              {onCancel && payment.status === 'pending' && (
                <DropdownMenuItem onClick={() => onCancel(payment)}>
                  <X className="mr-2 h-4 w-4" />
                  取消收款
                </DropdownMenuItem>
              )}
              {onDelete && payment.status !== 'confirmed' && (
                <DropdownMenuItem
                  onClick={() => onDelete(payment)}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ];

    // 移动端卡片渲染
    const renderMobileCard = (payment: PaymentRecordDetail) => (
      <Card key={payment.id} className="mb-4">
        <CardContent className="p-4">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="text-sm font-medium">{payment.paymentNumber}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {format(new Date(payment.paymentDate), 'yyyy-MM-dd HH:mm')}
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                `text-${paymentUtils.getPaymentStatusColor(payment.status)}-600`,
                `border-${paymentUtils.getPaymentStatusColor(payment.status)}-200`
              )}
            >
              {paymentUtils.formatPaymentStatus(payment.status)}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">销售订单:</span>
              <Link
                href={`/sales-orders/${payment.salesOrder.id}`}
                className="text-blue-600 hover:text-blue-800"
              >
                {payment.salesOrder.orderNumber}
              </Link>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">客户:</span>
              <span className="font-medium">{payment.customer.name}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">收款方式:</span>
              <div className="flex items-center space-x-1">
                <span>
                  {paymentUtils.getPaymentMethodIcon(payment.paymentMethod)}
                </span>
                <span>
                  {paymentUtils.formatPaymentMethod(payment.paymentMethod)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">收款金额:</span>
              <span className="font-medium text-green-600">
                {paymentUtils.formatAmount(payment.paymentAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">操作人:</span>
              <span>{payment.user.name}</span>
            </div>
          </div>

          {/* 移动端操作按钮 */}
          <div className="mt-4 flex items-center justify-end space-x-2 border-t pt-3">
            {onView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(payment)}
              >
                <Eye className="mr-1 h-3 w-3" />
                查看
              </Button>
            )}
            {onEdit && payment.status === 'pending' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(payment)}
              >
                <Edit className="mr-1 h-3 w-3" />
                编辑
              </Button>
            )}
            {onConfirm && payment.status === 'pending' && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onConfirm(payment)}
              >
                <Check className="mr-1 h-3 w-3" />
                确认
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );

    if (loading) {
      return <PaymentListSkeleton />;
    }

    return (
      <div className={cn('space-y-4', className)} ref={ref} {...props}>
        {/* 搜索和筛选栏 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-x-4 md:space-y-0">
              {/* 搜索框 */}
              <div className="max-w-md flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索收款单号、客户名称..."
                    value={searchValue}
                    onChange={e => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* 筛选器 */}
              <div className="flex items-center space-x-2">
                {/* 收款方式筛选 */}
                <Select
                  value={query.paymentMethod || ''}
                  onValueChange={value =>
                    handleFilter('paymentMethod', value || undefined)
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="收款方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部方式</SelectItem>
                    {DEFAULT_PAYMENT_METHODS.filter(
                      method => method.isActive
                    ).map(method => (
                      <SelectItem key={method.method} value={method.method}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 状态筛选 */}
                <Select
                  value={query.status || ''}
                  onValueChange={value =>
                    handleFilter('status', value || undefined)
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部状态</SelectItem>
                    {DEFAULT_PAYMENT_STATUSES.filter(
                      status => status.isActive
                    ).map(status => (
                      <SelectItem key={status.status} value={status.status}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 刷新按钮 */}
                {onRefresh && (
                  <Button variant="outline" size="sm" onClick={onRefresh}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 数据列表 */}
        {payments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <DollarSign className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">暂无收款记录</p>
            </CardContent>
          </Card>
        ) : (
          <MobileDataTable
            data={payments}
            columns={columns}
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onSort={handleSort}
            renderMobileCard={renderMobileCard}
            loading={loading}
          />
        )}
      </div>
    );
  }
);

PaymentList.displayName = 'PaymentList';

// 加载骨架屏
function PaymentListSkeleton() {
  return (
    <div className="space-y-4">
      {/* 搜索筛选骨架屏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-x-4 md:space-y-0">
            <Skeleton className="h-10 w-full max-w-md" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 表格骨架屏 */}
      <Card>
        <CardContent className="p-0">
          <div className="space-y-4 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { PaymentList };
