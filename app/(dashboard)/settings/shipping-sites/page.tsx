import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';

import ShippingSitesPageClient from './page-client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

export default async function ShippingSitesPage() {
  const session = await getServerSession(authOptions);

  return <ShippingSitesPageClient isAdmin={session?.user?.role === 'admin'} />;
}
