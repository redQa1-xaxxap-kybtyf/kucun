import type { Metadata } from 'next';

import { NotificationsPageClient } from './page-client';

export const metadata: Metadata = {
  title: '通知中心',
  description: '集中查看待确认订单、库存预警和业务跟进提醒',
};

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

export default function NotificationsPage() {
  return <NotificationsPageClient />;
}
