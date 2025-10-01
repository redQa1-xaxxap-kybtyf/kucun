/**
 * 收款记录页面
 * 显示所有收款记录，支持筛选、搜索和分页
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  Filter,
  Plus,
  Search,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  receiptNumber?: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
  };
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PaymentSummary {
  totalAmount: number;
  confirmedAmount: number;
  pendingAmount: number;
  recordCount: number;
}

/**
 * 状态显示组件
 */
function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: '待确认', variant: 'secondary' as const, icon: Clock },
    confirmed: {
      label: '已确认',
      variant: 'secondary' as const,
      icon: CheckCircle,
    },
    cancelled: {
      label: '已取消',
      variant: 'destructive' as const,
      icon: XCircle,
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const IconComponent = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <IconComponent className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

/**
 * 收款方式显示组件
 */
function PaymentMethodBadge({ method }: { method: string }) {
  const methodConfig = {
    cash: { label: '现金', color: 'bg-green-100 text-green-800' },
    bank_transfer: { label: '银行转账', color: 'bg-blue-100 text-blue-800' },
    alipay: { label: '支付宝', color: 'bg-blue-100 text-blue-800' },
    wechat: { label: '微信支付', color: 'bg-green-100 text-green-800' },
    check: { label: '支票', color: 'bg-gray-100 text-gray-800' },
    other: { label: '其他', color: 'bg-gray-100 text-gray-800' },
  };

  const config =
    methodConfig[method as keyof typeof methodConfig] || methodConfig.other;

  return <Badge className={config.color}>{config.label}</Badge>;
}

/**
 * 收款记录页面组件
 */
export default function PaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 查询参数状态
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [paymentMethod, setPaymentMethod] = useState(
    searchParams.get('paymentMethod') || 'all'
  );
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize] = useState(20);

  // 获取收款记录数据
  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', { search, status, paymentMethod, page, pageSize }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('pageSize', pageSize.toString());
      if (search) params.set('search', search);
      if (status && status !== 'all') params.set('status', status);
      if (paymentMethod && paymentMethod !== 'all')
        params.set('paymentMethod', paymentMethod);

      const response = await fetch(`/api/payments?${params}`);
      if (!response.ok) {
        throw new Error('获取收款记录失败');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5分钟内认为数据是新鲜的
    refetchOnWindowFocus: false,
  });

  const payments: PaymentRecord[] = data?.data?.payments || [];
  const summary: PaymentSummary = data?.data?.summary || {
    totalAmount: 0,
    confirmedAmount: 0,
    pendingAmount: 0,
    recordCount: 0,
  };
  const pagination = data?.data?.pagination || { total: 0, pages: 0 };

  // 处理搜索
  const _handleSearch = () => {
    setPage(1);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status && status !== 'all') params.set('status', status);
    if (paymentMethod && paymentMethod !== 'all')
      params.set('paymentMethod', paymentMethod);
    router.push(`/finance/payments?${params}`);
  };

  // 重置筛选
  const _handleReset = () => {
    setSearch('');
    setStatus('all');
    setPaymentMethod('all');
    setPage(1);
    router.push('/finance/payments');
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">收款记录</h1>
          <p className="text-gray-600">管理和查看所有收款记录</p>
        </div>
        <Button asChild>
          <Link href="/finance/payments/create">
            <Plus className="mr-2 h-4 w-4" />
            新建收款
          </Link>
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总收款金额</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.recordCount} 条收款记录
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已确认金额</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(summary.confirmedAmount)}
            </div>
            <p className="text-xs text-muted-foreground">已确认收款</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待确认金额</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(summary.pendingAmount)}
            </div>
            <p className="text-xs text-muted-foreground">待确认收款</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">确认率</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalAmount > 0
                ? Math.round(
                    (summary.confirmedAmount / summary.totalAmount) * 100
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">收款确认率</p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选和搜索 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium">搜索</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="收款单号、客户名称..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">状态</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待确认</SelectItem>
                  <SelectItem value="confirmed">已确认</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">收款方式</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="全部方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部方式</SelectItem>
                  <SelectItem value="cash">现金</SelectItem>
                  <SelectItem value="bank_transfer">银行转账</SelectItem>
                  <SelectItem value="alipay">支付宝</SelectItem>
                  <SelectItem value="wechat">微信支付</SelectItem>
                  <SelectItem value="check">支票</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleSearch} className="flex-1">
                <Search className="mr-2 h-4 w-4" />
                搜索
              </Button>
              <Button variant="outline" onClick={handleReset}>
                重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 收款记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle>收款记录</CardTitle>
          <CardDescription>共 {pagination.total} 条记录</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-red-600">
                加载失败: {(error as Error).message}
              </div>
            </div>
          ) : !payments.length ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <DollarSign className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">暂无收款记录</p>
                <Button asChild className="mt-4">
                  <Link href="/finance/payments/create">
                    <Plus className="mr-2 h-4 w-4" />
                    创建第一条收款记录
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map(payment => (
                <Card
                  key={payment.id}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">
                            {payment.paymentNumber}
                          </h3>
                          <StatusBadge status={payment.status} />
                          <PaymentMethodBadge method={payment.paymentMethod} />
                        </div>

                        <div className="grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{payment.customer.name}</span>
                            {payment.customer.phone && (
                              <span className="text-gray-400">
                                ({payment.customer.phone})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>
                              {format(
                                new Date(payment.paymentDate),
                                'yyyy-MM-dd'
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="text-sm text-gray-600">
                          关联订单：{payment.salesOrder.orderNumber}
                          <span className="ml-2 text-gray-400">
                            (订单金额：
                            {formatCurrency(payment.salesOrder.totalAmount)})
                          </span>
                        </div>

                        {payment.remarks && (
                          <div className="text-sm text-gray-600">
                            备注：{payment.remarks}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(payment.paymentAmount)}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/finance/payments/${payment.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              查看详情
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* 分页 */}
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  共 {pagination.total} 条记录，第 {page} 页，共{' '}
                  {pagination.pages} 页
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= pagination.pages}
                    onClick={() => setPage(page + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
