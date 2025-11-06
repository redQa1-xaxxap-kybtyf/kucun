/**
 * 盈亏分析页面
 * 显示盈亏状态、收入成本费用明细及趋势分析
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ProfitLossClient } from './page-client';

export const metadata: Metadata = {
  title: '盈亏分析 - 财务管理',
  description: '查看盈亏状态、收入成本费用明细及趋势分析',
};

// Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * 盈亏分析页面（Server Component）
 */
export default function ProfitLossPage() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <ProfitLossClient />
    </Suspense>
  );
}
