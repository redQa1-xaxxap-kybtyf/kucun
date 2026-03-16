import type { FactoryShipmentOrderFormData } from '@/lib/validations/factory-shipment';
import type { PurchaseOrderFormData } from '@/lib/validations/purchase-order-form';

function normalizeText(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolvePreferredSupplierId<
  T extends {
    supplierId?: string | null;
  },
>(items: T[], preferredSupplierId?: string): string {
  const normalizedPreferredSupplierId = normalizeText(preferredSupplierId);
  if (normalizedPreferredSupplierId) {
    return normalizedPreferredSupplierId;
  }

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const supplierId = normalizeText(items[index]?.supplierId);
    if (supplierId) {
      return supplierId;
    }
  }

  return '';
}

export function createPurchaseOrderDraftItem(params?: {
  items?: PurchaseOrderFormData['items'];
  preferredSupplierId?: string;
}): PurchaseOrderFormData['items'][number] {
  const items = params?.items ?? [];

  return {
    productId: undefined,
    supplierId: resolvePreferredSupplierId(items, params?.preferredSupplierId),
    productCode: '',
    quantity: 1,
    unitPrice: 0,
    totalPrice: 0,
    displayName: '',
    specification: '',
    batchNumber: '',
    unit: 'piece',
    weight: undefined,
    piecesPerUnit: undefined,
    remarks: '',
    isManualProduct: false,
  };
}

export function createFactoryShipmentDraftItem(params?: {
  items?: FactoryShipmentOrderFormData['items'];
  preferredSupplierId?: string;
}): FactoryShipmentOrderFormData['items'][number] {
  const items = params?.items ?? [];

  return {
    productId: undefined,
    supplierId: resolvePreferredSupplierId(items, params?.preferredSupplierId),
    productCode: '',
    batchNumber: '',
    quantity: 1,
    unitPrice: 0,
    unitCost: 0,
    ownership: 'customer',
    displayName: '',
    specification: '',
    unit: '片',
    piecesPerUnit: undefined,
    weight: undefined,
    ownershipRemarks: '',
    remarks: '',
  };
}
