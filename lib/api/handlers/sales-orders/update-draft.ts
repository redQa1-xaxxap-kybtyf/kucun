import {
  buildTemporaryProductDataFromOrderItem,
  findOrCreateTemporaryProduct,
} from '@/lib/api/handlers/sales-orders/temporary-products';
import { prisma } from '@/lib/db';

// 复用临时产品相关工具

/**
 * 更新草稿销售订单（完整覆盖式）
 * 将事务、临时产品、金额汇总分拆为若干小函数，避免巨型函数。
 */
export async function updateSalesOrderDraft(
  id: string,
  updateData: Record<string, any>,
  existingOrder: {
    id: string;
    status: string;
    orderNumber: string;
    orderType: 'NORMAL' | 'TRANSFER' | null;
    transferMode?: 'SUPPLIER_ONLY' | 'MIXED' | null;
    supplierId?: string | null;
  }
) {
  const orderType = (updateData.orderType ??
    existingOrder.orderType ??
    'NORMAL') as 'NORMAL' | 'TRANSFER';
  const transferMode =
    orderType === 'TRANSFER'
      ? ((updateData.transferMode ??
          existingOrder.transferMode ??
          'SUPPLIER_ONLY') as 'SUPPLIER_ONLY' | 'MIXED')
      : 'SUPPLIER_ONLY';

  const { itemsAmount, costAmount } = computeItemsAndCost(
    updateData.items ?? [],
    orderType,
    transferMode
  );

  const additionalFees = round2(
    sumFeeByPayer(updateData.feeItems, 'customer')
  );
  const expenseAmount = round2(
    sumFeeByPayer(updateData.feeItems, 'company')
  );
  const roundingAdjustment = round2(updateData.roundingAdjustment ?? 0);
  const totalAmount = round2(itemsAmount + additionalFees + roundingAdjustment);
  const profitAmount =
    orderType === 'TRANSFER' ? round2(itemsAmount - costAmount) : 0;

  // 事务内更新（删除旧明细、创建新明细、同步临时产品）
  const updatedOrder = await prisma.$transaction(async tx => {
    await tx.salesOrderItem.deleteMany({ where: { salesOrderId: id } });
    await tx.salesOrderFeeItem.deleteMany({ where: { salesOrderId: id } });

    // 临时产品映射：仅调货订单才处理
    const temporaryProductIds = new Map<number, string>();
    const effectiveSupplierId =
      orderType === 'TRANSFER'
        ? updateData.supplierId === undefined
          ? existingOrder.supplierId
          : updateData.supplierId
        : null;

    if (orderType === 'TRANSFER' && effectiveSupplierId && updateData.items) {
      const { getServerSession } = await import('next-auth');
      const { authOptions } = await import('@/lib/auth');
      const session = await getServerSession(authOptions);
      const userId = session?.user?.id;

      if (userId) {
        for (let i = 0; i < updateData.items.length; i++) {
          const item = updateData.items[i];
          const tempProductData = buildTemporaryProductDataFromOrderItem(
            item,
            effectiveSupplierId,
            userId
          );
          if (tempProductData) {
            const tempProduct = await findOrCreateTemporaryProduct(
              tx,
              tempProductData
            );
            temporaryProductIds.set(i, tempProduct.id);
          }
        }
      }
    }

    return await tx.salesOrder.update({
      where: { id },
      data: {
        customerId: updateData.customerId ?? undefined,
        status: updateData.status || 'draft',
        orderType,
        transferMode,
        supplierId:
          orderType === 'TRANSFER'
            ? updateData.supplierId === undefined
              ? (existingOrder.supplierId ?? null)
              : updateData.supplierId || null
            : null,
        costAmount: orderType === 'TRANSFER' ? costAmount : null,
        profitAmount: orderType === 'TRANSFER' ? profitAmount : null,
        itemsAmount,
        additionalFees,
        expenseAmount,
        roundingAdjustment,
        totalAmount,
        remarks: updateData.remarks || null,
        items: updateData.items
          ? {
              create: updateData.items.map((item: any, index: number) =>
                buildOrderItemPayload(
                  item,
                  orderType,
                  transferMode,
                  temporaryProductIds.get(index) ?? null
                )
              ),
            }
          : undefined,
        feeItems: updateData.feeItems
          ? {
              create: updateData.feeItems.map((fee: any) => ({
                feeType: fee.feeType,
                feeName: fee.feeName,
                feeAmount: fee.feeAmount,
                paidBy: fee.paidBy ?? 'customer',
                remarks: fee.remarks ?? null,
              })),
            }
          : undefined,
      },
      select: selectUpdatedOrder(),
    });
  });

  const { returnOrders, ...rest } = updatedOrder as any;
  return {
    ...rest,
    hasReturnOrder: returnOrders.length > 0,
    returnOrders: returnOrders.map((order: any) => ({
      id: order.id,
      returnNumber: order.returnNumber,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    })),
  };
}

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function sumFeeByPayer(
  feeItems: Array<{ feeAmount?: number; paidBy?: string }> | undefined,
  payer: 'customer' | 'company'
): number {
  if (!Array.isArray(feeItems)) {
    return 0;
  }

  return feeItems
    .filter(fee => (fee.paidBy ?? 'customer') === payer)
    .reduce((sum, fee) => sum + (Number(fee.feeAmount) || 0), 0);
}

