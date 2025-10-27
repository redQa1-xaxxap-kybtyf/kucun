import type { Prisma } from '@prisma/client';

import type { CreateInput } from './types';

const roundCurrency = (value: number) => Math.round((value ?? 0) * 100) / 100;

const calculateItemTotals = (
  data: CreateInput,
  transferMode: CreateInput['transferMode']
) => {
  let itemsAmount = 0;
  let costAmount = 0;

  for (const item of data.items) {
    const quantity = item.quantity ?? 0;
    const unitPrice = item.unitPrice ?? 0;
    const subtotal = item.subtotal ?? quantity * unitPrice;
    const effectiveTransferQuantity =
      data.orderType === 'TRANSFER' && transferMode === 'MIXED'
        ? (item.transferQuantity ?? 0)
        : quantity;
    const unitCost = item.unitCost ?? 0;

    itemsAmount += subtotal;
    costAmount += unitCost * effectiveTransferQuantity;
  }

  itemsAmount = roundCurrency(itemsAmount);
  costAmount = roundCurrency(costAmount);
  const profitAmount = roundCurrency(itemsAmount - costAmount);

  return { itemsAmount, costAmount, profitAmount };
};

export const normalizeTransferMode = (data: CreateInput) =>
  data.orderType === 'TRANSFER'
    ? (data.transferMode ?? 'SUPPLIER_ONLY')
    : 'SUPPLIER_ONLY';

export const calculateFinancials = (
  data: CreateInput,
  transferMode: CreateInput['transferMode']
) => {
  const { itemsAmount, costAmount, profitAmount } = calculateItemTotals(
    data,
    transferMode
  );
  const additionalFees = roundCurrency(
    data.feeItems?.reduce((sum, fee) => sum + fee.feeAmount, 0) ?? 0
  );
  const roundingAdjustment = roundCurrency(data.roundingAdjustment ?? 0);
  const totalAmount = roundCurrency(
    itemsAmount + additionalFees + roundingAdjustment
  );

  return {
    itemsAmount,
    costAmount,
    profitAmount,
    additionalFees,
    roundingAdjustment,
    totalAmount,
  };
};

export const buildOrderItemsInput = (
  data: CreateInput,
  transferMode: CreateInput['transferMode'],
  temporaryProductIds?: Map<number, string>
): Prisma.SalesOrderItemUncheckedCreateWithoutSalesOrderInput[] =>
  data.items.map((item, index) => {
    const quantity = item.quantity ?? 0;
    const subtotal = item.subtotal ?? quantity * (item.unitPrice ?? 0);
    // 本地数量：只有调货订单的混合模式才有本地发货
    const localQuantity =
      data.orderType === 'TRANSFER' && transferMode === 'MIXED'
        ? (item.localQuantity ?? 0)
        : 0;
    // 调货数量：调货订单根据模式设置，普通订单为0
    const transferQuantity =
      data.orderType === 'TRANSFER'
        ? transferMode === 'MIXED'
          ? (item.transferQuantity ?? 0)
          : quantity
        : 0;

    return {
      productId: item.productId ?? null,
      temporaryProductId: temporaryProductIds?.get(index) ?? null,
      variantId: item.variantId ?? null,
      productCode: item.productCode ?? null,
      batchNumber: item.batchNumber || null,
      colorCode: item.colorCode ?? null,
      productionDate: item.productionDate ?? null,
      quantity,
      unitPrice: item.unitPrice ?? 0,
      subtotal,
      unitCost: item.unitCost ?? null,
      localQuantity,
      transferQuantity,
      costSubtotal: item.costSubtotal ?? null,
      profitAmount: item.profitAmount ?? null,
      displayUnit: item.displayUnit || '片',
      displayQuantity: item.displayQuantity ?? quantity,
      piecesPerUnit: item.piecesPerUnit ?? null,
      specification: item.specification || null,
      remarks: item.remarks || null,
      isManualProduct: item.isManualProduct ?? null,
      manualProductName: item.manualProductName ?? null,
      manualSpecification: item.manualSpecification ?? null,
      manualWeight: item.manualWeight ?? null,
      manualUnit: item.manualUnit ?? null,
    } satisfies Prisma.SalesOrderItemUncheckedCreateWithoutSalesOrderInput;
  });

export const buildFeeItemsInput = (data: CreateInput) =>
  data.feeItems?.map(fee => ({
    feeType: fee.feeType,
    feeName: fee.feeName,
    feeAmount: fee.feeAmount,
    remarks: fee.remarks || null,
  })) ?? [];
