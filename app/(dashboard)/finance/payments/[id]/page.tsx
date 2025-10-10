/**
 * 收款记录详情页面
 * 显示收款记录的详细信息，包含客户信息、订单信息和操作历史
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

import {
  ArrowLeft,
  CheckCircle,
  Printer,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Package,
  User,
  XCircle,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

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

interface PaymentDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: PaymentDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `收款记录详情 #${id} - 库存管理工具`,
    description: '查看收款记录详细信息和关联订单',
  };
}

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  receiptNumber?: string;
  bankInfo?: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    createdAt: string;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * 状态显示组件
 */
function StatusBadge({ status }: { status: string }) {
  const statusConfig = {
    pending: {
      label: '待确认',
      variant: 'secondary' as const,
      icon: Clock,
      color: 'text-[hsl(var(--color-warning))]',
    },
    confirmed: {
      label: '已确认',
      variant: 'secondary' as const,
      icon: CheckCircle,
      color: 'text-[hsl(var(--color-success))]',
    },
    cancelled: {
      label: '已取消',
      variant: 'destructive' as const,
      icon: XCircle,
      color: 'text-[hsl(var(--color-error))]',
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
function PaymentMethodDisplay({ method }: { method: string }) {
  const methodConfig = {
    cash: { label: '现金', icon: DollarSign },
    bank_transfer: { label: '银行转账', icon: CreditCard },
    alipay: { label: '支付宝', icon: CreditCard },
    wechat: { label: '微信支付', icon: CreditCard },
    check: { label: '支票', icon: FileText },
    other: { label: '其他', icon: CreditCard },
  };

  const config =
    methodConfig[method as keyof typeof methodConfig] || methodConfig.other;
  const IconComponent = config.icon;

  return (
    <div className="flex items-center gap-2">
      <IconComponent className="h-4 w-4" />
      <span>{config.label}</span>
    </div>
  );
}

/**
 * 获取收款记录详情数据
 */
async function getPaymentDetail(id: string) {
  try {
    const payment = await prisma.paymentRecord.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            address: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return payment;
  } catch (_error) {
    return null;
  }
}

/**
 * 收款记录详情页面组件
 */
export default async function PaymentDetailPage({
  params,
}: PaymentDetailPageProps) {
  const { id } = await params;
  const payment = await getPaymentDetail(id);

  if (!payment) {
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
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    收款记录详情
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    收款单号：{payment.paymentNumber}
                  </p>
                </div>
                <StatusBadge status={payment.status} />
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 gap-2 transition-all hover:scale-105 hover:border-[hsl(var(--color-border-strong))]"
              >
                <Link href="/finance/payments">
                  <ArrowLeft className="h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 主要信息 */}
          <div className="space-y-6 lg:col-span-2">
            {/* 收款信息 */}
            <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
              <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
                <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                  <DollarSign className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                  收款信息
                </CardTitle>
                <CardDescription>查看收款金额、方式和日期</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      收款单号
                    </label>
                    <p className="text-lg font-semibold">
                      {payment.paymentNumber}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      收款金额
                    </label>
                    <p className="text-2xl font-bold text-[hsl(var(--color-success))]">
                      {formatCurrency(payment.paymentAmount)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      收款方式
                    </label>
                    <div className="mt-1">
                      <PaymentMethodDisplay method={payment.paymentMethod} />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      收款日期
                    </label>
                    <p className="text-sm font-medium">
                      {new Date(payment.paymentDate).toLocaleDateString(
                        'zh-CN'
                      )}
                    </p>
                  </div>

                  {payment.receiptNumber && (
                    <div>
                      <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                        收据号码
                      </label>
                      <p className="text-sm font-medium">
                        {payment.receiptNumber}
                      </p>
                    </div>
                  )}

                  {payment.bankInfo && (
                    <div>
                      <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                        银行信息
                      </label>
                      <p className="text-sm">{payment.bankInfo}</p>
                    </div>
                  )}
                </div>

                {payment.remarks && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                        备注
                      </label>
                      <p className="mt-1 rounded-md bg-[hsl(var(--color-bg-secondary))] p-3 text-sm">
                        {payment.remarks}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* 关联订单信息 */}
            <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
              <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
                <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                  <Package className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                  关联订单
                </CardTitle>
                <CardDescription>查看关联的销售订单信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      订单号
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {payment.salesOrder.orderNumber}
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/sales-orders/${payment.salesOrder.id}`}>
                          查看订单
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      订单状态
                    </label>
                    <p className="mt-1 text-sm font-medium">
                      {payment.salesOrder.status}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      订单金额
                    </label>
                    <p className="text-lg font-bold">
                      {formatCurrency(payment.salesOrder.totalAmount)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      订单创建时间
                    </label>
                    <p className="text-sm">
                      {new Date(payment.salesOrder.createdAt).toLocaleString(
                        'zh-CN'
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 侧边栏信息 */}
          <div className="space-y-6">
            {/* 客户信息 */}
            <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
              <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
                <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                  <User className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                  客户信息
                </CardTitle>
                <CardDescription>查看客户联系方式</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                    客户名称
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {payment.customer.name}
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/customers/${payment.customer.id}`}>
                        查看客户
                      </Link>
                    </Button>
                  </div>
                </div>

                {payment.customer.phone && (
                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      联系电话
                    </label>
                    <p className="text-sm">{payment.customer.phone}</p>
                  </div>
                )}

                {payment.customer.email && (
                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      邮箱地址
                    </label>
                    <p className="text-sm">{payment.customer.email}</p>
                  </div>
                )}

                {payment.customer.address && (
                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      地址
                    </label>
                    <p className="text-sm">{payment.customer.address}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 操作信息 */}
            <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
              <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
                <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                  <Clock className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                  操作信息
                </CardTitle>
                <CardDescription>创建人和时间记录</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                    创建人
                  </label>
                  <p className="text-sm font-medium">{payment.user.name}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                    创建时间
                  </label>
                  <p className="text-sm">
                    {new Date(payment.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                    最后更新
                  </label>
                  <p className="text-sm">
                    {new Date(payment.updatedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 快捷操作 */}
            <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
              <CardHeader className="border-b bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
                <CardTitle className="flex items-center text-[hsl(var(--color-text-primary))]">
                  <FileText className="mr-2 h-5 w-5 text-[hsl(var(--color-primary))]" />
                  快捷操作
                </CardTitle>
                <CardDescription>常用操作快捷入口</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  asChild
                >
                  <Link href={`/sales-orders/${payment.salesOrder.id}`}>
                    <Package className="mr-2 h-4 w-4" />
                    查看关联订单
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start"
                  asChild
                >
                  <Link href={`/customers/${payment.customer.id}`}>
                    <User className="mr-2 h-4 w-4" />
                    查看客户详情
                  </Link>
                </Button>

                <Button variant="outline" className="w-full justify-start">
                  <Printer className="mr-2 h-4 w-4" />
                  打印收款单
                </Button>

                {payment.status === 'pending' && (
                  <Button className="w-full justify-start">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    确认收款
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

