/**
 * 运输查询页面
 * ✅ 符合产品模块UI风格规范
 * SOLID-S: 页面组件只负责查询表单和历史记录展示
 */

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Package, Search } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
      const response = await fetch('/api/shipping/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

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
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600 shadow-lg shadow-purple-600/30">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    运输查询
                  </h1>
                  <p className="text-sm text-gray-600">
                    查询快递物流运输状态信息
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push('/settings')}
                className="h-11 gap-2 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                <ArrowLeft className="h-4 w-4" />
                返回设置
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 查询表单 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="space-y-6 p-6">
            <div className="flex items-start gap-3 text-sm text-gray-600">
              <Search className="h-4 w-4 text-purple-600" />
              <span>选择站点并输入追踪单号（支持中文自动转换）</span>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="site">查询站点 *</Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger id="site">
                    <SelectValue placeholder="选择查询站点" />
                  </SelectTrigger>
                  <SelectContent>
                    {sitesData?.data.map(site => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="keyword">追踪单号 *</Label>
                <div className="flex gap-2">
                  <Input
                    id="keyword"
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    placeholder="输入追踪单号（支持中文）"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !queryMutation.isPending) {
                        handleQuery();
                      }
                    }}
                  />
                  <Button
                    onClick={handleQuery}
                    disabled={queryMutation.isPending}
                  >
                    {queryMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        查询中
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        查询
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* 查询结果展示 */}
            {currentResult && (
              <div className="mt-6 rounded-lg border bg-slate-50 p-4">
                <h3 className="mb-3 font-medium text-gray-900">查询结果</h3>
                {currentResult.queryStatus === 'success' ? (
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <span className="text-gray-600">追踪单号：</span>
                      <span className="font-medium">
                        {currentResult.trackingNumber}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">当前状态：</span>
                      <span className="font-medium">
                        {currentResult.status || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">目的地：</span>
                      <span className="font-medium">
                        {currentResult.destination || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">预计到达：</span>
                      <span className="font-medium">
                        {currentResult.estimatedArrival
                          ? new Date(
                              currentResult.estimatedArrival
                            ).toLocaleString('zh-CN')
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">最后更新：</span>
                      <span className="font-medium">
                        {currentResult.lastUpdateTime
                          ? new Date(
                              currentResult.lastUpdateTime
                            ).toLocaleString('zh-CN')
                          : '-'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-red-600">
                    查询失败：{currentResult.errorMessage}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 查询历史 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-gray-50">
            <CardTitle className="flex items-center text-gray-900">
              <Package className="mr-2 h-5 w-5 text-purple-600" />
              查询历史记录
            </CardTitle>
            <CardDescription>最近50条查询记录</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {isLoadingHistory ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">加载中...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>查询时间</TableHead>
                    <TableHead>站点</TableHead>
                    <TableHead>追踪单号</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>目的地</TableHead>
                    <TableHead>预到时间</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead>查询结果</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queriesData?.data.map(query => (
                    <TableRow key={query.id}>
                      <TableCell className="text-xs">
                        {new Date(query.queriedAt).toLocaleString('zh-CN')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {query.site?.name || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {query.trackingNumber}
                      </TableCell>
                      <TableCell>{query.status || '-'}</TableCell>
                      <TableCell>{query.destination || '-'}</TableCell>
                      <TableCell className="text-xs">
                        {query.estimatedArrival
                          ? new Date(query.estimatedArrival).toLocaleString(
                              'zh-CN'
                            )
                          : '-'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {query.lastUpdateTime
                          ? new Date(query.lastUpdateTime).toLocaleString(
                              'zh-CN'
                            )
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-full px-2 py-1 text-xs ${
                            query.queryStatus === 'success'
                              ? 'bg-green-100 text-green-800'
                              : query.queryStatus === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {query.queryStatus === 'success'
                            ? '成功'
                            : query.queryStatus === 'failed'
                              ? '失败'
                              : '处理中'}
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
