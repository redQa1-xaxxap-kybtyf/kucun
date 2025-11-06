'use client';

import {
  CheckCircle,
  FileText,
  Loader2,
  Package,
  TrendingDown,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { InventoryCountStatistics } from '@/lib/types/inventory-count';

interface CountStatisticsCardsProps {
  statistics: InventoryCountStatistics;
  isLoading?: boolean;
}

export function CountStatisticsCards({
  statistics,
  isLoading,
}: CountStatisticsCardsProps) {
  const formatNumber = (value: number) => value.toLocaleString('zh-CN');
  const formatCurrency = (value: number) =>
    value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const getRatioText = (value: number, total: number) =>
    total > 0 ? `占比 ${((value / total) * 100).toFixed(1)}%` : '暂无数据';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  const cardConfigs = [
    {
      id: 'totalCounts',
      title: '总盘点次数',
      icon: FileText,
      value: formatNumber(statistics.totalCounts),
      description: `草稿 ${formatNumber(statistics.draftCounts)} 个`,
    },
    {
      id: 'inProgressCounts',
      title: '进行中盘点',
      icon: Loader2,
      value: formatNumber(statistics.inProgressCounts),
      description: getRatioText(
        statistics.inProgressCounts,
        statistics.totalCounts
      ),
    },
    {
      id: 'completedCounts',
      title: '已完成盘点',
      icon: CheckCircle,
      value: formatNumber(statistics.completedCounts),
      description: getRatioText(
        statistics.completedCounts,
        statistics.totalCounts
      ),
    },
    {
      id: 'differenceItems',
      title: '差异明细总数',
      icon: Package,
      value: formatNumber(statistics.differenceItems),
      description: `总明细 ${formatNumber(statistics.totalItems)} 个`,
    },
    {
      id: 'totalDifferenceCost',
      title: '差异总金额',
      icon: TrendingDown,
      value: `￥${formatCurrency(statistics.totalDifferenceCost)}`,
      description: `差异数量 ${formatNumber(statistics.totalDifference)}`,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cardConfigs.map(({ id, title, icon: Icon, value, description }) => (
        <Card key={id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-muted-foreground text-xs">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
