/**
 * 运输查询页面
 * ✅ 符合产品模块UI风格规范
 * SOLID-S: 页面组件只负责查询表单和历史记录展示
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Package,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import type {
  ShippingQueriesResponse,
  ShippingQuery,
  ShippingSitesResponse,
} from '@/lib/types/shipping';
import { cn } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';

export default function ShippingQueryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 表单状态
  const [siteId, setSiteId] = React.useState('');
  const [keyword, setKeyword] = React.useState('');
  const [currentResult, setCurrentResult] = React.useState<
    ShippingQuery | undefined
  >();

  // 获取站点列表
  const { data: sitesData } = useQuery<ShippingSitesResponse>({
    queryKey: queryKeys.settings.shippingSites('active'),
    queryFn: async () => {
      const response = await fetch('/api/shipping/sites?status=active');
      if (!response.ok) {
        throw new Error('获取站点列表失败');
      }
      const result: { success: boolean; data: ShippingSitesResponse } =
        await response.json();
      if (!result.success) {
        throw new Error('获取站点列表失败');
      }
      return result.data;
    },
  });

  // 获取查询历史
  const { data: queriesData, isLoading: isLoadingHistory } =
    useQuery<ShippingQueriesResponse>({
      queryKey: queryKeys.settings.shippingQueries(),
      queryFn: async () => {
        const response = await fetch('/api/shipping/query?limit=50');
        if (!response.ok) {
          throw new Error('获取查询历史失败');
        }
        const result: { success: boolean; data: ShippingQueriesResponse } =
          await response.json();
        if (!result.success) {
          throw new Error('获取查询历史失败');
        }
        return result.data;
      },
    });

  // 执行查询
  const queryMutation = useMutation({
    mutationFn: async (data: { siteId: string; keyword: string }) => {
      const response = await fetch(
        '/api/shipping/query',
        getCsrfTokenHeader({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '查询失败');
      }
      const result = await response.json();
      return result.data as ShippingQuery;
    },
    onSuccess: data => {
      setCurrentResult(data);
      if (data.queryStatus === 'success') {
        toast({
          title: '查询成功',
          description: '已获取运输信息',
          variant: 'success',
        });
      } else {
        toast({
          title: '查询失败',
          description: data.errorMessage || '无法获取运输信息',
          variant: 'destructive',
        });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.shippingQueries(),
      });
    },
    onError: (error: Error) => {
      toast({
        title: '查询失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleQuery = () => {
    if (!siteId) {
      toast({
        title: '验证失败',
        description: '请选择查询站点',
        variant: 'destructive',
      });
      return;
    }

    if (!keyword.trim()) {
      toast({
        title: '验证失败',
        description: '请输入追踪单号',
        variant: 'destructive',
      });
      return;
    }

    queryMutation.mutate({ siteId, keyword: keyword.trim() });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="flex-1 space-y-6 overflow-y-auto">
        {/* 页面头部 */}
        <Card className="relative overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-md bg-slate-900 shadow-sm">
                  <Package className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                    运输查询
                  </h1>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    物流状态查询
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push('/settings')}
                className="h-12 border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回系统设置
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 查询表单 */}
        <Card className="overflow-hidden rounded-md border border-slate-200 shadow-sm">
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-8 lg:grid-cols-12">
              <div className="space-y-2 lg:col-span-5">
                <Label
                  htmlFor="site"
                  className="text-xs font-semibold text-slate-500"
                >
                  查询站点 *
                </Label>
                <select
                  id="site"
                  value={siteId}
                  onChange={e => setSiteId(e.target.value)}
                  className="ring-offset-background h-12 w-full rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" disabled>
                    选择目标物流站点
                  </option>
                  {sitesData?.data.map(site => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 lg:col-span-7">
                <Label
                  htmlFor="keyword"
                  className="text-xs font-semibold text-slate-500"
                >
                  追踪单号 *
                </Label>
                <div className="flex gap-3">
                  <Input
                    id="keyword"
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    className="h-12 flex-1 border-slate-200 bg-slate-50/50 font-mono text-lg focus:ring-purple-500"
                    placeholder="输入追踪单号"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !queryMutation.isPending) {
                        handleQuery();
                      }
                    }}
                  />
                  <Button
                    onClick={handleQuery}
                    disabled={queryMutation.isPending}
                    className="h-12 bg-slate-900 px-8 shadow-sm hover:bg-slate-800"
                  >
                    {queryMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        查询中
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-5 w-5" />
                        查询
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* 查询结果展示 */}
            {currentResult && (
              <div className="relative mt-8 overflow-hidden rounded-md border border-slate-100 bg-slate-50/30 p-8 shadow-sm">
                {/* 状态背景水印 */}
                <div className="absolute -top-8 -right-8 opacity-[0.03]">
                  {currentResult.queryStatus === 'success' ? (
                    <Package size={160} />
                  ) : (
                    <AlertCircle size={160} />
                  )}
                </div>

                <div className="relative z-10">
                  <div className="mb-8 flex items-center justify-between">
                    <h3 className="border-l-4 border-slate-900 pl-3 text-sm font-semibold text-slate-900">
                      运输状态
                    </h3>
                    <span
                      className={cn(
                        'rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm',
                        currentResult.queryStatus === 'success'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-rose-500 text-white'
                      )}
                    >
                      {currentResult.queryStatus === 'success'
                        ? '查询成功'
                        : '查询失败'}
                    </span>
                  </div>

                  {currentResult.queryStatus === 'success' ? (
                    <div className="grid gap-8 md:grid-cols-3">
                      <div className="space-y-4">
                        <div className="text-[11px] font-semibold tracking-tight text-slate-400">
                          追踪单号
                        </div>
                        <div className="font-mono text-xl leading-none font-semibold text-slate-900">
                          {currentResult.trackingNumber}
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                          目的地：{currentResult.destination || '未知'}
                        </div>
                      </div>
                      <div className="space-y-4 md:border-x md:border-slate-200 md:px-8">
                        <div className="text-[11px] font-semibold tracking-tight text-slate-400">
                          当前物流节点
                        </div>
                        <div className="text-lg leading-none font-semibold text-slate-900">
                          {currentResult.status || '准备中'}
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                          最后更新：
                          {currentResult.lastUpdateTime
                            ? new Date(
                                currentResult.lastUpdateTime
                              ).toLocaleString('zh-CN')
                            : '-'}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="text-[11px] font-semibold tracking-tight text-slate-400">
                          预计送达日期
                        </div>
                        <div className="text-lg leading-none font-semibold text-blue-600">
                          {currentResult.estimatedArrival
                            ? new Date(
                                currentResult.estimatedArrival
                              ).toLocaleDateString('zh-CN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })
                            : '计算中...'}
                        </div>
                        <div className="text-xs font-bold text-slate-500">
                          优先级：标准空运
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 rounded-md border border-rose-100 bg-rose-50 p-6 text-rose-600">
                      <AlertCircle className="h-6 w-6 shrink-0" />
                      <div>
                        <div className="mb-1 text-sm font-semibold">
                          查询失败
                        </div>
                        <div className="text-sm font-bold opacity-80">
                          {currentResult.errorMessage}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 查询历史 */}
        <Card className="overflow-hidden rounded-md border border-slate-200 shadow-sm">
          <CardHeader className="relative overflow-hidden border-b border-slate-50 bg-slate-50/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center text-lg font-semibold tracking-tight text-slate-900">
                  查询历史
                </CardTitle>
                <CardDescription className="mt-1 text-xs font-bold text-slate-400">
                  最近 50 条
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-300 transition-colors hover:text-slate-900"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingHistory ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">加载中...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead>查询时间</TableHead>
                    <TableHead>物流站点</TableHead>
                    <TableHead>追踪单号</TableHead>
                    <TableHead>实时状态</TableHead>
                    <TableHead className="text-right">同步结果</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queriesData?.data.map(query => (
                    <TableRow
                      key={query.id}
                      className="group transition-colors hover:bg-slate-50/30"
                    >
                      <TableCell className="text-xs font-bold text-slate-500">
                        {new Date(query.queriedAt).toLocaleString('zh-CN', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-900">
                        {query.site?.name || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-slate-900">
                        {query.trackingNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-900">
                            {query.status || '暂无更新'}
                          </span>
                          <span className="mt-0.5 text-[10px] font-bold tracking-tight text-slate-400">
                            {query.destination || '目的地：未知'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-lg px-3 py-1 text-[10px] font-semibold shadow-sm',
                            query.queryStatus === 'success'
                              ? 'content-emerald-600 border border-emerald-200 bg-emerald-50 text-emerald-600'
                              : query.queryStatus === 'failed'
                                ? 'border border-rose-200 bg-rose-50 text-rose-600'
                                : 'border border-slate-200 bg-slate-50 text-slate-500'
                          )}
                        >
                          {query.queryStatus === 'success'
                            ? '成功'
                            : query.queryStatus === 'failed'
                              ? '失败'
                              : '同步中'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
