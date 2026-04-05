import { requirePagePermission } from '@/lib/auth/page-permission';

import { CreateOutboundPageClient } from './page-client';

export default async function CreateOutboundPage() {
  await requirePagePermission('inventory:outbound');

  return <CreateOutboundPageClient />;
}
