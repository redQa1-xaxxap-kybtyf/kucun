'use client';

import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CreditCard,
  DollarSign,
  FileText,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * 财务管理主页面
 * 提供财务模块的概览和快速导航
 */
export default function FinancePage() {
  // 模拟数据 - 实际项目中应该从API获取
  const mockStats = {
    totalReceivable: 125000.0,
    totalRefundable: 8500.0,
    overdueAmount: 15000.0,
    monthlyReceived: 85000.0,
    receivableCount: 23,
    refundCount: 5,
    overdueCount: 3,
  };

  const financeModules = [
    {
      id: 'receivables',
      title: '应收货款',
      description: '管理销售订单产生的应收账款',
      href: '/finance/receivables',
      icon: TrendingUp,
      color: 'text-[hsl(var(--color-success))]',
      bgColor: 'bg-[hsl(var(--color-success-light))]',
      stats: {
        amount: mockStats.totalReceivable,
        count: mockStats.receivableCount,
        label: '待收款订单',
      },
    },
    {
      id: 'refunds',
      title: '应退货款',
      description: '管理退货订单产生的应退账款',
      href: '/finance/refunds',
      icon: TrendingDown,
      color: 'text-[hsl(var(--color-warning))]',
      bgColor: 'bg-[hsl(var(--color-warning-light))]',
      stats: {
        amount: mockStats.totalRefundable,
        count: mockStats.refundCount,
        label: '待退款订单',
      },
    },
    {
      id: 'payments',
      title: '收款记录',
      description: '管理销售订单的收款记录和确认',
      href: '/finance/payments',
      icon: CreditCard,
      color: 'text-[hsl(var(--color-purple))]',
      bgColor: 'bg-[hsl(var(--color-purple-light))]',
      stats: {
        amount: mockStats.monthlyReceived,
        count: mockStats.receivableCount,
        label: '本月收款',
      },
    },
    {
      id: 'statements',
      title: '往来账单',
      description: '管理客户和供应商的综合账务往来',
      href: '/finance/statements',
      icon: Receipt,
      color: 'text-[hsl(var(--color-primary))]',
      bgColor: 'bg-[hsl(var(--color-primary-light))]',
      stats: {
        amount: mockStats.totalReceivable + mockStats.totalRefundable,
        count: mockStats.receivableCount + mockStats.refundCount,
        label: '账单总数',
      },
    },
    {
      id: 'customer-statements',
      title: '客户对账单',
      description: '管理与客户之间的完整财务往来记录',
      href: '/finance/customer-statements',
      icon: FileText,
      color: 'text-[hsl(var(--color-primary))]',
      bgColor: 'bg-[hsl(var(--color-primary-light))]',
      stats: {
        amount: mockStats.totalReceivable,
        count: mockStats.receivableCount,
        label: '有往来客户',
      },
    },
  ];

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">财务管理</h1>
          <p className="text-muted-foreground">
            管理应收账款、退款处理和往来账单
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="text-muted-foreground h-4 w-4" />
          <span className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString('zh-CN')}
          </span>
        </div>
      </div>

      {/* 财务概览卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应收金额</CardTitle>
            <TrendingUp className="h-4 w-4 text-[hsl(var(--color-success))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
              {formatCurrency(mockStats.totalReceivable)}
            </div>
            <p className="text-muted-foreground text-xs">
              {mockStats.receivableCount} 个待收款订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应退金额</CardTitle>
            <TrendingDown className="h-4 w-4 text-[hsl(var(--color-warning))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-warning))]">
              {formatCurrency(mockStats.totalRefundable)}
            </div>
            <p className="text-muted-foreground text-xs">
              {mockStats.refundCount} 个待退款订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">逾期金额</CardTitle>
            <AlertCircle className="h-4 w-4 text-[hsl(var(--color-error))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-error))]">
              {formatCurrency(mockStats.overdueAmount)}
            </div>
            <p className="text-muted-foreground text-xs">
              {mockStats.overdueCount} 个逾期订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月收款</CardTitle>
            <DollarSign className="h-4 w-4 text-[hsl(var(--color-primary))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[hsl(var(--color-primary))]">
              {formatCurrency(mockStats.monthlyReceived)}
            </div>
            <p className="text-muted-foreground text-xs">较上月增长 12%</p>
          </CardContent>
        </Card>
      </div>

      {/* 功能模块导航 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {financeModules.map(module => {
          const IconComponent = module.icon;
          return (
            <Card key={module.id} className="transition-shadow hover:shadow-[var(--shadow-medium)]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className={`rounded-lg p-2 ${module.bgColor}`}>
                    <IconComponent className={`h-6 w-6 ${module.color}`} />
                  </div>
                  <Badge variant="secondary">{module.stats.count}</Badge>
                </div>
                <CardTitle className="text-lg">{module.title}</CardTitle>
                <p className="text-muted-foreground text-sm">
                  {module.description}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className={`text-2xl font-bold ${module.color}`}>
                      {formatCurrency(module.stats.amount)}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {module.stats.label}
                    </p>
                  </div>
                  <Button asChild className="w-full">
                    <Link href={module.href}>
                      进入管理
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 快速操作提示 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">快速操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <Users className="h-5 w-5 text-[hsl(var(--color-primary))]" />
              <div>
                <p className="font-medium">客户账务</p>
                <p className="text-muted-foreground text-sm">
                  查看客户应收应付明细
                </p>
              </div>
            </div>
            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <Receipt className="h-5 w-5 text-[hsl(var(--color-success))]" />
              <div>
                <p className="font-medium">对账单</p>
                <p className="text-muted-foreground text-sm">
                  生成客户对账单据
                </p>
              </div>
            </div>
            <div className="bg-muted/50 flex items-center gap-3 rounded-lg p-3">
              <AlertCircle className="h-5 w-5 text-[hsl(var(--color-warning))]" />
              <div>
                <p className="font-medium">逾期提醒</p>
                <p className="text-muted-foreground text-sm">
                  处理逾期应收账款
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
