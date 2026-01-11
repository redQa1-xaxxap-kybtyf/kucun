/**
 * 统一骨架屏组件库
 *
 * 提供可组合的骨架屏构建模块，替代分散在各模块中的重复骨架组件
 * 遵循 DRY 原则，通过 props 配置差异化需求
 */

import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

// ============================================================================
// 基础构建模块
// ============================================================================

interface SkeletonItemProps {
  className?: string;
  delay?: number;
}

/** 带延迟动画的骨架条 */
function SkeletonBar({ className, delay = 0 }: SkeletonItemProps) {
  const clampedDelay = delay > 0 ? Math.min(delay, 10) : 0;
  const style =
    clampedDelay > 0
      ? ({ '--skel-delay': `${clampedDelay * 30}ms` } as CSSProperties)
      : undefined;

  return (
    <Skeleton
      className={cn('h-4', clampedDelay > 0 && 'skel-delay', className)}
      style={style}
    />
  );
}

// ============================================================================
// 搜索筛选栏骨架
// ============================================================================

interface SearchFiltersSkeletonProps {
  /** 筛选器数量（不含搜索框），默认 3 */
  count?: number;
  /** 额外的 className */
  className?: string;
}

export function SearchFiltersSkeleton({
  count = 3,
  className,
}: SearchFiltersSkeletonProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {/* 搜索框 */}
      <Skeleton className="h-10 min-w-[200px] flex-1" />
      {/* 筛选器 */}
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-32" />
      ))}
    </div>
  );
}

// ============================================================================
// 表格骨架
// ============================================================================

interface TableSkeletonProps {
  /** 列数，默认 6 */
  columns?: number;
  /** 行数，默认 10 */
  rows?: number;
  /** 额外的 className */
  className?: string;
}

export function TableSkeleton({
  columns = 6,
  rows = 10,
  className,
}: TableSkeletonProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-lg border shadow-[var(--shadow-light)]',
        className
      )}
    >
      {/* 表头 */}
      <div className="border-b bg-[hsl(var(--color-bg-tertiary))] p-4">
        <div
          className="grid [grid-template-columns:repeat(var(--skel-cols),minmax(0,1fr))] gap-4"
          style={{ '--skel-cols': String(columns) } as CSSProperties}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <SkeletonBar
              key={i}
              delay={i + 1}
              className="bg-[hsl(var(--color-border-strong))]"
            />
          ))}
        </div>
      </div>

      {/* 数据行 */}
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="border-b p-4 last:border-b-0 hover:bg-[hsl(var(--color-bg-tertiary))]"
        >
          <div
            className="grid [grid-template-columns:repeat(var(--skel-cols),minmax(0,1fr))] gap-4"
            style={{ '--skel-cols': String(columns) } as CSSProperties}
          >
            {Array.from({ length: columns }).map((_, col) => {
              const idx = row * columns + col;
              return <SkeletonBar key={col} delay={Math.min(idx, 10)} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 分页骨架
// ============================================================================

interface PaginationSkeletonProps {
  /** 页码按钮数量，默认 3 */
  pageButtons?: number;
  /** 额外的 className */
  className?: string;
}

export function PaginationSkeleton({
  pageButtons = 3,
  className,
}: PaginationSkeletonProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <Skeleton className="h-4 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-20" />
        {Array.from({ length: pageButtons }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-10" />
        ))}
        <Skeleton className="h-10 w-20" />
      </div>
    </div>
  );
}

// ============================================================================
// 统计卡片骨架
// ============================================================================

interface StatsCardsSkeletonProps {
  /** 卡片数量，默认 4 */
  count?: number;
  /** 额外的 className */
  className?: string;
}

export function StatsCardsSkeleton({
  count = 4,
  className,
}: StatsCardsSkeletonProps) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => {
        const clampedDelay = Math.min(i + 1, 10);
        return (
          <div
            key={i}
            className="bg-card skel-delay rounded-lg border p-6 shadow-[var(--shadow-light)]"
            style={
              { '--skel-delay': `${clampedDelay * 30}ms` } as CSSProperties
            }
          >
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// 工具栏骨架
// ============================================================================

interface ToolbarSkeletonProps {
  /** 操作按钮数量，默认 2 */
  actions?: number;
  /** 额外的 className */
  className?: string;
}

export function ToolbarSkeleton({
  actions = 2,
  className,
}: ToolbarSkeletonProps) {
  return (
    <div
      className={cn(
        'bg-card flex items-center justify-between rounded-lg border p-4 shadow-[var(--shadow-light)]',
        className
      )}
    >
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-2">
        {Array.from({ length: actions }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 信息卡片骨架
// ============================================================================

interface InfoCardSkeletonProps {
  /** 字段行数，默认 6 */
  fields?: number;
  /** 是否使用两列布局，默认 true */
  twoColumn?: boolean;
  /** 额外的 className */
  className?: string;
}

export function InfoCardSkeleton({
  fields = 6,
  twoColumn = true,
  className,
}: InfoCardSkeletonProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-lg border p-6 shadow-[var(--shadow-light)]',
        className
      )}
    >
      <Skeleton className="mb-4 h-6 w-32" />
      <div
        className={cn('gap-4', twoColumn ? 'grid grid-cols-2' : 'space-y-3')}
      >
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <SkeletonBar delay={i + 1} className="h-5 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 时间线/历史卡片骨架
// ============================================================================

interface TimelineCardSkeletonProps {
  /** 时间线项目数量，默认 3 */
  items?: number;
  /** 额外的 className */
  className?: string;
}

export function TimelineCardSkeleton({
  items = 3,
  className,
}: TimelineCardSkeletonProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-lg border p-6 shadow-[var(--shadow-light)]',
        className
      )}
    >
      <Skeleton className="mb-4 h-6 w-32" />
      <div className="space-y-3">
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="flex items-center space-x-3">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--color-primary))]" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-24" />
              <SkeletonBar delay={i + 1} className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 页面头部骨架
// ============================================================================

interface PageHeaderSkeletonProps {
  /** 操作按钮数量，默认 2 */
  actions?: number;
  /** 是否显示状态标签，默认 true */
  showStatus?: boolean;
  /** 额外的 className */
  className?: string;
}

export function PageHeaderSkeleton({
  actions = 2,
  showStatus = true,
  className,
}: PageHeaderSkeletonProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center space-x-3">
        <Skeleton className="h-8 w-48" />
        {showStatus && <Skeleton className="h-6 w-20" />}
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: actions }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20" />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 组合组件：通用列表骨架
// ============================================================================

export interface ListSkeletonProps {
  /** 表格列数，默认 6 */
  columns?: number;
  /** 表格行数，默认 10 */
  rows?: number;
  /** 筛选器数量，默认 3 */
  filters?: number;
  /** 是否显示统计卡片，默认 false */
  showStatsCards?: boolean;
  /** 统计卡片数量，默认 4 */
  statsCardCount?: number;
  /** 是否显示工具栏，默认 false */
  showToolbar?: boolean;
  /** 工具栏操作按钮数量，默认 2 */
  toolbarActions?: number;
  /** 额外的 className */
  className?: string;
}

export function ListSkeleton({
  columns = 6,
  rows = 10,
  filters = 3,
  showStatsCards = false,
  statsCardCount = 4,
  showToolbar = false,
  toolbarActions = 2,
  className,
}: ListSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* 工具栏 */}
      {showToolbar && <ToolbarSkeleton actions={toolbarActions} />}

      {/* 统计卡片 */}
      {showStatsCards && <StatsCardsSkeleton count={statsCardCount} />}

      {/* 搜索筛选 */}
      <SearchFiltersSkeleton count={filters} />

      {/* 表格 */}
      <TableSkeleton columns={columns} rows={rows} />

      {/* 分页 */}
      <PaginationSkeleton />
    </div>
  );
}

