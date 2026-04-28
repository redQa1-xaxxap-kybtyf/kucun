'use client';

import { ArrowRight, Factory, Warehouse } from 'lucide-react';
import Link from 'next/link';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ProductSalesRanking } from '@/lib/types/dashboard';
import { cn, formatCurrency } from '@/lib/utils';
import { formatNumber } from '@/lib/utils/format';

interface ProductRankingProps {
  warehouse: ProductSalesRanking[];
  factory: ProductSalesRanking[];
  loading?: boolean;
}

const getRankColors = (rank: number) => {
  if (rank === 1) return { bg: 'bg-amber-500', text: 'text-white' };
  if (rank === 2) return { bg: 'bg-slate-300', text: 'text-slate-900' };
  if (rank === 3) return { bg: 'bg-orange-300', text: 'text-orange-900' };
  return { bg: 'bg-slate-100', text: 'text-slate-400' };
};

// 单个产品排名项
function RankingItem({ item }: { item: ProductSalesRanking }) {
  const colors = getRankColors(item.rank);

  return (
    <Link
      href={`/products/${item.productId}`}
      className="group relative flex items-center gap-4 rounded-md border border-border bg-card p-3 transition-colors hover:border-slate-300"
    >
      {/* 排名 */}
      <div
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md font-semibold shadow-sm',
          colors.bg,
          colors.text
        )}
      >
        {item.rank}
      </div>

      {/* 产品信息 */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-blue-600">
          {item.productName}
        </p>
        <p className="mt-0.5 text-xs font-bold text-slate-500">
          {item.productCode}
        </p>
      </div>

      {/* 销售统计 */}
      <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
        <p className="text-sm font-semibold text-slate-900">
          {formatCurrency(item.totalAmount)}
        </p>
        <p className="text-xs font-bold text-slate-500">
          {formatNumber(item.totalQuantity)} 件
        </p>
      </div>

      {/* 箭头图标 */}
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

// 空状态组件
function EmptyState({ source }: { source: 'warehouse' | 'factory' }) {
  const Icon = source === 'warehouse' ? Warehouse : Factory;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
        <Icon className="h-8 w-8 text-slate-200" />
      </div>
      <p className="text-xs font-medium text-slate-400">
        当前暂无销售数据
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
      <div className="h-[360px] w-full animate-pulse rounded-md bg-card" />
    );
  }

  return (
    <div className="relative flex flex-col rounded-md border border-border bg-card p-4 shadow-sm">
      <div className="mb-8 space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-slate-900" />
          <p className="text-xs font-semibold text-slate-500">
            热销排行
          </p>
        </div>
        <p className="text-xl font-semibold tracking-tight text-slate-900">
          表现最佳产品
        </p>
      </div>

      <Tabs defaultValue="warehouse" className="w-full">
        <TabsList className="grid h-10 w-full grid-cols-2 rounded-md border bg-slate-100 p-1">
          <TabsTrigger
            value="warehouse"
            className="rounded text-xs font-medium data-[state=active]:bg-slate-900 data-[state=active]:text-white"
          >
            本地仓库
          </TabsTrigger>
          <TabsTrigger
            value="factory"
            className="rounded text-xs font-medium data-[state=active]:bg-slate-900 data-[state=active]:text-white"
          >
            厂家直发
          </TabsTrigger>
        </TabsList>

        <TabsContent value="warehouse" className="mt-8 space-y-3 outline-none">
          {warehouse.length > 0 ? (
            warehouse
              .slice(0, 5)
              .map(item => <RankingItem key={item.productId} item={item} />)
          ) : (
            <EmptyState source="warehouse" />
          )}
        </TabsContent>

        <TabsContent value="factory" className="mt-8 space-y-3 outline-none">
          {factory.length > 0 ? (
            factory
              .slice(0, 5)
              .map(item => <RankingItem key={item.productId} item={item} />)
          ) : (
            <EmptyState source="factory" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
