'use client';

import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Edit,
  FileText,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { PayableRecordDetail } from '@/lib/types/payable';
import {
  PAYABLE_SOURCE_TYPE_LABELS,
  PAYABLE_STATUS_LABELS,
  PAYABLE_STATUS_VARIANTS,
  PAYMENT_OUT_METHOD_LABELS,
} from '@/lib/types/payable';
import { formatCurrency } from '@/lib/utils/format';

interface PayableDetailClientProps {
  payable: PayableRecordDetail;
}

/**
 * 应付款详情客户端组件
 * 展示应付款的详细信息和操作按钮
 */
export function PayableDetailClient({ payable }: PayableDetailClientProps) {
  const router = useRouter();

  const isOverdue =
    payable.dueDate &&
    new Date(payable.dueDate) < new Date() &&
    payable.status !== 'paid';

  const paymentProgress =
    payable.payableAmount > 0
      ? (payable.paidAmount / payable.payableAmount) * 100
      : 0;

  const canEdit = payable.status === 'pending' || payable.status === 'partial';

  return (
    <div className="space-y-6">
      {/* 返回按钮和操作按钮 */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Button>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push(`/finance/payables/${payable.id}/edit`)}
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            >
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </Button>
          )}
          {payable.remainingAmount > 0 && (
            <Button
              size="lg"
              onClick={() =>
                router.push(
                  `/finance/payments-out/create?payableId=${payable.id}`
                )
              }
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            >
              <DollarSign className="mr-2 h-4 w-4" />
              记录付款
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧：基本信息和付款记录 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 基本信息 */}
          <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
              <CardTitle className="flex items-center text-gray-900">
                <FileText className="mr-2 h-5 w-5 text-blue-600" />
                基本信息
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-xs font-medium text-gray-500">
                    付款状态
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={PAYABLE_STATUS_VARIANTS[payable.status]}>
                      {PAYABLE_STATUS_LABELS[payable.status]}
                    </Badge>
                    {isOverdue && (
                      <Badge variant="destructive">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        逾期
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-500">
                    来源类型
                  </div>
                  <div className="mt-2 font-medium text-gray-900">
                    {PAYABLE_SOURCE_TYPE_LABELS[payable.sourceType]}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-500">供应商</div>
                  <div className="mt-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-blue-600">
                      {payable.supplier.name}
                    </span>
                  </div>
                </div>

                {payable.sourceNumber && (
                  <div>
                    <div className="text-xs font-medium text-gray-500">
                      来源单号
                    </div>
                    <div className="mt-2 font-medium text-gray-900">
                      {payable.sourceNumber}
                    </div>
                  </div>
                )}

                {payable.dueDate && (
                  <div>
                    <div className="text-xs font-medium text-gray-500">
                      到期日期
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span
                        className={`text-sm ${isOverdue ? 'font-semibold text-red-600' : 'text-gray-700'}`}
                      >
                        {new Date(payable.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {payable.paymentTerms && (
                  <div>
                    <div className="text-xs font-medium text-gray-500">
                      付款条件
                    </div>
                    <div className="mt-2 text-sm text-gray-700">
                      {payable.paymentTerms}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-medium text-gray-500">创建人</div>
                  <div className="mt-2 flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-700">
                      {payable.user.name}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-500">
                    创建时间
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    {new Date(payable.createdAt).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-500">
                    更新时间
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    {new Date(payable.updatedAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {payable.description && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <div className="text-xs font-medium text-gray-500">描述</div>
                    <div className="mt-2 text-sm text-gray-700">
                      {payable.description}
                    </div>
                  </div>
                </>
              )}

              {payable.remarks && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <div className="text-xs font-medium text-gray-500">备注</div>
                    <div className="mt-2 text-sm text-gray-700">
                      {payable.remarks}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 付款记录 */}
          <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
              <CardTitle className="flex items-center text-gray-900">
                <DollarSign className="mr-2 h-5 w-5 text-blue-600" />
                付款记录
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {payable.paymentOutRecords && payable.paymentOutRecords.length > 0 ? (
                <div className="space-y-4">
                  {payable.paymentOutRecords.map((payment, index) => (
                    <div key={payment.id}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {payment.paymentNumber}
                          </h4>
                          <div className="mt-2 space-y-1 text-sm text-gray-600">
                            <p>
                              付款方式：
                              {PAYMENT_OUT_METHOD_LABELS[payment.paymentMethod]}
                            </p>
                            <p>
                              付款日期：
                              {new Date(
                                payment.paymentDate
                              ).toLocaleDateString()}
                            </p>
                            {payment.remarks && <p>备注：{payment.remarks}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-green-600">
                            {formatCurrency(payment.paymentAmount)}
                          </p>
                        </div>
                      </div>
                      {index < payable.paymentOutRecords.length - 1 && (
                        <Separator className="mt-4" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <DollarSign className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <p className="text-sm text-gray-500">暂无付款记录</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：金额汇总和供应商信息 */}
        <div className="space-y-6">
          {/* 金额汇总 */}
          <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
              <CardTitle className="text-gray-900">金额汇总</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">应付金额</span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCurrency(payable.payableAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">已付金额</span>
                  <span className="text-lg font-semibold text-green-600">
                    {formatCurrency(payable.paidAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">剩余金额</span>
                  <span className="text-lg font-semibold text-orange-600">
                    {formatCurrency(payable.remainingAmount)}
                  </span>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">付款进度</span>
                    <span className="font-medium text-gray-900">
                      {paymentProgress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-green-600 transition-all duration-300"
                      style={{ width: `${paymentProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 供应商信息 */}
          <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
            <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
              <CardTitle className="text-gray-900">供应商信息</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-gray-900">
                    {payable.supplier.name}
                  </p>
                  {payable.supplier.phone && (
                    <p className="mt-1 text-sm text-gray-600">
                      电话：{payable.supplier.phone}
                    </p>
                  )}
                  {payable.supplier.address && (
                    <p className="mt-1 text-sm text-gray-600">
                      地址：{payable.supplier.address}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    router.push(`/suppliers/${payable.supplier.id}`)
                  }
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  查看供应商详情
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

