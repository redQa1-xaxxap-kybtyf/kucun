'use client';

import {
  AlertCircle,
  ArrowRight,
  Calendar,
  DollarSign,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils/datetime';

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
      color: 'text-green-600',
      bgColor: 'bg-green-50',
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
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      stats: {
        amount: mockStats.totalRefundable,
        count: mockStats.refundCount,
        label: '待退款订单',
      },
    },
    {
      id: 'statements',
      title: '往来账单',
      description: '管理客户和供应商的综合账务往来',
      href: '/finance/statements',
      icon: Receipt,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      stats: {
        amount: mockStats.monthlyReceived,
        count: 0,
        label: '本月收款',
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
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {formatDate(new Date())}
          </span>
        </div>
      </div>

      {/* 财务概览卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应收金额</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(mockStats.totalReceivable)}
            </div>
            <p className="text-xs text-muted-foreground">
              {mockStats.receivableCount} 个待收款订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总应退金额</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(mockStats.totalRefundable)}
            </div>
            <p className="text-xs text-muted-foreground">
              {mockStats.refundCount} 个待退款订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">逾期金额</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(mockStats.overdueAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {mockStats.overdueCount} 个逾期订单
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本月收款</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(mockStats.monthlyReceived)}
            </div>
            <p className="text-xs text-muted-foreground">较上月增长 12%</p>
          </CardContent>
        </Card>
      </div>

      {/* 功能模块导航 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {financeModules.map(module => {
          const IconComponent = module.icon;
          return (
            <Card key={module.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className={`rounded-lg p-2 ${module.bgColor}`}>
                    <IconComponent className={`h-6 w-6 ${module.color}`} />
                  </div>
                  <Badge variant="secondary">{module.stats.count}</Badge>
                </div>
                <CardTitle className="text-lg">{module.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {module.description}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className={`text-2xl font-bold ${module.color}`}>
                      {formatCurrency(module.stats.amount)}
                    </div>
                    <p className="text-xs text-muted-foreground">
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
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">客户账务</p>
                <p className="text-sm text-muted-foreground">
                  查看客户应收应付明细
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <Receipt className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">对账单</p>
                <p className="text-sm text-muted-foreground">
                  生成客户对账单据
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium">逾期提醒</p>
                <p className="text-sm text-muted-foreground">
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
