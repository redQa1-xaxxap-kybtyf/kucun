/**
 * PrintLayout - 打印布局容器组件
 *
 * 功能：
 * - 提供统一的打印布局容器
 * - 支持 A4、A5、Letter 纸张大小
 * - 支持横向/纵向方向
 * - 自动计算页边距
 * - 隐藏非打印元素
 *
 * 设计原则：
 * - 单一职责：仅负责打印布局
 * - 组合优于继承：通过 children 组合内容
 */

'use client';

import React, { type ReactNode } from 'react';

import type {
  PageOrientation,
  PageSize,
  PageMargin,
} from '@/lib/types/print-style';
import { cn } from '@/lib/utils';

/**
 * 纸张尺寸配置（mm）
 */
const PAGE_SIZES: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 216, height: 279 },
} as const;

/**
 * 默认页边距（mm）
 */
const DEFAULT_MARGIN: PageMargin = {
  top: 10,
  right: 10,
  bottom: 10,
  left: 10,
};

/**
 * PrintLayout 组件属性
 */
export interface PrintLayoutProps {
  /**
   * 纸张大小
   * @default 'A4'
   */
  size?: PageSize;

  /**
   * 页面方向
   * @default 'landscape'
   */
  orientation?: PageOrientation;

  /**
   * 页边距配置
   */
  margin?: Partial<PageMargin>;

  /**
   * 子元素
   */
  children: ReactNode;

  /**
   * 额外的 CSS 类名
   */
  className?: string;

  /**
   * 打印容器 ID（用于 PrintService 定位）
   */
  id?: string;
}

/**
 * PrintLayout 组件
 *
 * @example
 * ```tsx
 * <PrintLayout size="A4" orientation="landscape">
 *   <h1>销售订单</h1>
 *   <table>...</table>
 * </PrintLayout>
 * ```
 */
export function PrintLayout({
  size = 'A4',
  orientation = 'landscape',
  margin: customMargin,
  children,
  className,
  id = 'print-container',
}: PrintLayoutProps) {
  const margin = { ...DEFAULT_MARGIN, ...customMargin };
  const pageSize = PAGE_SIZES[size];

  // 根据方向调整宽高
  const width = orientation === 'landscape' ? pageSize.height : pageSize.width;
  const height = orientation === 'landscape' ? pageSize.width : pageSize.height;

  // 计算内容区域尺寸
  const contentWidth = width - margin.left - margin.right;
  const contentHeight = height - margin.top - margin.bottom;

  return (
    <div
      id={id}
      className={cn('print-container', className)}
      style={
        {
          '--print-width': `${width}mm`,
          '--print-height': `${height}mm`,
          '--print-content-width': `${contentWidth}mm`,
          '--print-content-height': `${contentHeight}mm`,
          '--print-margin-top': `${margin.top}mm`,
          '--print-margin-right': `${margin.right}mm`,
          '--print-margin-bottom': `${margin.bottom}mm`,
          '--print-margin-left': `${margin.left}mm`,
        } as React.CSSProperties
      }
    >
      {/* 屏幕显示容器 */}
      <div
        className="print-content bg-white"
        style={{
          width: `${width}mm`,
          minHeight: `${height}mm`,
          padding: `${margin.top}mm ${margin.right}mm ${margin.bottom}mm ${margin.left}mm`,
          margin: '0 auto',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * PrintLayoutHeader - 打印布局表头组件
 *
 * 用于统一的表头区域
 */
export interface PrintLayoutHeaderProps {
  children: ReactNode;
  className?: string;
}

export function PrintLayoutHeader({
  children,
  className,
}: PrintLayoutHeaderProps) {
  return <div className={cn('print-header mb-4', className)}>{children}</div>;
}

/**
 * PrintLayoutBody - 打印布局主体组件
 *
 * 用于主要内容区域
 */
export interface PrintLayoutBodyProps {
  children: ReactNode;
  className?: string;
}

export function PrintLayoutBody({ children, className }: PrintLayoutBodyProps) {
  return <div className={cn('print-body', className)}>{children}</div>;
}

/**
 * PrintLayoutFooter - 打印布局页脚组件
 *
 * 用于签名区、页码等
 */
export interface PrintLayoutFooterProps {
  children: ReactNode;
  className?: string;
}

export function PrintLayoutFooter({
  children,
  className,
}: PrintLayoutFooterProps) {
  return <div className={cn('print-footer mt-4', className)}>{children}</div>;
}

/**
 * PrintOnly - 仅打印时显示的组件
 *
 * @example
 * ```tsx
 * <PrintOnly>
 *   <p>此内容仅在打印时显示</p>
 * </PrintOnly>
 * ```
 */
export interface PrintOnlyProps {
  children: ReactNode;
  className?: string;
}

export function PrintOnly({ children, className }: PrintOnlyProps) {
  return <div className={cn('print-only hidden', className)}>{children}</div>;
}

/**
 * NoPrint - 不打印的组件
 *
 * @example
 * ```tsx
 * <NoPrint>
 *   <Button>编辑</Button>
 * </NoPrint>
 * ```
 */
export interface NoPrintProps {
  children: ReactNode;
  className?: string;
}

export function NoPrint({ children, className }: NoPrintProps) {
  return <div className={cn('no-print', className)}>{children}</div>;
}
