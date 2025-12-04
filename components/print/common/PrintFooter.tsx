/**
 * PrintFooter - 通用打印页脚组件
 *
 * 功能：
 * - 显示页码信息
 * - 显示打印日期时间
 * - 支持模板变量替换
 *
 * 设计原则：
 * - 配置驱动：内容和样式完全可配置
 * - 模板支持：支持变量替换
 */

'use client';

import React from 'react';

import type { FooterSettings } from '@/lib/types/print-style';
import { formatFooterContent } from '@/lib/utils/print-helpers';

/**
 * 组件属性
 */
export interface PrintFooterProps {
  /**
   * 页脚样式配置
   */
  settings: FooterSettings;

  /**
   * 当前页码
   * @default 1
   */
  pageNumber?: number;

  /**
   * 总页数
   * @default 1
   */
  totalPages?: number;

  /**
   * 额外的 className
   */
  className?: string;
}

/**
 * PrintFooter 组件
 *
 * @example
 * ```tsx
 * <PrintFooter
 *   settings={{
 *     show: true,
 *     content: '第 {pageNumber} 页，共 {totalPages} 页 | 打印日期：{date} {time}',
 *     fontSize: 10,
 *     alignment: 'center',
 *     textColor: '#666666',
 *   }}
 *   pageNumber={1}
 *   totalPages={1}
 * />
 * ```
 */
export function PrintFooter({
  settings,
  pageNumber = 1,
  totalPages = 1,
  className = '',
}: PrintFooterProps) {
  // 如果不显示页脚，返回 null
  if (!settings.show) {
    return null;
  }

  // 格式化页脚内容
  const content = formatFooterContent(settings.content, pageNumber, totalPages);

  return (
    <div
      className={`print-footer ${className}`}
      style={{
        marginTop: '32px',
        textAlign: settings.alignment,
        fontSize: `${settings.fontSize}px`,
        color: settings.textColor,
      }}
    >
      {content}
    </div>
  );
}
