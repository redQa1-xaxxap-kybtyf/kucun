'use client';

import {
  ArrowRight,
  BadgeJapaneseYen,
  Factory,
  Package,
  TrendingUp,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ProductSalesRanking } from '@/lib/types/dashboard';
import { formatCurrency } from '@/lib/utils';
import { formatNumber } from '@/lib/utils/format';

interface ProductRankingProps {
  warehouse: ProductSalesRanking[];
  factory: ProductSalesRanking[];
  loading?: boolean;
}

// 排名徽章颜色
const getRankBadgeVariant = (rank: number) => {
  if (rank === 1) return 'default'; // 金色
  if (rank === 2) return 'secondary'; // 银色
  if (rank === 3) return 'warning'; // 铜色
  return 'outline';
};

// 单个产品排名项
function RankingItem({ item }: { item: ProductSalesRanking }) {
  return (
    <Link
      href={`/products/${item.productId}`}
      className="flex items-center gap-3 rounded-lg border p-3 transition-all hover:bg-muted/50 hover:shadow-sm"
    >
      {/* 排名 */}
      <div className="flex-shrink-0">
        <Badge variant={getRankBadgeVariant(item.rank)} className="h-8 w-8 p-0">
          <span className="flex h-full w-full items-center justify-center text-xs font-bold">
            {item.rank}
          </span>
        </Badge>
      </div>

      {/* 产品信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="font-medium text-sm truncate">
            {item.productName}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {item.productCode}
        </div>
      </div>

      {/* 销售统计 */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <div className="flex items-center gap-1 text-sm font-semibold">
          <BadgeJapaneseYen className="h-3.5 w-3.5 text-primary" />
          <span>{formatCurrency(item.totalAmount)}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatNumber(item.totalQuantity)} 件 · {item.orderCount} 单
        </div>
      </div>

      {/* 箭头图标 */}
      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </Link>
  );
}

// 骨架加载组件
function RankingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
          <Skeleton className="h-8 w-8 rounded" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 空状态组件
function EmptyState({ source }: { source: 'warehouse' | 'factory' }) {
  const Icon = source === 'warehouse' ? Warehouse : Factory;
  const text = source === 'warehouse' ? '仓库发货' : '厂家发货';

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">暂无{text}产品销售数据</p>
      <p className="text-xs text-muted-foreground mt-1">
        完成订单后数据将自动统计
      </p>
    </div>
  );
}

export function ProductRanking({
  warehouse,
  factory,
  loading,
}: ProductRankingProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            产品销售排行
          </CardTitle>
          <CardDescription>按销售额统计的热销产品</CardDescription>
        </CardHeader>
        <CardContent>
          <RankingSkeleton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          产品销售排行
        </CardTitle>
        <CardDescription>按销售额统计的热销产品</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="warehouse" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="warehouse" className="flex items-center gap-2">
              <Warehouse className="h-4 w-4" />
              仓库发货
              {warehouse.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {warehouse.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="factory" className="flex items-center gap-2">
              <Factory className="h-4 w-4" />
              厂家发货
              {factory.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {factory.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="warehouse" className="mt-4 space-y-3">
            {warehouse.length > 0 ? (
              warehouse.map(item => <RankingItem key={item.productId} item={item} />)
            ) : (
              <EmptyState source="warehouse" />
            )}
          </TabsContent>

          <TabsContent value="factory" className="mt-4 space-y-3">
            {factory.length > 0 ? (
              factory.map(item => <RankingItem key={item.productId} item={item} />)
            ) : (
              <EmptyState source="factory" />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
