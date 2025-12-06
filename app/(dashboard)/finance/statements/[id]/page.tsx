'use client';

import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import {
  ArrowLeft,
  FileText,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ContentLoading } from '@/components/common/loading';
import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { queryKeys } from '@/lib/queryKeys';
import type { AccountStatementDetail } from '@/lib/types/statement';
import { formatCurrency } from '@/lib/utils/format';

import { StatementBasicInfo } from './components/statement-basic-info';
import { StatementHeader } from './components/statement-header';
import { StatementStatistics } from './components/statement-statistics';
import { StatementTransactions } from './components/statement-transactions';

const DEFAULT_RANGE_DAYS = 90; // 默认显示最近 90 天

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
  const defaultEndDate = format(today, 'yyyy-MM-dd');
  const defaultStartDate = format(
    subDays(today, DEFAULT_RANGE_DAYS),
    'yyyy-MM-dd'
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
      throw new Error('ID 不能为空');
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
              返回列表
            </Button>
            <h1 className="text-2xl font-semibold">往来账单详情</h1>
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
    return <ContentLoading text="加载账单详情..." />;
  }

  if (isError || !statement) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4 p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
            加载失败
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            {error instanceof Error ? error.message : '获取账单详情失败'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/finance/statements')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回列表
          </Button>
          <Button onClick={() => window.location.reload()}>重试</Button>
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

        {/* 日期筛选器 */}
        <Card>
          <CardHeader>
            <CardTitle>筛选条件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1 md:max-w-md">
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
                  label="交易日期范围"
                  maxDate={today}
                  showPresets={true}
                  showClearButton={false}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                  />
                  刷新
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 财务概览 - 横向卡片组 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 dark:border-blue-800 dark:from-blue-950 dark:to-blue-900">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    总订单数
                  </p>
                  <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                    {statement.totalOrders}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    累计交易笔数
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800">
                  <FileText className="h-6 w-6 text-blue-700 dark:text-blue-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 dark:border-purple-800 dark:from-purple-950 dark:to-purple-900">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    总交易额
                  </p>
                  <p className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                    {formatCurrency(Math.abs(statement.totalAmount))}
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    业务往来总额
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-200 dark:bg-purple-800">
                  <ChineseYuan className="h-6 w-6 text-purple-700 dark:text-purple-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100 dark:border-green-800 dark:from-green-950 dark:to-green-900">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    累计收付
                  </p>
                  <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                    {formatCurrency(Math.abs(statement.paidAmount))}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    已完成金额
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-200 dark:bg-green-800">
                  <TrendingUp className="h-6 w-6 text-green-700 dark:text-green-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`border-2 bg-gradient-to-br ${
              statement.currentBalance > 0
                ? 'border-orange-300 from-orange-50 to-orange-100 dark:border-orange-700 dark:from-orange-950 dark:to-orange-900'
                : statement.currentBalance < 0
                  ? 'border-red-300 from-red-50 to-red-100 dark:border-red-700 dark:from-red-950 dark:to-red-900'
                  : 'border-gray-300 from-gray-50 to-gray-100 dark:border-gray-700 dark:from-gray-950 dark:to-gray-900'
            }`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p
                    className={`text-sm font-medium ${
                      statement.currentBalance > 0
                        ? 'text-orange-700 dark:text-orange-300'
                        : statement.currentBalance < 0
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {statement.currentBalance > 0
                      ? '应收余额'
                      : statement.currentBalance < 0
                        ? '应付余额'
                        : '已结清'}
                  </p>
                  <p
                    className={`text-3xl font-bold ${
                      statement.currentBalance > 0
                        ? 'text-orange-900 dark:text-orange-100'
                        : statement.currentBalance < 0
                          ? 'text-red-900 dark:text-red-100'
                          : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {formatCurrency(Math.abs(statement.currentBalance))}
                  </p>
                  <p
                    className={`text-xs ${
                      statement.currentBalance > 0
                        ? 'text-orange-600 dark:text-orange-400'
                        : statement.currentBalance < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {statement.currentBalance > 0
                      ? '待收款项'
                      : statement.currentBalance < 0
                        ? '待付款项'
                        : '无欠款'}
                  </p>
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${
                    statement.currentBalance > 0
                      ? 'bg-orange-200 dark:bg-orange-800'
                      : statement.currentBalance < 0
                        ? 'bg-red-200 dark:bg-red-800'
                        : 'bg-gray-200 dark:bg-gray-800'
                  }`}
                >
                  <TrendingDown
                    className={`h-6 w-6 ${
                      statement.currentBalance > 0
                        ? 'text-orange-700 dark:text-orange-300'
                        : statement.currentBalance < 0
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-gray-700 dark:text-gray-300'
                    }`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
