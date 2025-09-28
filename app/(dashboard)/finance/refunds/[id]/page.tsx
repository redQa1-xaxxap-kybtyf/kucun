/**
 * 退款详情页面
 * 显示退款记录的详细信息，支持状态更新和处理操作
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Package,
  XCircle,
} from 'lucide-react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { prisma } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';

interface RefundDetailPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({
  params,
}: RefundDetailPageProps): Promise<Metadata> {
  return {
    title: `退款详情 #${params.id} - 库存管理工具`,
    description: '查看退款记录详细信息和处理状态',
  };
}

/**
 * 获取退款详情数据
 */
async function getRefundDetail(id: string) {
  try {
    const refund = await prisma.refundRecord.findUnique({
      where: { id },
      include: {
        returnOrder: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
            salesOrder: {
              select: {
                id: true,
                orderNumber: true,
                totalAmount: true,
                createdAt: true,
              },
            },
          },
        },
        processedBy: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    return refund;
  } catch (error) {
    // 记录错误但不在生产环境输出
    if (process.env.NODE_ENV === 'development') {
      console.error('获取退款详情失败:', error);
    }
    return null;
  }
}

/**
 * 状态显示组件
 */
function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: '待处理', variant: 'secondary' as const, icon: Clock },
    processing: {
      label: '处理中',
      variant: 'default' as const,
      icon: AlertCircle,
    },
    completed: {
      label: '已完成',
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
 * 退款详情页面组件
 */
export default async function RefundDetailPage({
  params,
}: RefundDetailPageProps) {
  const refund = await getRefundDetail(params.id);

  if (!refund) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      {/* 页面标题和操作 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance/refunds">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回列表
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">退款详情</h1>
            <p className="text-gray-600">退款编号：{refund.refundNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={refund.status} />
          {refund.status === 'pending' && (
            <Button asChild>
              <Link href={`/finance/refunds/${refund.id}/process`}>
                处理退款
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 主要信息 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 退款信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                退款信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    退款金额
                  </label>
                  <p className="text-lg font-semibold text-red-600">
                    {formatCurrency(refund.refundAmount)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    已处理金额
                  </label>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(refund.processedAmount)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    剩余金额
                  </label>
                  <p className="text-lg font-semibold">
                    {formatCurrency(refund.remainingAmount)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    退款方式
                  </label>
                  <p className="text-sm">{refund.refundMethod || '未指定'}</p>
                </div>
              </div>

              {refund.reason && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      退款原因
                    </label>
                    <p className="mt-1 text-sm">{refund.reason}</p>
                  </div>
                </>
              )}

              {refund.notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    备注说明
                  </label>
                  <p className="mt-1 text-sm">{refund.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 关联订单信息 */}
          {refund.returnOrder && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  关联订单信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      退货单号
                    </label>
                    <p className="text-sm font-medium">
                      {refund.returnOrderNumber}
                    </p>
                  </div>
                  {refund.returnOrder.salesOrder && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        原销售订单
                      </label>
                      <p className="text-sm font-medium">
                        {refund.returnOrder.salesOrder.orderNumber}
                      </p>
                    </div>
                  )}
                </div>

                {refund.returnOrder.customer && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-gray-500">
                        客户信息
                      </label>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm font-medium">
                          {refund.returnOrder.customer.name}
                        </p>
                        {refund.returnOrder.customer.phone && (
                          <p className="text-sm text-gray-600">
                            电话：{refund.returnOrder.customer.phone}
                          </p>
                        )}
                        {refund.returnOrder.customer.email && (
                          <p className="text-sm text-gray-600">
                            邮箱：{refund.returnOrder.customer.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 侧边栏信息 */}
        <div className="space-y-6">
          {/* 处理状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                处理状态
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <StatusBadge status={refund.status} />
              </div>

              <Separator />

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">创建时间</span>
                  <span>
                    {new Date(refund.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">更新时间</span>
                  <span>
                    {new Date(refund.updatedAt).toLocaleString('zh-CN')}
                  </span>
                </div>
                {refund.processedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">处理时间</span>
                    <span>
                      {new Date(refund.processedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                )}
              </div>

              {refund.processedBy && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-gray-500">
                      处理人员
                    </label>
                    <p className="mt-1 text-sm">{refund.processedBy.name}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 操作记录 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                操作记录
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  <div>
                    <p className="font-medium">退款申请已创建</p>
                    <p className="text-gray-500">
                      {new Date(refund.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>

                {refund.processedAt && (
                  <div className="flex items-start gap-3">
                    <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                    <div>
                      <p className="font-medium">退款处理完成</p>
                      <p className="text-gray-500">
                        {new Date(refund.processedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
