/**
 * 月度报表页面
 * 显示月度财务数据统计和分析
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';

import { MonthlyReportClient } from './page-client';

export const metadata: Metadata = {
  title: '月度报表 - 财务管理',
  description: '查看月度财务数据统计和分析',
};

// Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * 月度报表页面（Server Component）
 */
export default function MonthlyReportPage() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <MonthlyReportClient />
    </Suspense>
  );
}
