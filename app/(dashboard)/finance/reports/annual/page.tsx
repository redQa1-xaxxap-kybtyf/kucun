/**
 * 年度报表页面
 * 显示年度财务数据统计和趋势分析
 */

import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AnnualReportClient } from './page-client';

export const metadata: Metadata = {
  title: '年度报表 - 财务管理',
  description: '查看年度财务数据统计和趋势分析',
};

// Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * 年度报表页面（Server Component）
 */
export default function AnnualReportPage() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <AnnualReportClient />
    </Suspense>
  );
}
