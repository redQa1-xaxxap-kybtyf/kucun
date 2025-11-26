import {
  FACTORY_SHIPMENT_ITEM_OWNERSHIP,
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentItemOwnership,
  type FactoryShipmentOrder,
} from '@/lib/types/factory-shipment';
import type {
  CreateFactoryShipmentOrderData,
  FactoryShipmentOrderItemData,
} from '@/lib/validations/factory-shipment';

const trimToUndefined = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const trimToString = (value?: string | null): string => value?.trim() ?? '';

const toNumberOr = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const normalizeOwnership = (
  ownership?: FactoryShipmentItemOwnership | null
): FactoryShipmentItemOwnership =>
  ownership ?? FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER;

function normalizeItemForSubmit(
  item: FactoryShipmentOrderItemData
): FactoryShipmentOrderItemData {
  return {
    ...item,
    productId: trimToUndefined(item.productId),
    supplierId: trimToString(item.supplierId),
    productCode: trimToString(item.productCode),
    batchNumber: trimToUndefined(item.batchNumber),
    ownership: normalizeOwnership(
      item.ownership as FactoryShipmentItemOwnership
    ),
    quantity: toNumberOr(item.quantity, 0),
    unitPrice: toNumberOr(item.unitPrice, 0),
    unitCost: toOptionalNumber(item.unitCost),
    piecesPerUnit: toOptionalNumber(item.piecesPerUnit),
    weight: toOptionalNumber(item.weight),
    ownershipRemarks: trimToString(item.ownershipRemarks),
    remarks: trimToString(item.remarks),
    displayName: trimToString(item.displayName),
    specification: trimToString(item.specification),
    unit: item.unit ?? '片',
    manualProductName: trimToUndefined(item.manualProductName),
    manualSpecification: trimToUndefined(item.manualSpecification),
    manualUnit: trimToUndefined(item.manualUnit),
    manualWeight: toOptionalNumber(item.manualWeight),
    isManualProduct: Boolean(item.isManualProduct),
  };
}

export function prepareFactoryShipmentForSubmit(
  formData: CreateFactoryShipmentOrderData
): CreateFactoryShipmentOrderData {
  return {
    ...formData,
    idempotencyKey:
      trimToUndefined(formData.idempotencyKey) ?? formData.idempotencyKey,
    customerId: trimToString(formData.customerId),
    containerNumber: trimToUndefined(formData.containerNumber),
    remarks: trimToUndefined(formData.remarks),
    status: formData.status ?? FACTORY_SHIPMENT_STATUS.DRAFT,
    totalAmount: toNumberOr(formData.totalAmount, 0),
    receivableAmount: toNumberOr(formData.receivableAmount, 0),
    depositAmount: toNumberOr(formData.depositAmount, 0),
    feeItems: (formData.feeItems ?? []).map(feeItem => ({
      ...feeItem,
      feeName: trimToString(feeItem.feeName),
      feeAmount: toNumberOr(feeItem.feeAmount, 0),
      remarks: trimToUndefined(feeItem.remarks),
    })),
    items: (formData.items ?? []).map(normalizeItemForSubmit),
  };
}

export function transformFactoryShipmentFromAPI(
  order: FactoryShipmentOrder
): CreateFactoryShipmentOrderData {
  return {
    idempotencyKey: '',
    containerNumber: order.containerNumber ?? '',
    customerId: order.customerId,
    status: order.status ?? FACTORY_SHIPMENT_STATUS.DRAFT,
    totalAmount: toNumberOr(order.totalAmount, 0),
    receivableAmount: toNumberOr(order.receivableAmount, 0),
    depositAmount: toNumberOr(order.depositAmount, 0),
    remarks: order.remarks ?? '',
    items: (order.items ?? []).map(item => ({
      productId: item.productId ?? undefined,
      supplierId: item.supplierId,
      productCode: item.productCode ?? '',
      batchNumber: item.batchNumber ?? '',
      quantity: toNumberOr(item.quantity, 0),
      unitPrice: toNumberOr(item.unitPrice, 0),
      unitCost: toOptionalNumber(item.unitCost),
      ownership: normalizeOwnership(
        item.ownership as FactoryShipmentItemOwnership
      ),
      displayName: item.displayName ?? '',
      specification: item.specification ?? '',
      unit: item.unit === '件' || item.unit === '片' ? item.unit : '片',
      piecesPerUnit: toOptionalNumber(item.piecesPerUnit),
      weight: toOptionalNumber(item.weight),
      ownershipRemarks: item.ownershipRemarks ?? '',
      remarks: item.remarks ?? '',
      isManualProduct: Boolean(item.isManualProduct),
      manualProductName: item.manualProductName ?? '',
      manualSpecification: item.manualSpecification ?? '',
      manualUnit: item.manualUnit ?? '',
      manualWeight: toOptionalNumber(item.manualWeight),
    })),
    // 从订单详情恢复费用项，保持与表单 feeItems 结构一致
    feeItems: (order.feeItems ?? []).map(fee => ({
      id: fee.id,
      feeType: fee.feeType,
      feeName: trimToString(fee.feeName),
      feeAmount: toNumberOr(fee.feeAmount, 0),
      paidBy: fee.paidBy ?? 'customer',
      remarks: trimToUndefined(fee.remarks),
    })),
  };
}
