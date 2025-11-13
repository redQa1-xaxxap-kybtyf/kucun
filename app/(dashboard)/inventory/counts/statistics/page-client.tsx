'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PageHeader } from '@/components/common/page-header';
import { CountStatisticsCards } from '@/components/inventory/counts/count-statistics-cards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { queryKeys } from '@/lib/queryKeys';
import { COUNT_STATUS_OPTIONS } from '@/lib/types/inventory-count';

const SELECT_ALL_VALUE = 'all';

interface CountStatisticsPageClientProps {
  initialParams: {
    startDate: string;
    endDate: string;
    status?: string;
  };
}

export function CountStatisticsPageClient({
  initialParams,
}: CountStatisticsPageClientProps) {
  const router = useRouter();

  // 筛选参数状态
  const [filters, setFilters] = React.useState({
    startDate: initialParams.startDate,
    endDate: initialParams.endDate,
    status: initialParams.status || SELECT_ALL_VALUE,
  });

  // 本地筛选状态（用于输入）
  const [localFilters, setLocalFilters] = React.useState(filters);

  // 查询统计数据
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.inventory.countsStatistics({
      startDate: filters.startDate,
      endDate: filters.endDate,
      status: filters.status === SELECT_ALL_VALUE ? undefined : filters.status,
    }),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('startDate', filters.startDate);
      params.set('endDate', filters.endDate);
      if (filters.status !== SELECT_ALL_VALUE) {
        params.set('status', filters.status);
      }

      const response = await fetch(
        `/api/inventory/counts/statistics?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error('获取统计数据失败');
      }
      return response.json();
    },
  });

  const statistics = data?.data;

  // 更新 URL 查询参数
  const updateURL = React.useCallback(
    (newFilters: typeof filters) => {
      const params = new URLSearchParams();

      if (newFilters.startDate) {
        params.set('startDate', newFilters.startDate);
      }
      if (newFilters.endDate) {
        params.set('endDate', newFilters.endDate);
      }
      if (newFilters.status && newFilters.status !== SELECT_ALL_VALUE) {
        params.set('status', newFilters.status);
      }

      const queryString = params.toString();
      router.push(
        `/inventory/counts/statistics${queryString ? `?${queryString}` : ''}`,
        {
          scroll: false,
        }
      );
    },
    [router]
  );

  // 处理筛选条件变化
  const handleFilterChange = (
    key: keyof typeof localFilters,
    value: string
  ) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  // 应用筛选
  const handleApplyFilters = () => {
    setFilters(localFilters);
    updateURL(localFilters);
  };

  // 重置筛选
  const handleResetFilters = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const resetFilters = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      status: SELECT_ALL_VALUE,
    };

    setLocalFilters(resetFilters);
    setFilters(resetFilters);
    updateURL(resetFilters);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <PageHeader
        title="盘点统计"
        description="查看库存盘点统计数据和分析"
        icon={<BarChart3 className="h-6 w-6 text-white" />}
        iconBgColor="hsl(var(--color-info))"
        actions={
          <Button variant="outline" size="lg" asChild className="h-11 gap-2">
            <Link href="/inventory/counts">
              <ArrowLeft className="h-4 w-4" />
              返回列表
            </Link>
          </Button>
        }
      />

      {/* 筛选条件 */}
      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <DateRangePicker
                value={{
                  startDate: localFilters.startDate || undefined,
                  endDate: localFilters.endDate || undefined,
                }}
                onChange={({ startDate, endDate }) => {
                  handleFilterChange('startDate', startDate ?? '');
                  handleFilterChange('endDate', endDate ?? '');
                }}
                label="日期范围"
                placeholder="选择日期范围"
                showPresets
                showClearButton
                className="w-full md:w-[240px]"
              />

              {/* 盘点状态 */}
              <div className="space-y-2">
                <Label htmlFor="status">盘点状态</Label>
                <Select
                  value={localFilters.status}
                  onValueChange={value => handleFilterChange('status', value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_ALL_VALUE}>全部状态</SelectItem>
                    {COUNT_STATUS_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              <Button onClick={handleApplyFilters}>
                <Search className="mr-2 h-4 w-4" />
                查询
              </Button>
              <Button variant="outline" onClick={handleResetFilters}>
                <X className="mr-2 h-4 w-4" />
                重置
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">统计概览</h2>
        {statistics ? (
          <CountStatisticsCards statistics={statistics} isLoading={isLoading} />
        ) : (
          <div className="text-muted-foreground py-8 text-center">
            {isLoading ? '加载中...' : '暂无统计数据'}
          </div>
        )}
      </div>

      {/* 按类型分组统计 */}
      {statistics?.byType && statistics.byType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>按盘点类型统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statistics.byType.map(
                (item: {
                  countType: string;
                  countTypeName: string;
                  count: number;
                  percentage: number;
                }) => (
                  <div key={item.countType} className="flex items-center">
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {item.countTypeName}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {item.count} 次 ({item.percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="bg-secondary mt-2 h-2 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
