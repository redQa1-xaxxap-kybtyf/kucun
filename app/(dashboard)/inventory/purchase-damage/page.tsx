import { requirePagePermission } from '@/lib/auth/page-permission';
import { listPurchaseDamageLedgers } from '@/lib/services/purchase-damage-ledger-service';
import type { PurchaseDamageLedgerQueryParams } from '@/lib/types/purchase-damage-ledger';
import { purchaseDamageLedgerQuerySchema } from '@/lib/validations/purchase-damage-ledger';

import { PurchaseDamageLedgerPageClient } from './page-client';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

function getFirstValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function PurchaseDamageLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission('inventory:view');

  const params = await searchParams;
  const parsed = purchaseDamageLedgerQuerySchema.parse({
    search: getFirstValue(params.search),
    damageHandling: getFirstValue(params.damageHandling),
    status: getFirstValue(params.status),
    startDate: getFirstValue(params.startDate),
    endDate: getFirstValue(params.endDate),
  });

  const query: PurchaseDamageLedgerQueryParams = {
    search: parsed.search,
    damageHandling: parsed.damageHandling,
    status: parsed.status,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
  };

  const { data, summary } = await listPurchaseDamageLedgers(query);

  return (
    <PurchaseDamageLedgerPageClient
      initialData={data}
      initialSummary={summary}
      initialParams={query}
    />
  );
}
