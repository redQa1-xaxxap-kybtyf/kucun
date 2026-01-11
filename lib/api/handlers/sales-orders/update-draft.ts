import {
  buildTemporaryProductDataFromOrderItem,
  findOrCreateTemporaryProduct,
} from '@/lib/api/handlers/sales-orders/temporary-products';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  ensureCompanyExpenses,
  type CompanyFeeItemLike,
} from '@/lib/services/expense-service';
import {
  buildFeeItemsInput,
  buildOrderItemsInput,
  calculateFinancials,
} from './financials';

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
    updatedAt: Date;
  },
  userId: string
) {
  // 草稿更新只允许修改草稿内容，不允许通过该接口变更状态。
  // 状态流转必须走专用接口，以保证库存预留/收款台账等副作用一致。
  if (
    updateData.status !== undefined &&
    updateData.status !== null &&
    String(updateData.status) !== 'draft'
  ) {
    throw new Error(
      '草稿更新不允许修改订单状态，请使用“更新状态”接口进行确认/发货/取消。'
    );
  }

  const orderType = (updateData.orderType ??
    existingOrder.orderType ??
    'NORMAL') as 'NORMAL' | 'TRANSFER';
  const transferMode =
    orderType === 'TRANSFER'
      ? ((updateData.transferMode ??
          existingOrder.transferMode ??
          'SUPPLIER_ONLY') as 'SUPPLIER_ONLY' | 'MIXED')
      : 'SUPPLIER_ONLY';

  const normalizedInput = {
    orderType,
    transferMode,
    items: Array.isArray(updateData.items) ? updateData.items : [],
    feeItems: Array.isArray(updateData.feeItems) ? updateData.feeItems : [],
    roundingAdjustment: updateData.roundingAdjustment ?? 0,
  };

  const financials = calculateFinancials(
    normalizedInput as any,
    transferMode as any
  );

  // 事务内更新（删除旧明细、创建新明细、同步临时产品）
  const updatedOrder = await prisma.$transaction(async tx => {
    const locked = (
      await tx.$queryRaw<
        Array<{ updatedAt: Date; status: string }>
      >`SELECT updated_at as updatedAt, status FROM sales_orders WHERE id = ${id} FOR UPDATE`
    )[0];

    if (!locked) {
      throw new Error('销售订单不存在');
    }

    if (locked.status !== 'draft') {
      throw new Error('只能更新草稿状态的订单');
    }

    if (locked.updatedAt.getTime() !== existingOrder.updatedAt.getTime()) {
      throw new Error('订单已被其他用户修改，请刷新后重试');
    }

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

    const updated = await tx.salesOrder.update({
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
        costAmount: financials.costAmount,
        profitAmount: financials.profitAmount,
        itemsAmount: financials.itemsAmount,
        additionalFees: financials.additionalFees,
        expenseAmount: financials.expenseAmount,
        roundingAdjustment: financials.roundingAdjustment,
        totalAmount: financials.totalAmount,
        remarks: updateData.remarks || null,
        items: updateData.items
          ? {
              create: buildOrderItemsInput(
                normalizedInput as any,
                transferMode as any,
                temporaryProductIds
              ),
            }
          : undefined,
        feeItems: updateData.feeItems
          ? {
              create: buildFeeItemsInput(normalizedInput as any),
            }
          : undefined,
      },
      select: selectUpdatedOrder(),
    });

    // 阶段2：自动同步公司承担费用到 ExpenseRecord（幂等，必须成功）
    // 约束：
    // - 当客户端提交 feeItems 时，视为对费用的完整覆盖；
    // - 因此先删除该订单已有关联费用，再根据新的 feeItems 重建公司费用台账；
    // - 写入失败将导致整个草稿更新事务回滚，避免订单费用与台账脱节。
    if (env.EXPENSE_AUTO_CREATE && 'feeItems' in updateData) {
      try {
        // 删除现有与销售订单关联的费用记录
        await tx.expenseRecord.deleteMany({
          where: {
            relatedType: 'sales_order',
            relatedId: id,
          },
        });

        const feeItemsInput = Array.isArray(updateData.feeItems)
          ? (updateData.feeItems as any[])
          : [];

        if (feeItemsInput.length > 0) {
          const companyFeeItems: CompanyFeeItemLike[] = feeItemsInput.map(
            fee => ({
              feeType: fee.feeType,
              feeName: fee.feeName,
              feeAmount: Number(fee.feeAmount) || 0,
              paidBy: (fee.paidBy as 'customer' | 'company') ?? 'customer',
              remarks: fee.remarks ?? null,
            })
          );

          await ensureCompanyExpenses({
            tx,
            sourceType: 'sales_order',
            sourceId: id,
            sourceNumber: existingOrder.orderNumber,
            userId,
            supplierId:
              orderType === 'TRANSFER'
                ? updateData.supplierId === undefined
                  ? (existingOrder.supplierId ?? null)
                  : (updateData.supplierId ?? null)
                : null,
            feeItems: companyFeeItems,
          });
        }
      } catch (e) {
        logger.error(
          'sales-orders',
          '更新草稿订单时自动同步费用台账失败，将回滚事务',
          e,
          {
            orderId: id,
            orderNumber: existingOrder.orderNumber,
          }
        );
        throw e;
      }
    }

    return updated;
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
