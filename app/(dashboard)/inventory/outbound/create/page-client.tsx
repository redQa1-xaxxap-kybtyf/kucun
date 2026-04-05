'use client';

import { useRouter } from 'next/navigation';

import { InventoryOperationForm } from '@/components/inventory/inventory-operation-form';

export function CreateOutboundPageClient() {
  const router = useRouter();

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <InventoryOperationForm
        mode="outbound"
        onSuccess={() => router.push('/inventory/outbound')}
        onCancel={() => router.push('/inventory/outbound')}
      />
    </div>
  );
}
