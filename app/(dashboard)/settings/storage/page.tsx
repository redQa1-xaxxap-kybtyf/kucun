import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';

import StorageSettingsPageClient from './page-client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

export default async function StorageSettingsPage() {
  const session = await getServerSession(authOptions);

  return (
    <StorageSettingsPageClient isAdmin={session?.user?.role === 'admin'} />
  );
}
