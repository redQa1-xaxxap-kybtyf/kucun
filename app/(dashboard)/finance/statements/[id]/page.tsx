'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  FileText,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ContentLoading } from '@/components/common/loading';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { queryKeys } from '@/lib/queryKeys';
import type { AccountStatementDetail } from '@/lib/types/statement';
import { formatCurrency } from '@/lib/utils/format';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

import { StatementBasicInfo } from './components/statement-basic-info';
import { StatementHeader } from './components/statement-header';
import { StatementStatistics } from './components/statement-statistics';
import { StatementTransactions } from './components/statement-transactions';

const DateRangePicker = dynamic(
  () =>
    import('@/components/ui/date-range-picker').then(mod => mod.DateRangePicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-10 w-full animate-pulse rounded-md bg-slate-100" />
    ),
  }
);

const DEFAULT_RANGE_DAYS = 90; // 默认显示最近 90 天

function pad2(value: number) {
  return value.toString().padStart(2, '0');
}

function toISODateStringLocal(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function subDaysLocal(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() - days);
  return next;
}

/**
 * 往来账单详情页面
 * 显示客户或供应商的详细账务往来信息
 */
export default function StatementDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  // 日期范围默认值
  const today = new Date();
  const defaultEndDate = toISODateStringLocal(today);
  const defaultStartDate = toISODateStringLocal(
    subDaysLocal(today, DEFAULT_RANGE_DAYS)
  );

  // 从 URL 参数获取日期范围
  const queryStart = searchParams.get('startDate') ?? defaultStartDate;
  const queryEnd = searchParams.get('endDate') ?? defaultEndDate;

  // 日期范围状态
  const [dateRange, setDateRange] = useState({
    startDate: queryStart,
    endDate: queryEnd,
  });

  // 同步 URL 参数到本地状态
  useEffect(() => {
    setDateRange(prev => {
      if (prev.startDate === queryStart && prev.endDate === queryEnd) {
        return prev;
      }
      return {
        startDate: queryStart,
        endDate: queryEnd,
      };
    });
  }, [queryStart, queryEnd]);

  // 同步本地状态到 URL 参数
  useEffect(() => {
    if (!id) {
      return;
    }

    const currentStart = searchParams.get('startDate');
    const currentEnd = searchParams.get('endDate');

    if (
      currentStart === dateRange.startDate &&
      currentEnd === dateRange.endDate
    ) {
      return;
    }

    const params = new URLSearchParams();
    if (dateRange.startDate) {
      params.set('startDate', dateRange.startDate);
    }
    if (dateRange.endDate) {
      params.set('endDate', dateRange.endDate);
    }

    const queryString = params.toString();

    router.replace(
      queryString
        ? `/finance/statements/${id}?${queryString}`
        : `/finance/statements/${id}`,
      { scroll: false }
    );
  }, [id, dateRange.startDate, dateRange.endDate, router, searchParams]);

  // 验证日期范围
  const isRangeValid =
    Boolean(dateRange.startDate) &&
    Boolean(dateRange.endDate) &&
    new Date(dateRange.startDate).getTime() <=
      new Date(dateRange.endDate).getTime();

  // API 调用函数 - 添加日期参数
  const fetchStatementDetail = async (): Promise<AccountStatementDetail> => {
    if (!id) {
      throw new Error('缺少账单编号');
    }

    // 构建查询参数
    const params = new URLSearchParams();
    if (dateRange.startDate) {
      params.set('startDate', dateRange.startDate);
    }
    if (dateRange.endDate) {
      params.set('endDate', dateRange.endDate);
    }

    const queryString = params.toString();
    const url = queryString
      ? `/api/finance/statements/${id}?${queryString}`
      : `/api/finance/statements/${id}`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '获取账单详情失败');
    }
    const result = await response.json();
    return result.data;
  };

  // 使用 TanStack Query 获取数据
  const {
    data: statement,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<AccountStatementDetail>({
    queryKey: [
      ...queryKeys.finance.statement(id),
      dateRange.startDate,
      dateRange.endDate,
    ],
    queryFn: fetchStatementDetail,
    enabled: !!id && isRangeValid,
    staleTime: 5 * 60 * 1000,
  });

  // 日期范围无效
  if (!isRangeValid) {
    return (
      <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
        <div className="space-y-4 sm:space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/finance/statements')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回往来对账
            </Button>
            <h1 className="text-2xl font-semibold">往来对账详情</h1>
          </div>
          <Card>
            <CardContent className="p-8">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-[hsl(var(--color-warning))]">
                  日期范围无效
                </h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  开始日期不能晚于结束日期，请调整后重试。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <ContentLoading text="正在加载对账单..." />;
  }

  if (isError || !statement) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
            加载失败
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {getFriendlyErrorMessage(
              error,
              '往来对账暂时无法加载，请稍后重试'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/finance/statements')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回往来对账
          </Button>
          <Button onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? '重试中...' : '重试'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面头部 */}
        <StatementHeader
          name={statement.entity?.name ?? statement.entityName}
          type={statement.entityType}
          status={statement.status}
          currentBalance={statement.currentBalance}
        />

        {/* 顶部 Stat Hub + 筛选控制中心 */}
        <Card className="overflow-hidden border-slate-200/60 bg-white shadow-sm transition-all hover:shadow-md">
          <CardContent className="p-0">
            {/* 第一层：Stat Hub 统计数据 */}
            <div className="grid grid-cols-2 lg:grid-cols-4">
              {/* 总订单数 */}
              <div className="group relative flex flex-col p-6 transition-colors hover:bg-blue-50/30">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100/80 text-blue-600 transition-transform group-hover:scale-110">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    成交笔数
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold tracking-tight text-slate-900">
                    {statement.totalOrders}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    单
                  </span>
                </div>
                <div className="absolute inset-y-6 right-0 hidden w-px bg-slate-100 lg:block" />
              </div>

              {/* 总交易额 */}
              <div className="group relative flex flex-col p-6 transition-colors hover:bg-purple-50/30">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100/80 text-purple-600 transition-transform group-hover:scale-110">
                    <ChineseYuan className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    往来总额
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold tracking-tight text-slate-900">
                    {formatCurrency(Math.abs(statement.totalAmount)).replace(
                      '¥',
                      ''
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    元
                  </span>
                </div>
                <div className="absolute inset-y-6 right-0 hidden w-px bg-slate-100 lg:block" />
              </div>

              {/* 累计收付 */}
              <div className="group relative flex flex-col p-6 transition-colors hover:bg-emerald-50/30">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100/80 text-emerald-600 transition-transform group-hover:scale-110">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    已结清额
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-semibold tracking-tight text-slate-900">
                    {formatCurrency(Math.abs(statement.paidAmount)).replace(
                      '¥',
                      ''
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    元
                  </span>
                </div>
                <div className="absolute inset-y-6 right-0 hidden w-px bg-slate-100 lg:block" />
              </div>

              {/* 余额 */}
              <div
                className={`group relative flex flex-col p-6 transition-colors ${
                  statement.currentBalance > 0
                    ? 'hover:bg-orange-50/30'
                    : 'hover:bg-rose-50/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      statement.currentBalance > 0
                        ? 'bg-orange-100/80 text-orange-600'
                        : 'bg-rose-100/80 text-rose-600'
                    } transition-transform group-hover:scale-110`}
                  >
                    <TrendingDown className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">
                    {statement.currentBalance > 0 ? '应收余额' : '应付余额'}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span
                    className={`text-2xl font-semibold tracking-tight ${
                      statement.currentBalance > 0
                        ? 'text-orange-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {formatCurrency(Math.abs(statement.currentBalance)).replace(
                      '¥',
                      ''
                    )}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    元
                  </span>
                </div>
              </div>
            </div>

            {/* 第二层：筛选器控制条 */}
            <div className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50/50 p-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="min-w-[320px]">
                  <DateRangePicker
                    value={{
                      startDate: dateRange.startDate,
                      endDate: dateRange.endDate,
                    }}
                    onChange={({ startDate, endDate }) => {
                      setDateRange({
                        startDate: startDate || defaultStartDate,
                        endDate: endDate || defaultEndDate,
                      });
                    }}
                    label=""
                    maxDate={today}
                    showPresets={true}
                    showClearButton={false}
                    className="border-none bg-transparent p-0 shadow-none ring-0 focus-visible:ring-0"
                  />
                </div>
                <div className="hidden h-6 w-px bg-slate-200 sm:block" />
                <div className="text-xs font-bold text-slate-400">
                  查询周期内共涉及{' '}
                  <span className="font-mono text-slate-700">
                    {statement.totalOrders}
                  </span>{' '}
                  笔业务往来
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="h-9 px-4 text-xs font-bold text-slate-500 hover:bg-white hover:text-blue-600"
                >
                  <RefreshCw
                    className={`mr-2 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
                  />
                  刷新对账单
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 主要内容区域 - 全宽交易记录 */}
        <div className="space-y-6">
          {/* 交易记录 - 占据全宽 */}
          <StatementTransactions transactions={statement.transactions} />

          {/* 底部信息区域 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 基本信息 */}
            <StatementBasicInfo
              entity={{
                name: statement.entity?.name ?? statement.entityName,
                phone: statement.entity?.phone,
                address: statement.entity?.address,
              }}
              partnerRole={statement.partnerRole}
              lastTransactionDate={statement.lastTransactionDate}
              lastPaymentDate={statement.lastPaymentDate}
            />

            {/* 统计数据 */}
            <StatementStatistics summary={statement.summary} />
          </div>
        </div>
      </div>
    </div>
  );
}
