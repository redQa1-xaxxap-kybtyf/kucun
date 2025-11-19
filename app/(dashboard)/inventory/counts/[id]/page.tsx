import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';
import { getInventoryCountById } from '@/lib/services/inventory-count/queries';

import { CountDetailPageClient } from './page-client';

export const metadata: Metadata = {
  title: '盘点计划详情 - 库存管理',
  description: '查看库存盘点计划详细信息',
};

// Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

interface CountDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 盘点计划详情页面（Server Component）
 */
export default async function CountDetailPage({
  params,
}: CountDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user || !can(session.user, 'inventory:view')) {
    redirect('/dashboard');
  }

  const { id } = await params;

  const count = await getInventoryCountById(id);

  if (!count) {
    notFound();
  }

  return <CountDetailPageClient countId={id} initialData={count} />;
}
