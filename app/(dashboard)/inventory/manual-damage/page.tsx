import { requirePagePermission } from '@/lib/auth/page-permission';
import { listManualDamageLedgers } from '@/lib/services/manual-damage-ledger-service';
import type { ManualDamageLedgerQueryParams } from '@/lib/types/manual-damage-ledger';
import { manualDamageLedgerQuerySchema } from '@/lib/validations/manual-damage-ledger';

import { ManualDamageLedgerPageClient } from './page-client';

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

export default async function ManualDamageLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission('inventory:view');

  const params = await searchParams;
  const parsed = manualDamageLedgerQuerySchema.parse({
    search: getFirstValue(params.search),
    damageCategory: getFirstValue(params.damageCategory),
    damageHandling: getFirstValue(params.damageHandling),
    status: getFirstValue(params.status),
    startDate: getFirstValue(params.startDate),
    endDate: getFirstValue(params.endDate),
  });

  const query: ManualDamageLedgerQueryParams = {
    search: parsed.search,
    damageCategory: parsed.damageCategory,
    damageHandling: parsed.damageHandling,
    status: parsed.status,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
  };

  const { data, summary } = await listManualDamageLedgers(query);

  return (
    <ManualDamageLedgerPageClient
      initialData={data}
      initialSummary={summary}
      initialParams={query}
    />
  );
}
