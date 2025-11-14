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
  FileText,
  Package,
  XCircle,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { prisma } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils/datetime';

interface RefundDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: RefundDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `退款详情 #${id} - 库存管理工具`,
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
      },
    });

    return refund;
  } catch {
    // 错误已被捕获，返回 null 让组件显示错误状态
    return null;
  }
}

/**
 * 状态显示组件
 */
function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: { label: '待处理', variant: 'warning' as const, icon: Clock },
    processing: {
      label: '处理中',
      variant: 'info' as const,
      icon: AlertCircle,
    },
    completed: {
      label: '已完成',
      variant: 'success' as const,
      icon: CheckCircle,
    },
    cancelled: {
      label: '已取消',
      variant: 'destructive' as const,
      icon: XCircle,
    },
    rejected: {
      label: '已拒绝',
      variant: 'destructive' as const,
      icon: XCircle,
    },
  };

  const config =
    statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const IconComponent = config.icon;

  return (
    <Badge
      variant={config.variant}
      className="flex items-center gap-1 text-xs font-medium"
    >
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
  const { id } = await params;
  const refund = await getRefundDetail(id);

  if (!refund) {
    notFound();
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                  <ChineseYuan className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    应退货款详情
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    退款编号：{refund.refundNumber}
                  </p>
                </div>
                <StatusBadge status={refund.status} />
              </div>
              <div className="flex items-center gap-2">
                {refund.status === 'pending' && (
                  <Button
                    size="lg"
                    asChild
                    className="h-11 gap-2 bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)] transition-all hover:scale-105 hover:shadow-[var(--shadow-heavy)]"
                  >
                    <Link href={`/finance/refunds/${refund.id}/process`}>
                      处理退款
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="h-11 gap-2 transition-all hover:scale-105 hover:border-[hsl(var(--color-border-strong))]"
                >
                  <Link href="/finance/refunds">
                    <ArrowLeft className="h-4 w-4" />
                    返回
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 主要信息 */}
          <div className="space-y-6 lg:col-span-2">
            {/* 退款信息 */}
            <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
              <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
                <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                  <ChineseYuan className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                  退款信息
                </CardTitle>
                <CardDescription>查看退款金额和处理状态</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      退款金额
                    </label>
                    <p className="text-lg font-semibold text-[hsl(var(--color-error))]">
                      {formatCurrency(refund.refundAmount)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      已处理金额
                    </label>
                    <p className="text-lg font-semibold text-[hsl(var(--color-success))]">
                      {formatCurrency(refund.processedAmount)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      剩余金额
                    </label>
                    <p className="text-lg font-semibold">
                      {formatCurrency(refund.remainingAmount)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      退款方式
                    </label>
                    <p className="text-sm">{refund.refundMethod || '未指定'}</p>
                  </div>
                </div>

                {refund.reason && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                        退款原因
                      </label>
                      <p className="mt-1 text-sm">{refund.reason}</p>
                    </div>
                  </>
                )}

                {refund.remarks && (
                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      备注说明
                    </label>
                    <p className="mt-1 text-sm">{refund.remarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 关联订单信息 */}
            {refund.returnOrder && (
              <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
                <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
                  <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                    <Package className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                    关联订单信息
                  </CardTitle>
                  <CardDescription>查看关联的退货单和销售订单</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                        退货单号
                      </label>
                      <p className="text-sm font-medium">
                        {refund.returnOrderNumber}
                      </p>
                    </div>
                    {refund.returnOrder?.salesOrder && (
                      <div>
                        <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                          原销售订单
                        </label>
                        <p className="text-sm font-medium">
                          {refund.returnOrder.salesOrder.orderNumber}
                        </p>
                      </div>
                    )}
                  </div>

                  {refund.returnOrder?.customer && (
                    <>
                      <Separator />
                      <div>
                        <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                          客户信息
                        </label>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm font-medium">
                            {refund.returnOrder?.customer?.name}
                          </p>
                          {refund.returnOrder?.customer?.phone && (
                            <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                              电话：{refund.returnOrder.customer.phone}
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
            <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
              <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
                <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                  <Clock className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                  处理状态
                </CardTitle>
                <CardDescription>退款处理进度和时间记录</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <StatusBadge status={refund.status} />
                </div>

                <Separator />

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[hsl(var(--color-text-tertiary))]">
                      创建时间
                    </span>
                    <span>{formatDateTime(refund.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[hsl(var(--color-text-tertiary))]">
                      更新时间
                    </span>
                    <span>{formatDateTime(refund.updatedAt)}</span>
                  </div>
                  {refund.processedDate && (
                    <div className="flex justify-between">
                      <span className="text-[hsl(var(--color-text-tertiary))]">
                        处理时间
                      </span>
                      <span>{formatDateTime(refund.processedDate)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 操作记录 */}
            <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
              <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
                <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                  <FileText className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                  操作记录
                </CardTitle>
                <CardDescription>退款处理的操作历史</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--color-primary))]" />
                    <div>
                      <p className="font-medium">退款申请已创建</p>
                      <p className="text-[hsl(var(--color-text-tertiary))]">
                        {formatDateTime(refund.createdAt)}
                      </p>
                    </div>
                  </div>

                  {refund.processedDate && (
                    <div className="flex items-start gap-3">
                      <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--color-success))]" />
                      <div>
                        <p className="font-medium">退款处理完成</p>
                        <p className="text-[hsl(var(--color-text-tertiary))]">
                          {formatDateTime(refund.processedDate)}
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
    </div>
  );
}
