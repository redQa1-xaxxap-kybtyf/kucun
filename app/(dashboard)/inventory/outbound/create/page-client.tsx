'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { InventoryOperationForm } from '@/components/inventory/inventory-operation-form';
import type { OutboundCreateFormData } from '@/lib/validations/inventory-operations';

const OUTBOUND_PRESET_TYPES = new Set<OutboundCreateFormData['type']>([
  'normal_outbound',
  'sales_outbound',
  'sample_outbound',
  'internal_use_outbound',
  'adjust_outbound',
]);

export function CreateOutboundPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetType = searchParams.get('type');
  const initialValues = useMemo(() => {
    if (!presetType || !OUTBOUND_PRESET_TYPES.has(presetType as OutboundCreateFormData['type'])) {
      return undefined;
    }

    return {
      type: presetType as OutboundCreateFormData['type'],
    };
  }, [presetType]);

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <InventoryOperationForm
        mode="outbound"
        initialValues={initialValues}
        onSuccess={() => router.push('/inventory/outbound')}
        onCancel={() => router.push('/inventory/outbound')}
      />
    </div>
  );
}
