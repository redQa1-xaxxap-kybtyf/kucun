'use client';

// 付款记录管理页面
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import {
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  Filter,
  Plus,
  Search,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
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
import { usePaymentOutRecords } from '@/lib/api/payables';
import {
  type PaymentOutMethod,
  type PaymentOutRecordQuery,
  type PaymentOutStatus,
  PAYMENT_OUT_METHOD_LABELS,
  PAYMENT_OUT_STATUS_LABELS,
  PAYMENT_OUT_STATUS_VARIANTS,
} from '@/lib/types/payable';
import { formatCurrency } from '@/lib/utils/format';

export default function PaymentsOutPage() {
  const router = useRouter();
  const [query, setQuery] = useState<PaymentOutRecordQuery>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 获取付款记录列表
  const { data: paymentsData, isLoading: paymentsLoading } =
    usePaymentOutRecords(query);

  // 处理搜索
  const handleSearch = (search: string) => {
    setQuery(prev => ({ ...prev, search, page: 1 }));
  };

  // 处理状态筛选
  const handleStatusFilter = (status: string) => {
    setQuery(prev => ({
      ...prev,
      status: status === 'all' ? undefined : (status as PaymentOutStatus),
      page: 1,
    }));
  };

  // 处理付款方式筛选
  const handleMethodFilter = (paymentMethod: string) => {
    setQuery(prev => ({
      ...prev,
      paymentMethod:
        paymentMethod === 'all'
          ? undefined
          : (paymentMethod as PaymentOutMethod),
      page: 1,
    }));
  };

  // 处理排序
  const handleSort = (sortBy: string) => {
    setQuery(prev => ({
      ...prev,
      sortBy: sortBy as 'createdAt' | 'paymentAmount' | 'paymentDate',
      page: 1,
    }));
  };

  // 模拟统计数据
  const summary = {
    totalAmount:
      paymentsData?.data?.reduce((sum, p) => sum + p.paymentAmount, 0) || 0,
    confirmedAmount:
      paymentsData?.data
        ?.filter(p => p.status === 'confirmed')
        .reduce((sum, p) => sum + p.paymentAmount, 0) || 0,
    pendingAmount:
      paymentsData?.data
        ?.filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.paymentAmount, 0) || 0,
    recordCount: paymentsData?.data?.length || 0,
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">付款记录</h1>
          <p className="text-muted-foreground">管理对供应商的付款记录</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
          <Button onClick={() => router.push('/finance/payments-out/create')}>
            <Plus className="mr-2 h-4 w-4" />
            新建付款
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总付款金额</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.recordCount} 条付款记录
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已确认金额</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.confirmedAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.totalAmount > 0
                ? Math.round(
                    (summary.confirmedAmount / summary.totalAmount) * 100
                  )
                : 0}
              % 确认率
            </p>
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
            <p className="text-xs text-muted-foreground">待财务确认</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月付款</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary.confirmedAmount)}
            </div>
            <p className="text-xs text-muted-foreground">较上月增长 8%</p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <CardTitle>付款记录列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索付款单号或供应商名称..."
                  value={query.search || ''}
                  onChange={e => handleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={query.status || 'all'}
                onValueChange={handleStatusFilter}
              >
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待确认</SelectItem>
                  <SelectItem value="confirmed">已确认</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>

              {/* 付款方式筛选 */}
              <Select
                value={query.paymentMethod || 'all'}
                onValueChange={handleMethodFilter}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="付款方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部方式</SelectItem>
                  <SelectItem value="cash">现金</SelectItem>
                  <SelectItem value="bank_transfer">银行转账</SelectItem>
                  <SelectItem value="check">支票</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>

              {/* 排序选择器 */}
              <Select
                value={query.sortBy || 'createdAt'}
                onValueChange={handleSort}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">创建时间</SelectItem>
                  <SelectItem value="paymentAmount">付款金额</SelectItem>
                  <SelectItem value="paymentDate">付款日期</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 付款记录列表 */}
          <div className="mt-6 space-y-4">
            {paymentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">加载中...</div>
              </div>
            ) : !paymentsData?.data?.length ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <DollarSign className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">暂无付款记录</p>
                </div>
              </div>
            ) : (
              <>
                {paymentsData.data.map(payment => (
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
                            <Badge
                              variant={
                                PAYMENT_OUT_STATUS_VARIANTS[payment.status]
                              }
                            >
                              {PAYMENT_OUT_STATUS_LABELS[payment.status]}
                            </Badge>
                            <Badge variant="outline">
                              {PAYMENT_OUT_METHOD_LABELS[payment.paymentMethod]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            供应商：{payment.supplier.name}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>
                              付款日期：
                              {new Date(
                                payment.paymentDate
                              ).toLocaleDateString()}
                            </span>
                            {payment.payableRecord && (
                              <span>
                                关联应付款：
                                {payment.payableRecord.payableNumber}
                              </span>
                            )}
                          </div>
                          {payment.voucherNumber && (
                            <p className="text-sm text-muted-foreground">
                              凭证号：{payment.voucherNumber}
                            </p>
                          )}
                          {payment.remarks && (
                            <p className="text-sm text-muted-foreground">
                              备注：{payment.remarks}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2 text-right">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              付款金额
                            </p>
                            <p className="font-semibold text-green-600">
                              {formatCurrency(payment.paymentAmount)}
                            </p>
                          </div>
                          {payment.payableRecord && (
                            <div>
                              <p className="text-sm text-muted-foreground">
                                剩余应付
                              </p>
                              <p className="font-semibold text-orange-600">
                                {formatCurrency(
                                  payment.payableRecord.remainingAmount
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/finance/payments-out/${payment.id}`)
                          }
                        >
                          查看详情
                        </Button>
                        {payment.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/finance/payments-out/${payment.id}/edit`
                              )
                            }
                          >
                            编辑
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>

          {/* 分页 */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              共 {paymentsData?.pagination?.total || 0} 条记录
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                上一页
              </Button>
              <Button variant="outline" size="sm" disabled>
                下一页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
