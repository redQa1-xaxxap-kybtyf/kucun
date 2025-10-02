'use client';

// 应付款管理页面
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import {
    AlertCircle,
    CheckCircle,
    Clock,
    DollarSign,
    Download,
    Filter,
    Plus,
    Search,
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
import { usePayableRecords, usePayableStatistics } from '@/lib/api/payables';
import {
    type PayableRecordQuery,
    type PayableSourceType,
    type PayableStatus,
    PAYABLE_SOURCE_TYPE_LABELS,
    PAYABLE_STATUS_LABELS,
    PAYABLE_STATUS_VARIANTS,
} from '@/lib/types/payable';
import { formatCurrency } from '@/lib/utils/format';

export default function PayablesPage() {
  const router = useRouter();
  const [query, setQuery] = useState<PayableRecordQuery>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 获取应付款统计数据
  const { data: statistics, isLoading: statisticsLoading } =
    usePayableStatistics();

  // 获取应付款记录列表
  const { data: payablesData, isLoading: payablesLoading } =
    usePayableRecords(query);

  // 处理搜索
  const handleSearch = (search: string) => {
    setQuery(prev => ({ ...prev, search, page: 1 }));
  };

  // 处理状态筛选
  const handleStatusFilter = (status: string) => {
    setQuery(prev => ({
      ...prev,
      status: status === 'all' ? undefined : (status as PayableStatus),
      page: 1,
    }));
  };

  // 处理来源类型筛选
  const handleSourceTypeFilter = (sourceType: string) => {
    setQuery(prev => ({
      ...prev,
      sourceType:
        sourceType === 'all' ? undefined : (sourceType as PayableSourceType),
      page: 1,
    }));
  };

  // 处理排序
  const handleSort = (sortBy: string) => {
    setQuery(prev => ({
      ...prev,
      sortBy: sortBy as
        | 'createdAt'
        | 'payableAmount'
        | 'dueDate'
        | 'remainingAmount',
      page: 1,
    }));
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">应付款管理</h1>
          <p className="text-muted-foreground">管理供应商应付款和付款记录</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
          <Button onClick={() => router.push('/finance/payables/create')}>
            <Plus className="mr-2 h-4 w-4" />
            新建应付款
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应付金额</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statisticsLoading
                ? '加载中...'
                : formatCurrency(statistics?.totalPayables || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {(statistics?.pendingCount || 0) + (statistics?.paidCount || 0) + (statistics?.overdueCount || 0)} 个应付订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已付金额</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {statisticsLoading
                ? '加载中...'
                : formatCurrency(statistics?.totalPaidAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              付款率{' '}
              {statistics?.totalPayables
                ? Math.round(
                    ((statistics?.totalPaidAmount || 0) /
                      statistics.totalPayables) *
                      100
                  )
                : 0}
              %
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">剩余应付</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {statisticsLoading
                ? '加载中...'
                : formatCurrency(statistics?.totalRemainingAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">待付款金额</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">逾期金额</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {statisticsLoading
                ? '加载中...'
                : formatCurrency(statistics?.overdueAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {statistics?.overdueCount || 0} 个逾期订单
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <CardTitle>应付款列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索应付款单号或供应商名称..."
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
                  <SelectItem value="pending">待付款</SelectItem>
                  <SelectItem value="partial">部分付款</SelectItem>
                  <SelectItem value="paid">已付款</SelectItem>
                  <SelectItem value="overdue">逾期</SelectItem>
                </SelectContent>
              </Select>

              {/* 来源类型筛选 */}
              <Select
                value={query.sourceType || 'all'}
                onValueChange={handleSourceTypeFilter}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="来源类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="purchase_order">采购订单</SelectItem>
                  <SelectItem value="factory_shipment">厂家发货</SelectItem>
                  <SelectItem value="service">服务费用</SelectItem>
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
                  <SelectItem value="payableAmount">应付金额</SelectItem>
                  <SelectItem value="dueDate">到期日期</SelectItem>
                  <SelectItem value="remainingAmount">剩余金额</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 应付款列表 */}
          <div className="mt-6 space-y-4">
            {payablesLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">加载中...</div>
              </div>
            ) : !payablesData?.data?.length ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <DollarSign className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">暂无应付款记录</p>
                </div>
              </div>
            ) : (
              <>
                {payablesData.data.map(payable => (
                  <Card
                    key={payable.id}
                    className="transition-shadow hover:shadow-md"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold">
                              {payable.payableNumber}
                            </h3>
                            <Badge
                              variant={PAYABLE_STATUS_VARIANTS[payable.status]}
                            >
                              {PAYABLE_STATUS_LABELS[payable.status]}
                            </Badge>
                            <Badge variant="outline">
                              {PAYABLE_SOURCE_TYPE_LABELS[payable.sourceType]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            供应商：{payable.supplier.name}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>
                              创建时间：
                              {new Date(payable.createdAt).toLocaleDateString()}
                            </span>
                            {payable.dueDate && (
                              <span>
                                到期日期：
                                {new Date(payable.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {payable.sourceNumber && (
                            <p className="text-sm text-muted-foreground">
                              来源单号：{payable.sourceNumber}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2 text-right">
                          <div>
                            <p className="text-sm text-muted-foreground">
                              应付金额
                            </p>
                            <p className="font-semibold">
                              {formatCurrency(payable.payableAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              已付金额
                            </p>
                            <p className="font-semibold text-green-600">
                              {formatCurrency(payable.paidAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">
                              待付金额
                            </p>
                            <p className="font-semibold text-orange-600">
                              {formatCurrency(payable.remainingAmount)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/finance/payables/${payable.id}`)
                          }
                        >
                          查看详情
                        </Button>
                        {payable.remainingAmount > 0 && (
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/finance/payments-out/create?payableId=${payable.id}`
                              )
                            }
                          >
                            付款
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
              共 {payablesData?.pagination?.total || 0} 条记录
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
