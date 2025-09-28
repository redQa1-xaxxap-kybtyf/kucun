'use client';

// 付款记录管理页面
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
import { usePaymentOutRecords } from '@/lib/api/payables';
import {
  type PaymentOutRecordQuery,
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
      status: status === 'all' ? undefined : (status as any),
      page: 1,
    }));
  };

  // 处理付款方式筛选
  const handleMethodFilter = (paymentMethod: string) => {
    setQuery(prev => ({
      ...prev,
      paymentMethod:
        paymentMethod === 'all' ? undefined : (paymentMethod as any),
      page: 1,
    }));
  };

  // 处理排序
  const handleSort = (sortBy: string) => {
    setQuery(prev => ({ ...prev, sortBy: sortBy as any, page: 1 }));
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">付款记录</h1>
          <p className="text-gray-600">管理对供应商的付款记录</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
          <Button
            size="sm"
            onClick={() => router.push('/finance/payments-out/create')}
          >
            <Plus className="mr-2 h-4 w-4" />
            新建付款
          </Button>
        </div>
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
                placeholder="付款单号或供应商名称"
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
                  <SelectItem value="pending">待确认</SelectItem>
                  <SelectItem value="confirmed">已确认</SelectItem>
                  <SelectItem value="cancelled">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">付款方式</label>
              <Select
                value={query.paymentMethod || 'all'}
                onValueChange={handleMethodFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="全部方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部方式</SelectItem>
                  <SelectItem value="cash">现金</SelectItem>
                  <SelectItem value="bank_transfer">银行转账</SelectItem>
                  <SelectItem value="check">支票</SelectItem>
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
                  <SelectItem value="paymentAmount">付款金额</SelectItem>
                  <SelectItem value="paymentDate">付款日期</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 付款记录列表 */}
      <Card>
        <CardHeader>
          <CardTitle>付款记录列表</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="py-8 text-center">正在加载付款记录...</div>
          ) : !paymentsData?.data?.length ? (
            <div className="py-8 text-center text-gray-500">暂无付款记录</div>
          ) : (
            <div className="space-y-4">
              {paymentsData.data.map(payment => (
                <Card
                  key={payment.id}
                  className="border-l-4 border-l-green-500"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-3">
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
                        <p className="mb-1 text-sm text-gray-600">
                          供应商：{payment.supplier.name}
                        </p>
                        {payment.payableRecord && (
                          <p className="mb-1 text-sm text-gray-600">
                            关联应付款：{payment.payableRecord.payableNumber}
                          </p>
                        )}
                        {payment.voucherNumber && (
                          <p className="mb-1 text-sm text-gray-600">
                            凭证号：{payment.voucherNumber}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>
                            付款日期：
                            {new Date(payment.paymentDate).toLocaleDateString()}
                          </span>
                          <span>
                            创建时间：
                            {new Date(payment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {payment.remarks && (
                          <p className="mt-2 text-sm text-gray-600">
                            备注：{payment.remarks}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="space-y-1">
                          <div>
                            <span className="text-sm text-gray-500">
                              付款金额
                            </span>
                            <p className="text-xl font-bold text-green-600">
                              {formatCurrency(payment.paymentAmount)}
                            </p>
                          </div>
                          {payment.payableRecord && (
                            <div>
                              <span className="text-sm text-gray-500">
                                剩余应付
                              </span>
                              <p className="text-sm font-medium text-red-600">
                                {formatCurrency(
                                  payment.payableRecord.remainingAmount
                                )}
                              </p>
                            </div>
                          )}
                        </div>
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
                        <Eye className="mr-2 h-4 w-4" />
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
            </div>
          )}

          {/* 分页 */}
          {paymentsData && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                共 {paymentsData.pagination.total} 条记录
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
