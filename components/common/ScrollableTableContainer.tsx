'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface ScrollableTableContainerProps {
  /** 子组件 */
  children: React.ReactNode;
  /** 自定义样式类名 */
  className?: string;
  /** 表头内容（固定在顶部） */
  header?: React.ReactNode;
  /** 底部内容（固定在底部，如分页器） */
  footer?: React.ReactNode;
  /** 表格容器高度，默认使用剩余空间 */
  height?: string;
}

/**
 * 可滚动表格容器组件
 *
 * 功能特性：
 * 1. 固定表头和底部分页器
 * 2. 只有表格内容区域滚动，表头保持可见
 * 3. 响应式高度适配
 * 4. 符合 ERP 系统列表页面用户体验标准
 *
 * 使用示例：
 * ```tsx
 * <ScrollableTableContainer
 *   header={<SearchFilters />}
 *   footer={<Pagination />}
 * >
 *   <Table>...</Table>
 * </ScrollableTableContainer>
 * ```
 */
export function ScrollableTableContainer({
  children,
  className,
  header,
  footer,
  height,
}: ScrollableTableContainerProps) {
  return (
    <div className={cn('flex flex-col', height || 'h-full', className)}>
      {/* 固定的顶部区域：搜索和筛选 */}
      {header && (
        <div className="bg-background flex-shrink-0 border-b">{header}</div>
      )}

      {/* 可滚动的表格内容区域 - 使用相对定位容器 */}
      <div className="relative flex-1 overflow-auto">
        <div className="min-w-full">{children}</div>
      </div>

      {/* 固定的底部区域：分页器 */}
      {footer && (
        <div className="bg-background flex-shrink-0 border-t">{footer}</div>
      )}
    </div>
  );
}
