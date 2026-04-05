import {
  ArrowRight,
  BarChart3,
  Calendar,
  CreditCard,
  FileText,
  Receipt,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getFinanceOverview,
  type FinanceOverview,
} from '@/lib/services/finance-statistics';
import { formatCurrency } from '@/lib/utils/format';

type PriorityCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accentClassName: string;
  hint: string;
};

type ShortcutItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

type ShortcutGroup = {
  id: string;
  title: string;
  description: string;
  items: ShortcutItem[];
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FinancePage() {
  const overview = await getFinanceOverview();
  const todayLabel = new Intl.DateTimeFormat('zh-CN').format(new Date());

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <FinancePageHeader dateLabel={todayLabel} />
        <FinanceOverviewCards overview={overview} />
        <FinancePrioritySection overview={overview} />
        <FinanceShortcutSection />
      </div>
    </div>
  );
}

function FinancePageHeader({ dateLabel }: { dateLabel: string }) {
  return (
    <Card className="border border-[hsl(var(--color-border-primary))] shadow-[var(--shadow-light)]">
      <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-3xl sm:font-bold">
              财务中心
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              先处理待收、待付、待退款，再查看收付款记录、费用和报表。
            </p>
          </div>
          <div className="text-muted-foreground flex items-center gap-2 text-xs sm:text-sm">
            <Calendar className="h-4 w-4" />
            <span>{dateLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FinanceOverviewCards({ overview }: { overview: FinanceOverview }) {
  const { summary } = overview;

  const cards = [
    {
      title: '客户待收款',
      value: formatCurrency(overview.totalReceivable),
      description: `${overview.receivableCount} 个待跟进账户`,
      icon: TrendingUp,
      valueClassName: 'text-[hsl(var(--color-success))]',
    },
    {
      title: '待退款',
      value: formatCurrency(overview.totalRefundable),
      description: `${overview.refundCount} 笔退款待处理`,
      icon: RotateCcw,
      valueClassName: 'text-[hsl(var(--color-warning))]',
    },
    {
      title: '本月已收款',
      value: formatCurrency(overview.monthlyReceived),
      description: `回款率 ${summary.paymentRate.toFixed(1)}%`,
      icon: ChineseYuan,
      valueClassName: 'text-[hsl(var(--color-primary))]',
    },
    {
      title: '累计业务金额',
      value: formatCurrency(summary.totalAmount),
      description: `累计已收 ${formatCurrency(summary.paidAmount)}`,
      icon: Wallet,
      valueClassName: 'text-[hsl(var(--color-text-primary))]',
    },
  ] satisfies Array<{
    title: string;
    value: string;
    description: string;
    icon: LucideIcon | typeof ChineseYuan;
    valueClassName: string;
  }>;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => {
        const IconComponent = card.icon;
        return (
          <Card
            key={card.title}
            className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)]"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <IconComponent className="h-4 w-4 text-[hsl(var(--color-text-secondary))]" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.valueClassName}`}>
                {card.value}
              </div>
              <p className="text-muted-foreground text-xs">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function FinancePrioritySection({ overview }: { overview: FinanceOverview }) {
  const items: PriorityCard[] = [
    {
      id: 'receivables',
      title: '客户待收款',
      description: '按客户跟进未回款订单，先处理最容易收回的款项。',
      href: '/finance/receivables',
      icon: TrendingUp,
      accentClassName:
        'bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
      hint: `${overview.receivableCount} 个账户待跟进`,
    },
    {
      id: 'payables',
      title: '供应商待付款',
      description: '查看应付款余额和结算进度，避免漏付或逾期。',
      href: '/finance/payables',
      icon: TrendingDown,
      accentClassName:
        'bg-[hsl(var(--color-error-light))] text-[hsl(var(--color-error))]',
      hint: '查看待付款和已核销进度',
    },
    {
      id: 'refunds',
      title: '退款处理',
      description: '集中处理退货产生的退款，明确待处理和待退款金额。',
      href: '/finance/refunds',
      icon: RotateCcw,
      accentClassName:
        'bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]',
      hint: `${overview.refundCount} 笔退款待处理`,
    },
  ];

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[hsl(var(--color-text-primary))] sm:text-lg">
          今日优先处理
        </h2>
        <p className="text-muted-foreground text-sm">
          把最常用、最影响回款和结算的任务放在前面。
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {items.map(item => {
          const IconComponent = item.icon;
          return (
            <Card
              key={item.id}
              className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)]"
            >
              <CardContent className="p-5">
                <div className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.accentClassName}`}
                    >
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      优先
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {item.description}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">
                      {item.hint}
                    </span>
                    <Button asChild size="sm">
                      <Link href={item.href}>
                        立即查看
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function FinanceShortcutSection() {
  const groups: ShortcutGroup[] = [
    {
      id: 'records',
      title: '常用记录',
      description: '日常记账和核对常用入口。',
      items: [
        {
          id: 'payments',
          title: '已收款记录',
          description: '查看收款、确认到账',
          href: '/finance/payments',
          icon: CreditCard,
        },
        {
          id: 'payments-out',
          title: '付款记录',
          description: '查看待确认与已确认付款',
          href: '/finance/payments-out',
          icon: CreditCard,
        },
        {
          id: 'expenses',
          title: '费用记录',
          description: '登记费用并审核入账',
          href: '/finance/expenses',
          icon: Receipt,
        },
      ],
    },
    {
      id: 'reconciliation',
      title: '对账与报表',
      description: '需要看余额、流水和报表时从这里进入。',
      items: [
        {
          id: 'statements',
          title: '往来对账',
          description: '查看客户和供应商余额汇总',
          href: '/finance/statements',
          icon: FileText,
        },
        {
          id: 'customer-statements',
          title: '客户往来明细',
          description: '按客户查看往来流水',
          href: '/finance/customer-statements',
          icon: FileText,
        },
        {
          id: 'monthly-report',
          title: '月度报表',
          description: '查看当月收入、成本和费用',
          href: '/finance/reports/monthly',
          icon: Calendar,
        },
        {
          id: 'annual-report',
          title: '年度报表',
          description: '查看年度经营数据',
          href: '/finance/reports/annual',
          icon: Calendar,
        },
        {
          id: 'profit-loss',
          title: '利润分析',
          description: '查看利润结构与趋势',
          href: '/finance/reports/profit-loss',
          icon: BarChart3,
        },
      ],
    },
  ];

  return (
    <section className="space-y-4">
      {groups.map(group => (
        <Card
          key={group.id}
          className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)]"
        >
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">{group.title}</CardTitle>
            <p className="text-muted-foreground text-sm">{group.description}</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map(item => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group rounded-xl border border-[hsl(var(--color-border-secondary))] p-4 transition-colors hover:border-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary-light))]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4 text-[hsl(var(--color-text-secondary))]" />
                          <span className="font-medium text-[hsl(var(--color-text-primary))]">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {item.description}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[hsl(var(--color-text-tertiary))] transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