// ============================================================================
// 组合组件：通用详情页骨架
// ============================================================================

export interface DetailSkeletonProps {
  /** 主内容区卡片数量，默认 3 */
  mainCards?: number;
  /** 侧边栏卡片数量，默认 2 */
  sideCards?: number;
  /** 头部操作按钮数量，默认 2 */
  headerActions?: number;
  /** 每个信息卡片的字段数，默认 6 */
  fieldsPerCard?: number;
  /** 额外的 className */
  className?: string;
}

export function DetailSkeleton({
  mainCards = 3,
  sideCards = 2,
  headerActions = 2,
  fieldsPerCard = 6,
  className,
}: DetailSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* 页面头部 */}
      <PageHeaderSkeleton actions={headerActions} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左侧主内容区 */}
        <div className="space-y-6 lg:col-span-2">
          {Array.from({ length: mainCards }).map((_, i) => (
            <InfoCardSkeleton key={i} fields={fieldsPerCard} />
          ))}
        </div>

        {/* 右侧侧边栏 */}
        <div className="space-y-6">
          {Array.from({ length: sideCards }).map((_, i) => (
            <TimelineCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 快捷别名（保持向后兼容）
// ============================================================================

/** @deprecated 请使用 ListSkeleton 替代 */
export const CategoriesSkeleton = () => (
  <ListSkeleton columns={6} filters={3} />
);

/** @deprecated 请使用 ListSkeleton 替代 */
export const FactoryShipmentsSkeleton = () => (
  <ListSkeleton columns={7} filters={4} />
);

/** @deprecated 请使用 ListSkeleton 替代 */
export const SalesOrdersSkeleton = () => (
  <ListSkeleton columns={8} filters={4} />
);

/** @deprecated 请使用 ListSkeleton 替代 */
export const ReturnOrdersSkeleton = () => (
  <ListSkeleton columns={9} filters={4} />
);

/** @deprecated 请使用 ListSkeleton 替代 */
export const SuppliersSkeleton = () => <ListSkeleton columns={6} filters={3} />;

/** @deprecated 请使用 ListSkeleton 替代 */
export const ProductsSkeleton = () => <ListSkeleton columns={7} filters={3} />;

/** @deprecated 请使用 ListSkeleton 替代 */
export const InventoryListSkeleton = () => (
  <ListSkeleton columns={8} filters={4} showToolbar />
);

/** @deprecated 请使用 ListSkeleton 替代 */
export const FinanceListSkeleton = () => (
  <ListSkeleton columns={6} filters={3} showStatsCards />
);

/** @deprecated 请使用 DetailSkeleton 替代 */
export const SupplierDetailSkeleton = () => (
  <DetailSkeleton mainCards={3} sideCards={3} />
);

/** @deprecated 请使用 DetailSkeleton 替代 */
export const ProductDetailSkeleton = () => (
  <DetailSkeleton mainCards={3} sideCards={2} />
);

/** @deprecated 请使用 DetailSkeleton 替代 */
export const SalesOrderDetailSkeleton = () => (
  <DetailSkeleton mainCards={2} sideCards={3} />
);

/** @deprecated 请使用 DetailSkeleton 替代 */
export const ReturnOrderDetailSkeleton = () => (
  <DetailSkeleton mainCards={2} sideCards={3} />
);

/** @deprecated 请使用 DetailSkeleton 替代 */
export const FactoryShipmentDetailSkeleton = () => (
  <DetailSkeleton mainCards={3} sideCards={2} />
);
