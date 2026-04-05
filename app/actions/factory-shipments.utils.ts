import type { Prisma, PrismaClient } from '@prisma/client';

import type { FactoryShipmentItemInput } from './factory-shipments.schemas';

export type ActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export function parseJsonPayload<T>(formData: FormData, key: string): T {
  const payload = formData.get(key);
  if (typeof payload !== 'string' || !payload) {
    throw new Error('提交数据格式不正确');
  }
  return JSON.parse(payload) as T;
}

export async function resolveShipmentItems(
  tx: Omit<
    PrismaClient,
    '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
  >,
  items: FactoryShipmentItemInput[]
): Promise<
  Prisma.FactoryShipmentOrderItemUncheckedCreateWithoutFactoryShipmentOrderInput[]
> {
  const productIds = Array.from(
    new Set(
      items
        .map(item => item.productId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const products =
    productIds.length > 0
      ? await tx.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            code: true,
            name: true,
            specification: true,
            unit: true,
            weight: true,
            piecesPerUnit: true,
          },
          take: productIds.length,
        })
      : [];

  const productMap = new Map(products.map(product => [product.id, product]));

  return items.map(item => {
    const product = item.productId ? productMap.get(item.productId) : undefined;
    const trimmedManualName = item.manualProductName?.trim();
    const trimmedDisplayName =
      item.displayName?.trim() ||
      (product?.name ?? trimmedManualName ?? '未知产品');
    const trimmedSpecification =
      item.specification?.trim() ?? product?.specification ?? undefined;
    const trimmedUnit = item.unit?.trim() ?? product?.unit ?? 'piece';
    const itemWeight =
      typeof item.weight === 'number'
        ? item.weight
        : (product?.weight ?? undefined);
    const trimmedProductCode = item.productCode?.trim() || product?.code || '';

    return {
      productId:
        item.productId && item.productId.trim().length > 0
          ? item.productId
          : null,
      supplierId: item.supplierId,
      productCode: trimmedProductCode,
      batchNumber: item.batchNumber?.trim() || undefined,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost:
        typeof item.unitCost === 'number' && !Number.isNaN(item.unitCost)
          ? item.unitCost
          : null,
      totalPrice: item.totalPrice,
      isManualProduct: item.isManualProduct ? true : undefined,
      manualProductName: item.isManualProduct
        ? (trimmedManualName ?? '临时产品')
        : undefined,
      manualSpecification: item.isManualProduct
        ? (item.manualSpecification?.trim() ?? undefined)
        : undefined,
      manualWeight: item.isManualProduct
        ? (item.manualWeight ?? undefined)
        : undefined,
      manualUnit: item.isManualProduct
        ? (item.manualUnit?.trim() ?? undefined)
        : undefined,
      remarks: item.remarks?.trim() ?? undefined,
      displayName: trimmedDisplayName,
      specification: trimmedSpecification,
      unit: trimmedUnit,
      piecesPerUnit:
        typeof item.piecesPerUnit === 'number' &&
        Number.isInteger(item.piecesPerUnit) &&
        item.piecesPerUnit > 0
          ? item.piecesPerUnit
          : (product?.piecesPerUnit ?? null),
      weight: itemWeight,
    };
  });
}
