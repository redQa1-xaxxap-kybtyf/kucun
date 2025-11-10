import { notFound } from 'next/navigation';

import { PurchaseOrderEditClient } from '@/components/purchase-orders/purchase-order-edit-client';
import { getPurchaseOrderServer } from '@/lib/api/purchase-orders-server';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
} from '@/lib/types/purchase-order';

interface PurchaseOrderEditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PurchaseOrderEditPage({
  params,
}: PurchaseOrderEditPageProps) {
  const { id } = await params;
  const result = await getPurchaseOrderServer(id);

  const orderData = result.data;

  if (!orderData) {
    notFound();
  }

  const normalizedData = {
    ...orderData,
    status: orderData.status as PurchaseOrderStatus,
  } as PurchaseOrder;

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <PurchaseOrderEditClient orderId={id} initialData={normalizedData} />
      </div>
    </div>
  );
}
