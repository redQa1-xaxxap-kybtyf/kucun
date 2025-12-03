'use client';

import {
  AlertTriangle,
  DollarSign,
  Package,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CountUp } from '@/components/ui/count-up';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { can } from '@/lib/auth/permissions';
import { ExportService } from '@/lib/services/export-service';
import type { InventoryStatistics } from '@/lib/types/inventory-statistics';

interface InventoryStatisticsCardsProps {
  statistics: InventoryStatistics | null;
  isLoading?: boolean;
}

interface StatCard {
  id: string;
  title: string;
  icon: typeof DollarSign;
  value: React.ReactNode;
  description: string;
  color: string;
  bgColor: string;
}

/**
 * 获取库存健康度的颜色
 */
function getStockHealthColor(percentage: number) {
  if (percentage >= 80)
    return { color: 'text-green-600', bgColor: 'bg-green-50' };
  if (percentage >= 60)
    return { color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
  return { color: 'text-red-600', bgColor: 'bg-red-50' };
}

/**
 * 构建统计卡片数组
 */
function buildStatCards(
  statistics: InventoryStatistics,
  hasFinancePermission: boolean
): StatCard[] {
  const cards: StatCard[] = [];

  // 财务卡片：仅在有权限且数据存在时显示
  if (hasFinancePermission && statistics.totalValue !== undefined) {
    cards.push({
      id: 'totalValue',
      title: '库存总金额',
      icon: DollarSign,
      value: (
        <CountUp
          end={statistics.totalValue}
          prefix="¥"
          decimals={2}
          separator=","
        />
      ),
      description: '当前库存总价值',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    });
  }

  if (hasFinancePermission && statistics.openingBalance) {
    cards.push({
      id: 'openingBalance',
      title: '期初库存金额',
      icon: Wallet,
      value: (
        <CountUp
          end={statistics.openingBalance.totalCost}
          prefix="¥"
          decimals={2}
          separator=","
        />
      ),
      description: `${statistics.openingBalance.recordCount} 条期初记录`,
      color: 'text-[hsl(var(--color-primary))]',
      bgColor: 'bg-[hsl(var(--color-primary-light))]',
    });
  }

  // 公共卡片：所有用户可见
  cards.push(
    {
      id: 'totalProducts',
      title: '库存产品数',
      icon: Package,
      value: <CountUp end={statistics.totalProducts} separator="," />,
      description: 'SKU 数量',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      id: 'totalQuantity',
      title: '库存总数量',
      icon: TrendingUp,
      value: <CountUp end={statistics.totalQuantity} separator="," />,
      description: '片',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    }
  );

  // 库存健康度卡片
  const healthColors = getStockHealthColor(statistics.stockHealthPercentage);
  cards.push({
    id: 'stockHealth',
    title: '库存健康度',
    icon: AlertTriangle,
    value: (
      <CountUp
        end={statistics.stockHealthPercentage}
        suffix="%"
        separator=","
      />
    ),
    description: `${statistics.lowStockCount} 个低库存产品`,
    ...healthColors,
  });

  return cards;
}

/**
 * 计算网格列数类名
 */
function getGridColsClass(cardCount: number): string {
  if (cardCount === 5) return 'lg:grid-cols-5';
  if (cardCount === 4) return 'lg:grid-cols-4';
  return 'lg:grid-cols-3';
}

/**
 * 库存统计卡片组件
 *
 * 展示内容：
 * 1. 库存总金额 - 当前所有库存的总价值（需要 finance:view 权限）
 * 2. 期初库存金额 - 期初入库的总成本（需要 finance:view 权限）
 * 3. 库存产品数 - SKU数量
 * 4. 库存总数量 - 片数
 * 5. 库存健康度 - 低库存产品占比
 */
export function InventoryStatisticsCards({
  statistics,
  isLoading = false,
}: InventoryStatisticsCardsProps) {
  const { data: session } = useSession();
  const { toast } = useToast();

  // 检查用户是否有财务查看权限
  const hasFinancePermission = React.useMemo(
    () => can(session?.user ?? null, 'finance:view'),
    [session?.user]
  );

  const handleExportExcel = React.useCallback(() => {
    if (!statistics) {
      toast({
        variant: 'destructive',
        title: '导出失败',
        description: '暂无可导出的库存统计数据',
      });
      return;
    }

    try {
      // 按业务字段输出固定列，列顺序与页面含义保持一致
      const row: Record<string, unknown> = {};

      // 仅财务权限可见的字段
      if (hasFinancePermission && typeof statistics.totalValue === 'number') {
        row['库存总金额（元）'] = statistics.totalValue;
      }

      if (hasFinancePermission && statistics.openingBalance) {
        row['期初库存金额（元）'] = statistics.openingBalance.totalCost;
        row['期初库存数量（片）'] = statistics.openingBalance.totalQuantity;
        row['期初记录数'] = statistics.openingBalance.recordCount;
      }

      // 所有人可见字段
      row['库存产品数（SKU）'] = statistics.totalProducts;
      row['库存总数量（片）'] = statistics.totalQuantity;
      row['低库存产品数'] = statistics.lowStockCount;
      row['库存健康度（%）'] = statistics.stockHealthPercentage;

      ExportService.exportToExcel([row], {
        filename: '库存统计概览',
        sheetName: '库存统计',
        includeHeaders: true,
      });

      toast({
        title: '导出成功',
        description: '库存统计 Excel 已生成并下载',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '导出库存统计失败';
      toast({
        variant: 'destructive',
        title: '导出失败',
        description: message,
      });
    }
  }, [statistics, hasFinancePermission, toast]);

  if (isLoading) {
    return (
      <InventoryStatisticsCardsSkeleton
        hasFinancePermission={hasFinancePermission}
      />
    );
  }

  if (!statistics) {
    return null;
  }

  const cards = buildStatCards(statistics, hasFinancePermission);
  const gridColsClass = getGridColsClass(cards.length);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">库存统计概览</div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportExcel}
          disabled={!statistics}
        >
          导出统计 Excel
        </Button>
      </div>

      <div className={`grid gap-4 md:grid-cols-2 ${gridColsClass}`}>
        {cards.map(
          ({ id, title, icon: Icon, value, description, color, bgColor }) => (
            <Card key={id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className={`rounded-lg p-2 ${bgColor}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {description}
                </p>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}

function InventoryStatisticsCardsSkeleton({
  hasFinancePermission = false,
}: {
  hasFinancePermission?: boolean;
}) {
  // 根据权限动态计算卡片数量
  const cardCount = hasFinancePermission ? 5 : 3;
  const gridColsClass = cardCount === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-3';

  return (
    <div className={`grid gap-4 md:grid-cols-2 ${gridColsClass}`}>
      {Array.from({ length: cardCount }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mb-2 h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
