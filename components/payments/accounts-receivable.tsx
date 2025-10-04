// 应收账款组件
// 实现应收账款查询和统计展示

'use client';

import { format } from 'date-fns';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Eye,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Progress } from '@/components/ui/progress';
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
  AccountsReceivable,
  AccountsReceivableQuery,
  PaymentStatistics,
} from '@/lib/types/payment';
import { cn } from '@/lib/utils';

// 使用T11移动端组件

export interface AccountsReceivableProps {
  receivables: AccountsReceivable[];
  statistics: PaymentStatistics;
  total: number;
  page: number;
  pageSize: number;
  query: AccountsReceivableQuery;
  loading?: boolean;
  onQueryChange: (query: Partial<AccountsReceivableQuery>) => void;
  onView?: (receivable: AccountsReceivable) => void;
  onCreatePayment?: (receivable: AccountsReceivable) => void;
  onRefresh?: () => void;
  className?: string;
}

const AccountsReceivableComponent = React.forwardRef<
  HTMLDivElement,
  AccountsReceivableProps
>(
  (
    {
      receivables,
      statistics,
      total,
      page,
      pageSize,
      query,
      loading = false,
      onQueryChange,
      onView,
      onCreatePayment,
      onRefresh,
      className,
      ...props
    },
    ref
  ) => {
    // 搜索状态
    const [searchValue, setSearchValue] = React.useState(query.search || '');

    // 处理搜索
    const handleSearch = (value: string) => {
      setSearchValue(value);
      onQueryChange({ search: value, page: 1 });
    };

    // 处理筛选
    const handleFilter = (
      key: keyof AccountsReceivableQuery,
      value: string | number | boolean | undefined
    ) => {
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
      onQueryChange({ sortBy, sortOrder });
    };

    // 获取付款状态配置
    const getPaymentStatusConfig = (status: string) => {
      const configs = {
        unpaid: { label: '未付款', color: 'red', icon: XCircle },
        partial: { label: '部分付款', color: 'yellow', icon: Clock },
        paid: { label: '已付款', color: 'green', icon: CheckCircle },
        overdue: { label: '已逾期', color: 'red', icon: AlertTriangle },
      };
      return configs[status as keyof typeof configs] || configs.unpaid;
    };

    // 桌面端表格列定义
    const columns = [
      {
        key: 'orderNumber',
        title: '销售订单',
        width: '120px',
        render: (receivable: AccountsReceivable) => (
          <Link
            href={`/sales-orders/${receivable.salesOrderId}`}
            className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            {receivable.orderNumber}
          </Link>
        ),
      },
      {
        key: 'customerName',
        title: '客户',
        width: '150px',
        render: (receivable: AccountsReceivable) => (
          <div className="font-medium">{receivable.customerName}</div>
        ),
      },
      {
        key: 'totalAmount',
        title: '订单金额',
        width: '120px',
        align: 'right' as const,
        render: (receivable: AccountsReceivable) => (
          <div className="font-medium">
            {paymentUtils.formatAmount(receivable.totalAmount)}
          </div>
        ),
      },
      {
        key: 'paidAmount',
        title: '已收金额',
        width: '120px',
        align: 'right' as const,
        render: (receivable: AccountsReceivable) => (
          <div className="font-medium text-green-600">
            {paymentUtils.formatAmount(receivable.paidAmount)}
          </div>
        ),
      },
      {
        key: 'remainingAmount',
        title: '应收金额',
        width: '120px',
        align: 'right' as const,
        render: (receivable: AccountsReceivable) => (
          <div className="font-medium text-orange-600">
            {paymentUtils.formatAmount(receivable.remainingAmount)}
          </div>
        ),
      },
      {
        key: 'paymentProgress',
        title: '收款进度',
        width: '120px',
        render: (receivable: AccountsReceivable) => {
          const progress = paymentUtils.calculatePaymentRate(
            receivable.totalAmount,
            receivable.paidAmount
          );
          return (
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <div className="text-muted-foreground text-center text-xs">
                {progress}%
              </div>
            </div>
          );
        },
      },
      {
        key: 'paymentStatus',
        title: '付款状态',
        width: '100px',
        render: (receivable: AccountsReceivable) => {
          const config = getPaymentStatusConfig(receivable.paymentStatus);
          const IconComponent = config.icon;
          return (
            <Badge
              variant="outline"
              className={cn(
                `text-${config.color}-600`,
                `border-${config.color}-200`
              )}
            >
              <IconComponent className="mr-1 h-3 w-3" />
              {config.label}
            </Badge>
          );
        },
      },
      {
        key: 'orderDate',
        title: '订单日期',
        width: '100px',
        render: (receivable: AccountsReceivable) => (
          <div className="text-sm">
            {format(new Date(receivable.orderDate), 'yyyy-MM-dd')}
          </div>
        ),
      },
      {
        key: 'overdueDays',
        title: '逾期天数',
        width: '80px',
        render: (receivable: AccountsReceivable) => (
          <div
            className={cn(
              'text-sm font-medium',
              receivable.overdueDays && receivable.overdueDays > 0
                ? 'text-red-600'
                : 'text-muted-foreground'
            )}
          >
            {receivable.overdueDays || 0}天
          </div>
        ),
      },
      {
        key: 'actions',
        title: '操作',
        width: '80px',
        render: (receivable: AccountsReceivable) => (
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
                <DropdownMenuItem onClick={() => onView(receivable)}>
                  <Eye className="mr-2 h-4 w-4" />
                  查看详情
                </DropdownMenuItem>
              )}
              {onCreatePayment && receivable.remainingAmount > 0 && (
                <DropdownMenuItem onClick={() => onCreatePayment(receivable)}>
                  <Plus className="mr-2 h-4 w-4" />
                  创建收款
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ];

    // 移动端卡片渲染
    const renderMobileCard = (receivable: AccountsReceivable) => {
      const config = getPaymentStatusConfig(receivable.paymentStatus);
      const IconComponent = config.icon;
      const progress = paymentUtils.calculatePaymentRate(
        receivable.totalAmount,
        receivable.paidAmount
      );

      return (
        <Card key={receivable.salesOrderId} className="mb-4">
          <CardContent className="p-4">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <Link
                  href={`/sales-orders/${receivable.salesOrderId}`}
                  className="font-medium text-blue-600 hover:text-blue-800"
                >
                  {receivable.orderNumber}
                </Link>
                <div className="text-muted-foreground mt-1 text-sm">
                  {receivable.customerName}
                </div>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  `text-${config.color}-600`,
                  `border-${config.color}-200`
                )}
              >
                <IconComponent className="mr-1 h-3 w-3" />
                {config.label}
              </Badge>
            </div>

            <div className="space-y-3">
              {/* 金额信息 */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-muted-foreground">订单金额</div>
                  <div className="font-medium">
                    {paymentUtils.formatAmount(receivable.totalAmount)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">已收金额</div>
                  <div className="font-medium text-green-600">
                    {paymentUtils.formatAmount(receivable.paidAmount)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">应收金额</div>
                  <div className="font-medium text-orange-600">
                    {paymentUtils.formatAmount(receivable.remainingAmount)}
                  </div>
                </div>
              </div>

              {/* 收款进度 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">收款进度</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* 其他信息 */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">订单日期:</span>
                <span>
                  {format(new Date(receivable.orderDate), 'yyyy-MM-dd')}
                </span>
              </div>

              {receivable.overdueDays && receivable.overdueDays > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">逾期天数:</span>
                  <span className="font-medium text-red-600">
                    {receivable.overdueDays}天
                  </span>
                </div>
              )}
            </div>

            {/* 移动端操作按钮 */}
            <div className="mt-4 flex items-center justify-end space-x-2 border-t pt-3">
              {onView && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onView(receivable)}
                >
                  <Eye className="mr-1 h-3 w-3" />
                  查看
                </Button>
              )}
              {onCreatePayment && receivable.remainingAmount > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onCreatePayment(receivable)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  收款
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      );
    };

    if (loading) {
      return <AccountsReceivableSkeleton />;
    }

    return (
      <div className={cn('space-y-6', className)} ref={ref} {...props}>
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    总应收金额
                  </p>
                  <p className="text-2xl font-bold">
                    {paymentUtils.formatAmount(statistics.totalReceivable)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    已收金额
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {paymentUtils.formatAmount(statistics.totalReceived)}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    待收金额
                  </p>
                  <p className="text-2xl font-bold text-orange-600">
                    {paymentUtils.formatAmount(statistics.totalPending)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    收款率
                  </p>
                  <p className="text-2xl font-bold">
                    {statistics.paymentRate.toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 搜索和筛选栏 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-4">
              {/* 搜索框 */}
              <div className="max-w-md flex-1">
                <div className="relative">
                  <Search className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                  <Input
                    placeholder="搜索订单号、客户名称..."
                    value={searchValue}
                    onChange={e => handleSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* 筛选器 */}
              <div className="flex items-center space-x-2">
                {/* 付款状态筛选 */}
                <Select
                  value={query.paymentStatus || ''}
                  onValueChange={value =>
                    handleFilter('paymentStatus', value || undefined)
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="付款状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="unpaid">未付款</SelectItem>
                    <SelectItem value="partial">部分付款</SelectItem>
                    <SelectItem value="paid">已付款</SelectItem>
                    <SelectItem value="overdue">已逾期</SelectItem>
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
        {receivables.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <DollarSign className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground">暂无应收账款</p>
            </CardContent>
          </Card>
        ) : (
          <MobileDataTable
            data={receivables}
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

AccountsReceivableComponent.displayName = 'AccountsReceivableComponent';

// 加载骨架屏
function AccountsReceivableSkeleton() {
  return (
    <div className="space-y-6">
      {/* 统计卡片骨架屏 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-24" />
                </div>
                <Skeleton className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 搜索筛选骨架屏 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 md:space-x-4">
            <Skeleton className="h-10 w-full max-w-md" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-10 w-32" />
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
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export { AccountsReceivableComponent };
