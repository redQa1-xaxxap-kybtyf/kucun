import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';

import { PurchaseOrderDetailWrapper } from '@/components/purchase-orders/purchase-order-detail-wrapper';

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

export default async function PurchaseOrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  const queryClient = new QueryClient();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PurchaseOrderDetailWrapper orderId={id} />
    </HydrationBoundary>
  );
}