function computeItemsAndCost(
  items: any[],
  orderType: 'NORMAL' | 'TRANSFER',
  transferMode: 'SUPPLIER_ONLY' | 'MIXED'
) {
  let itemsAmount = 0;
  let costAmount = 0;

  for (const item of items) {
    const quantity = item.quantity ?? 0;
    const unitPrice = item.unitPrice ?? 0;
    const subtotal = item.subtotal ?? round2(quantity * unitPrice);
    itemsAmount += subtotal;

    const effectiveTransferQuantity =
      orderType === 'TRANSFER' && transferMode === 'MIXED'
        ? (item.transferQuantity ?? 0)
        : quantity;
    const unitCost = item.unitCost ?? 0;
    costAmount += unitCost * effectiveTransferQuantity;
  }

  return { itemsAmount: round2(itemsAmount), costAmount: round2(costAmount) };
}

function buildOrderItemPayload(
  item: any,
  orderType: 'NORMAL' | 'TRANSFER',
  transferMode: 'SUPPLIER_ONLY' | 'MIXED',
  temporaryProductId: string | null
) {
  const quantity = item.quantity ?? 0;
  const unitPrice = item.unitPrice ?? 0;
  const subtotal = item.subtotal ?? round2(quantity * unitPrice);

  const localQuantity =
    orderType === 'TRANSFER' && transferMode === 'MIXED'
      ? (item.localQuantity ?? 0)
      : 0;
  const transferQuantity =
    orderType === 'TRANSFER'
      ? transferMode === 'MIXED'
        ? (item.transferQuantity ?? 0)
        : quantity
      : 0;
  const effectiveCostQuantity =
    orderType === 'TRANSFER'
      ? transferMode === 'MIXED'
        ? (item.transferQuantity ?? 0)
        : quantity
      : 0;

  const unitCost = item.unitCost === undefined ? undefined : item.unitCost;
  const costSubtotal =
    unitCost !== undefined && orderType === 'TRANSFER'
      ? round2(unitCost * effectiveCostQuantity)
      : undefined;
  const profitSubtotal =
    orderType === 'TRANSFER' && costSubtotal !== undefined
      ? round2(subtotal - costSubtotal)
      : undefined;

  return {
    productId: item.productId,
    temporaryProductId,
    productCode: item.productCode,
    batchNumber: item.batchNumber,
    colorCode: item.colorCode,
    productionDate: item.productionDate,
    quantity,
    unitPrice,
    subtotal,
    unitCost,
    localQuantity,
    transferQuantity,
    costSubtotal,
    profitAmount: profitSubtotal,
    isManualProduct: item.isManualProduct,
    manualProductName: item.manualProductName,
    manualSpecification: item.manualSpecification,
    manualWeight: item.manualWeight,
    manualUnit: item.manualUnit,
    displayUnit: item.displayUnit,
    displayQuantity: item.displayQuantity ?? quantity,
    piecesPerUnit: item.piecesPerUnit ?? null,
    specification: item.specification,
    remarks: item.remarks,
  };
}

function selectUpdatedOrder() {
  return {
    id: true,
    orderNumber: true,
    customerId: true,
    userId: true,
    status: true,
    orderType: true,
    transferMode: true,
    supplierId: true,
    itemsAmount: true,
    additionalFees: true,
    expenseAmount: true,
    roundingAdjustment: true,
    costAmount: true,
    profitAmount: true,
    totalAmount: true,
    remarks: true,
    createdAt: true,
    updatedAt: true,
    returnOrders: {
      where: { status: { not: 'cancelled' } },
      select: { id: true, returnNumber: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    },
    customer: { select: { id: true, name: true, phone: true, address: true } },
    user: { select: { id: true, name: true, email: true } },
    items: {
      select: {
        id: true,
        productId: true,
        productCode: true,
        batchNumber: true,
        colorCode: true,
        productionDate: true,
        quantity: true,
        unitPrice: true,
        subtotal: true,
        unitCost: true,
        localQuantity: true,
        transferQuantity: true,
        costSubtotal: true,
        profitAmount: true,
        isManualProduct: true,
        manualProductName: true,
        manualSpecification: true,
        manualWeight: true,
        displayUnit: true,
        displayQuantity: true,
        piecesPerUnit: true,
        specification: true,
        remarks: true,
        manualUnit: true,
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            specification: true,
            unit: true,
            piecesPerUnit: true,
          },
        },
      },
    },
    feeItems: {
      select: {
        id: true,
        feeType: true,
        feeName: true,
        feeAmount: true,
        paidBy: true,
        remarks: true,
      },
    },
  } as const;
}
