import { getServerSession } from 'next-auth';

import ShippingSitesPageClient from './page-client';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

export default async function ShippingSitesPage() {
  const session = await getServerSession(authOptions);

  return <ShippingSitesPageClient isAdmin={session?.user?.role === 'admin'} />;
}

