import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CreditCard,
  DollarSign,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getFinanceOverview,
  type FinanceOverview,
} from '@/lib/services/finance-statistics';
import { formatCurrency } from '@/lib/utils/format';

type FinanceModule = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  stats: {
    amount: number;
    count: number | string;
    label: string;
  };
};

type QuickAction = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
};

/**
 * 财务管理主页面
 * 提供财务模块的概览和快速导航
 */
export default async function FinancePage() {
  const overview = await getFinanceOverview();
  const modules = buildFinanceModules(overview);
  const todayLabel = new Intl.DateTimeFormat('zh-CN').format(new Date());

  return (
    <div className="space-y-6">
      <FinancePageHeader dateLabel={todayLabel} />
      <FinanceOverviewCards overview={overview} />
      <FinanceModuleGrid modules={modules} />
      <FinanceQuickActions summary={overview.summary} />
    </div>
  );
}

function FinancePageHeader({ dateLabel }: { dateLabel: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">财务管理</h1>
        <p className="text-muted-foreground">
          管理应收账款、退款处理和往来账单
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Calendar className="text-muted-foreground h-4 w-4" />
        <span className="text-muted-foreground text-sm">{dateLabel}</span>
      </div>
    </div>
  );
}

function FinanceOverviewCards({ overview }: { overview: FinanceOverview }) {
  const { summary } = overview;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总应收金额</CardTitle>
          <TrendingUp className="h-4 w-4 text-[hsl(var(--color-success))]" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[hsl(var(--color-success))]">
            {formatCurrency(overview.totalReceivable)}
          </div>
          <p className="text-muted-foreground text-xs">
            {overview.receivableCount} 个待收款订单
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
            {formatCurrency(overview.totalRefundable)}
          </div>
          <p className="text-muted-foreground text-xs">
            {overview.refundCount} 个待退款订单
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
            {formatCurrency(overview.monthlyReceived)}
          </div>
          <p className="text-muted-foreground text-xs">
            回款率 {summary.paymentRate.toFixed(1)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FinanceModuleGrid({ modules }: { modules: FinanceModule[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {modules.map(module => {
        const IconComponent = module.icon;
        return (
          <Card
            key={module.id}
            className="transition-shadow hover:shadow-[var(--shadow-medium)]"
          >
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
  );
}

function FinanceQuickActions({
  summary,
}: {
  summary: FinanceOverview['summary'];
}) {
  const quickActions: QuickAction[] = [
    {
      id: 'customer-ledger',
      title: '客户账务',
      description: '查看客户应收应付明细',
      icon: Users,
      color: 'text-[hsl(var(--color-primary))]',
    },
    {
      id: 'customer-statements',
      title: '对账单',
      description: '生成客户对账单据',
      icon: Receipt,
      color: 'text-[hsl(var(--color-success))]',
    },
    {
      id: 'receivable-reminder',
      title: '收款提醒',
      description: '跟进待收款项',
      icon: AlertCircle,
      color: 'text-[hsl(var(--color-warning))]',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">快速操作</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/40 mb-4 grid gap-4 rounded-lg p-4 md:grid-cols-4">
          <div>
            <p className="text-muted-foreground text-xs">累计订单</p>
            <p className="text-lg font-semibold">{summary.totalOrders}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">累计金额</p>
            <p className="text-lg font-semibold">
              {formatCurrency(summary.totalAmount)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">已收金额</p>
            <p className="text-lg font-semibold">
              {formatCurrency(summary.paidAmount)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">待收金额</p>
            <p className="text-lg font-semibold">
              {formatCurrency(summary.pendingAmount)}
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {quickActions.map(action => {
            const IconComponent = action.icon;
            return (
              <div
                key={action.id}
                className="bg-muted/50 flex items-center gap-3 rounded-lg p-3"
              >
                <IconComponent className={`h-5 w-5 ${action.color}`} />
                <div>
                  <p className="font-medium">{action.title}</p>
                  <p className="text-muted-foreground text-sm">
                    {action.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function buildFinanceModules(overview: FinanceOverview): FinanceModule[] {
  const { summary } = overview;

  return [
    {
      id: 'receivables',
      title: '应收货款',
      description: '管理销售订单产生的应收账款',
      href: '/finance/receivables',
      icon: TrendingUp,
      color: 'text-[hsl(var(--color-success))]',
      bgColor: 'bg-[hsl(var(--color-success-light))]',
      stats: {
        amount: overview.totalReceivable,
        count: overview.receivableCount,
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
        amount: overview.totalRefundable,
        count: overview.refundCount,
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
        amount: overview.monthlyReceived,
        count: `${summary.paymentRate.toFixed(1)}%`,
        label: '本月回款率',
      },
    },
    {
      id: 'statements',
      title: '往来账单',
      description: '统一管理业务伙伴往来账本',
      href: '/finance/statements',
      icon: Receipt,
      color: 'text-[hsl(var(--color-primary))]',
      bgColor: 'bg-[hsl(var(--color-primary-light))]',
      stats: {
        amount: summary.totalAmount,
        count: summary.totalOrders,
        label: '累计账单',
      },
    },
  ];
}
