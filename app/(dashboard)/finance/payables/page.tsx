'use client';

// 应付款管理页面
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { Download, Eye, Plus, Search } from 'lucide-react';
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
    <div className="container mx-auto max-w-7xl px-4 py-6">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">应付款管理</h1>
          <p className="text-gray-600">管理供应商应付款和付款记录</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
          <Button
            size="sm"
            onClick={() => router.push('/finance/payables/create')}
          >
            <Plus className="mr-2 h-4 w-4" />
            新建应付款
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总应付金额</p>
                <p className="text-2xl font-bold">
                  {statisticsLoading
                    ? '加载中...'
                    : formatCurrency(statistics?.totalPayables || 0)}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <div className="h-4 w-4 rounded-full bg-red-500" />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {statistics?.pendingCount || 0} 个待付款
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">已付金额</p>
                <p className="text-2xl font-bold">
                  {statisticsLoading
                    ? '加载中...'
                    : formatCurrency(statistics?.totalPaidAmount || 0)}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <div className="h-4 w-4 rounded-full bg-green-500" />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {statistics?.paidCount || 0} 个已完成
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">剩余应付</p>
                <p className="text-2xl font-bold">
                  {statisticsLoading
                    ? '加载中...'
                    : formatCurrency(statistics?.totalRemainingAmount || 0)}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100">
                <div className="h-4 w-4 rounded-full bg-yellow-500" />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">待处理金额</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">逾期金额</p>
                <p className="text-2xl font-bold">
                  {statisticsLoading
                    ? '加载中...'
                    : formatCurrency(statistics?.overdueAmount || 0)}
                </p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <div className="h-4 w-4 rounded-full bg-red-600" />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {statistics?.overdueCount || 0} 个逾期
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 筛选和搜索 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            筛选条件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="text-sm font-medium">搜索</label>
              <Input
                placeholder="应付款单号或供应商名称"
                value={query.search || ''}
                onChange={e => handleSearch(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">状态</label>
              <Select
                value={query.status || 'all'}
                onValueChange={handleStatusFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待付款</SelectItem>
                  <SelectItem value="partial">部分付款</SelectItem>
                  <SelectItem value="paid">已付款</SelectItem>
                  <SelectItem value="overdue">逾期</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">来源类型</label>
              <Select
                value={query.sourceType || 'all'}
                onValueChange={handleSourceTypeFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="purchase_order">采购订单</SelectItem>
                  <SelectItem value="factory_shipment">厂家发货</SelectItem>
                  <SelectItem value="service">服务费用</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">排序方式</label>
              <Select
                value={query.sortBy || 'createdAt'}
                onValueChange={handleSort}
              >
                <SelectTrigger>
                  <SelectValue placeholder="创建时间" />
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
        </CardContent>
      </Card>

      {/* 应付款列表 */}
      <Card>
        <CardHeader>
          <CardTitle>应付款列表</CardTitle>
        </CardHeader>
        <CardContent>
          {payablesLoading ? (
            <div className="py-8 text-center">正在加载应付款记录...</div>
          ) : !payablesData?.data?.length ? (
            <div className="py-8 text-center text-gray-500">暂无应付款记录</div>
          ) : (
            <div className="space-y-4">
              {payablesData.data.map(payable => (
                <Card key={payable.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
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
                        <p className="mb-1 text-sm text-gray-600">
                          供应商：{payable.supplier.name}
                        </p>
                        {payable.sourceNumber && (
                          <p className="mb-1 text-sm text-gray-600">
                            来源单号：{payable.sourceNumber}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
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
                      </div>
                      <div className="text-right">
                        <div className="space-y-1">
                          <div>
                            <span className="text-sm text-gray-500">
                              应付金额
                            </span>
                            <p className="font-semibold">
                              {formatCurrency(payable.payableAmount)}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500">
                              已付金额
                            </span>
                            <p className="font-semibold text-green-600">
                              {formatCurrency(payable.paidAmount)}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500">
                              剩余金额
                            </span>
                            <p className="font-semibold text-red-600">
                              {formatCurrency(payable.remainingAmount)}
                            </p>
                          </div>
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
                        <Eye className="mr-2 h-4 w-4" />
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
            </div>
          )}

          {/* 分页 */}
          {payablesData && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                共 {payablesData.pagination.total} 条记录
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
