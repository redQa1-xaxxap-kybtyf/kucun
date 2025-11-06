import type { getPurchaseOrderById } from '@/app/actions/purchase-orders';

export type PurchaseOrderDetailData = NonNullable<
  Awaited<ReturnType<typeof getPurchaseOrderById>>['data']
>;
