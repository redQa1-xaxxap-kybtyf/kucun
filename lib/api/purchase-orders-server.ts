import { getPurchaseOrderById } from '@/app/actions/purchase-orders';

export async function getPurchaseOrderServer(id: string) {
  return getPurchaseOrderById(id);
}
