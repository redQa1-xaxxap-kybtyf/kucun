import {
  ArrowRight,
  BarChart3,
  Calendar,
  ClipboardCheck,
  CreditCard,
  FileText,
  ReceiptText,
  Receipt,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { safeAuth } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';
import {
  getFinanceOverview,
  type FinanceOverview,
} from '@/lib/services/finance-statistics';
import {
  getFinanceWorkbenchMetrics,
  type FinanceWorkbenchMetrics,
} from '@/lib/services/finance-workbench-service';
import { USER_ROLE_LABELS, type UserRole } from '@/lib/types/user';
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

type WorkbenchTone = 'urgent' | 'warning' | 'info' | 'success';

type FinanceWorkbenchCard = {
  id: string;
  title: string;
  description: string;
  hint: string;
  href: string;
  count: number;
  amount: number;
  icon: LucideIcon;
  tone: WorkbenchTone;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function FinancePage() {
  const [overview, workbenchMetrics, session] = await Promise.all([
    getFinanceOverview(),
    getFinanceWorkbenchMetrics(),
    safeAuth('finance-page'),
  ]);
  const todayLabel = new Intl.DateTimeFormat('zh-CN').format(new Date());
  const authUser = session?.user
    ? ({
        id: session.user.id,
        email: session.user.email ?? '',
        username:
          session.user.username ?? session.user.email ?? session.user.name ?? '',
        name: session.user.name ?? '当前用户',
        role: session.user.role ?? 'sales',
        status: session.user.status ?? 'active',
      } as Parameters<typeof can>[0])
    : null;
  const userRole = (session?.user?.role as UserRole | undefined) ?? 'sales';
  const roleLabel = USER_ROLE_LABELS[userRole];
  const workbenchCards = buildFinanceWorkbenchCards(
    workbenchMetrics,
    authUser,
    userRole
  );
  const workbenchSummary = getFinanceWorkbenchSummary(userRole);

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        <FinancePageHeader dateLabel={todayLabel} roleLabel={roleLabel} />
        <FinanceOverviewCards overview={overview} />
        <FinanceWorkbenchSection
          cards={workbenchCards}
          summary={workbenchSummary}
        />
        <FinancePrioritySection overview={overview} />
        <FinanceShortcutSection />
      </div>
    </div>
  );
}

function FinancePageHeader({
  dateLabel,
  roleLabel,
}: {
  dateLabel: string;
  roleLabel: string;
}) {
  return (
    <Card className="border border-[hsl(var(--color-border-primary))] shadow-[var(--shadow-light)]">
      <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-3xl sm:font-bold">
                财务中心
              </h1>
              <Badge variant="secondary" className="text-xs">
                {roleLabel}视角
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base">
              先处理待收、待付、待退款，再查看收款、付款、费用和报表。
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

function buildFinanceWorkbenchCards(
  metrics: FinanceWorkbenchMetrics,
  user: Parameters<typeof can>[0],
  userRole: UserRole
): FinanceWorkbenchCard[] {
  const canViewFinance = can(user, 'finance:view');
  const canManageFinance = can(user, 'finance:manage');
  const canProcessRefunds =
    can(user, 'finance:refund:process') || canManageFinance;

  const items: Array<FinanceWorkbenchCard & { visible: boolean }> = [
    {
      id: 'overdue-payables',
      title: '逾期待付款',
      description: '优先处理已超过到期日的供应商付款，避免影响结算关系。',
      hint: '建议今天先确认处理',
      href: '/finance/payables',
      count: metrics.overduePayables.count,
      amount: metrics.overduePayables.amount,
      icon: TriangleAlert,
      tone: 'urgent',
      visible: canManageFinance,
    },
    {
      id: 'pending-receipts',
      title: '待确认到账',
      description: '先把已经登记的收款确认到账，避免收到了钱但账上还没更新。',
      hint: '收款到账后会进入正式统计',
      href: '/finance/payments?status=pending',
      count: metrics.pendingReceipts.count,
      amount: metrics.pendingReceipts.amount,
      icon: ReceiptText,
      tone: 'warning',
      visible: canViewFinance,
    },
    {
      id: 'customer-receivables',
      title: '客户待跟进',
      description: '按客户跟进未回款余额，优先处理金额较大或时间较久的款项。',
      hint: userRole === 'sales' ? '销售今天优先跟进回款' : '建议先看金额较大的客户',
      href: '/finance/receivables',
      count: metrics.receivables.count,
      amount: metrics.receivables.amount,
      icon: TrendingUp,
      tone: 'info',
      visible: canViewFinance,
    },
    {
      id: 'pending-payments',
      title: '待确认付款',
      description: '已登记的付款需要尽快确认，避免供应商结算进度滞后。',
      hint: '确认后会计入已付款金额',
      href: '/finance/payments-out?status=pending',
      count: metrics.pendingPayments.count,
      amount: metrics.pendingPayments.amount,
      icon: CreditCard,
      tone: 'warning',
      visible: canManageFinance,
    },
    {
      id: 'pending-refunds',
      title: '待处理退款',
      description: '退货后的退款要尽快处理，减少客户等待和反复沟通。',
      hint: '优先看待处理和待退款金额',
      href: '/finance/refunds',
      count: metrics.pendingRefunds.count,
      amount: metrics.pendingRefunds.amount,
      icon: RotateCcw,
      tone: 'warning',
      visible: canProcessRefunds,
    },
    {
      id: 'expense-drafts',
      title: '待审核费用',
      description: '草稿费用还未进入正式报表，建议尽快核对并审核入账。',
      hint: '审核后才会进入月报和利润分析',
      href: '/finance/expenses?status=draft',
      count: metrics.expenseDrafts.count,
      amount: metrics.expenseDrafts.amount,
      icon: ClipboardCheck,
      tone: 'success',
      visible: canManageFinance,
    },
    {
      id: 'supplier-payables',
      title: '供应商待付款',
      description: '查看供应商待付款余额，避免漏付、迟付或结算节奏失衡。',
      hint: '可先看逾期和金额较大的单据',
      href: '/finance/payables',
      count: metrics.payables.count,
      amount: metrics.payables.amount,
      icon: TrendingDown,
      tone: 'info',
      visible: canManageFinance,
    },
  ];

  return items
    .filter(item => item.visible && item.count > 0)
    .sort((left, right) => {
      const tonePriority: Record<WorkbenchTone, number> = {
        urgent: 4,
        warning: 3,
        info: 2,
        success: 1,
      };

      const priorityDiff = tonePriority[right.tone] - tonePriority[left.tone];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return right.amount - left.amount;
    })
    .slice(0, 6);
}

function getFinanceWorkbenchSummary(userRole: UserRole) {
  switch (userRole) {
    case 'finance':
      return '财务员今天优先确认到账、确认付款、处理退款，再补齐费用审核。';
    case 'sales':
      return '销售今天优先跟进客户待收和到账进度，避免订单推进和回款脱节。';
    case 'admin':
      return '管理员今天优先关注逾期、待确认和异常金额，先把高风险事项压下去。';
    default:
      return '今天先处理最影响回款和结算的事项，再看报表和对账。';
  }
}

function getWorkbenchToneStyles(tone: WorkbenchTone) {
  switch (tone) {
    case 'urgent':
      return {
        badge:
          'bg-[hsl(var(--color-error-light))] text-[hsl(var(--color-error))]',
        icon: 'bg-[hsl(var(--color-error))] text-white',
        amount: 'text-[hsl(var(--color-error))]',
      };
    case 'warning':
      return {
        badge:
          'bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]',
        icon: 'bg-[hsl(var(--color-warning))] text-white',
        amount: 'text-[hsl(var(--color-warning))]',
      };
    case 'success':
      return {
        badge:
          'bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
        icon: 'bg-[hsl(var(--color-success))] text-white',
        amount: 'text-[hsl(var(--color-success))]',
      };
    default:
      return {
        badge:
          'bg-[hsl(var(--color-primary-light))] text-[hsl(var(--color-primary))]',
        icon: 'bg-[hsl(var(--color-primary))] text-white',
        amount: 'text-[hsl(var(--color-primary))]',
      };
  }
}

function FinanceWorkbenchSection({
  cards,
  summary,
}: {
  cards: FinanceWorkbenchCard[];
  summary: string;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[hsl(var(--color-text-primary))] sm:text-lg">
          今日待办
        </h2>
        <p className="text-muted-foreground text-sm">{summary}</p>
      </div>

      {cards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(card => {
            const IconComponent = card.icon;
            const toneStyles = getWorkbenchToneStyles(card.tone);

            return (
              <Card
                key={card.id}
                className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)]"
              >
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneStyles.icon}`}
                    >
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <Badge className={`text-xs ${toneStyles.badge}`}>
                      {card.count} 项
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
                      {card.title}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {card.description}
                    </p>
                  </div>

                  <div className="space-y-1 rounded-xl bg-[hsl(var(--color-bg-secondary))] px-3 py-3">
                    <p className={`text-xl font-bold ${toneStyles.amount}`}>
                      {formatCurrency(card.amount)}
                    </p>
                    <p className="text-muted-foreground text-xs">{card.hint}</p>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-xs">
                      {card.count} 项待处理
                    </span>
                    <Button asChild size="sm">
                      <Link href={card.href}>
                        立即处理
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border border-[hsl(var(--color-border-secondary))] shadow-[var(--shadow-light)]">
          <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
                今天的财务待办已经清空
              </p>
              <p className="text-muted-foreground text-sm">
                当前没有待确认到账、待确认付款、待退款或待审核费用，可以开始看报表和经营数据。
              </p>
            </div>
            <Badge
              variant="secondary"
              className="w-fit bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]"
            >
              进度正常
            </Badge>
          </CardContent>
        </Card>
      )}
    </section>
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
      hint: '查看待付款和已付款进度',
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
          title: '收款管理',
          description: '查看收款、确认到账',
          href: '/finance/payments',
          icon: CreditCard,
        },
        {
          id: 'payments-out',
          title: '付款管理',
          description: '查看待确认与已完成付款',
          href: '/finance/payments-out',
          icon: CreditCard,
        },
        {
          id: 'expenses',
          title: '费用管理',
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
