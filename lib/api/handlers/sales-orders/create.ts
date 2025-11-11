import type { Prisma } from '@prisma/client';

import {
  executeInvalidation,
  ORDER_STATUS_CHANGE_INVALIDATION,
} from '@/lib/cache/invalidation-strategy';
import { prisma } from '@/lib/db';
import { getLongTransactionOptions } from '@/lib/db/transaction-options';
import { logger } from '@/lib/logger';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import { generateSalesOrderNumber } from '@/lib/services/simple-order-number-generator';
import { generatePaymentNumber } from '@/lib/utils/payment-number-generator';
import { salesOrderCreateSchema } from '@/lib/validations/sales-order';

import {
  buildFeeItemsInput,
  buildOrderItemsInput,
  calculateFinancials,
  normalizeTransferMode,
} from './financials';
import { reserveInventory, shouldReserveInventory } from './inventory';
import { maybeCreatePayable } from './payable';
import { applyPrepaymentToOrder } from './prepayment';
import { recordCustomerPriceHistory } from './price-history';
import {
  mapOrderBaseFields,
  mapSalesOrderItem,
  salesOrderItemSelect,
  salesOrderRelations,
} from './shared';
import {
  buildTemporaryProductDataFromOrderItem,
  findOrCreateTemporaryProduct,
} from './temporary-products';
import type { CreateInput } from './types';
import {
  ensureCustomerExists,
  ensureProductsExist,
  ensureSupplierExists,
} from './validation';

const createSelect = {
  id: true,
  orderNumber: true,
  customerId: true,
  userId: true,
  supplierId: true,
  status: true,
  orderType: true,
  transferMode: true,
  itemsAmount: true,
  additionalFees: true,
  expenseAmount: true,
  roundingAdjustment: true,
  costAmount: true,
  profitAmount: true,
  totalAmount: true,
  paidAmount: true,
  remarks: true,
  shippedAt: true,
  createdAt: true,
  updatedAt: true,
  customer: salesOrderRelations.customer,
  user: salesOrderRelations.user,
  items: {
    select: salesOrderItemSelect,
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
  _count: salesOrderRelations._count,
} as const;

type CreatedOrderResult = Prisma.SalesOrderGetPayload<{
  select: typeof createSelect;
}>;

const mapFeeItem = (
  fee: CreatedOrderResult['feeItems'][number]
) => ({
  id: fee.id,
  feeType: fee.feeType,
  feeName: fee.feeName,
  feeAmount: fee.feeAmount,
  paidBy: (fee.paidBy as 'customer' | 'company') ?? 'customer',
  remarks: fee.remarks ?? undefined,
});

const mapCreatedOrder = (
  order: CreatedOrderResult,
  productsMap: Map<
    string,
    {
      id: string;
      name: string;
      code: string;
      unit: string;
      specification: string | null;
      piecesPerUnit: number;
      weight: number | null;
    }
  >
) => {
  const { items, feeItems, _count, ...base } = order;
  const mappedBase = mapOrderBaseFields(base);

  return {
    ...mappedBase,
    hasReturnOrder: false,
    returnOrders: [],
    items: items.map(item =>
      mapSalesOrderItem(item, item.productId ? productsMap.get(item.productId) : undefined)
    ),
    feeItems: feeItems.map(mapFeeItem),
    itemCount: _count.items,
  };
};

export async function createSalesOrder(data: CreateInput, userId: string) {
  const validatedData = salesOrderCreateSchema.parse(data);
  const transferMode = normalizeTransferMode(validatedData);
  const orderNumber = await generateSalesOrderNumber();
  const financials = calculateFinancials(validatedData, transferMode);

  const order = await prisma.$transaction(async tx => {
    await ensureCustomerExists(tx, validatedData.customerId);
    await ensureSupplierExists(tx, validatedData.supplierId);
    await ensureProductsExist(tx, validatedData.items);

    // 处理临时产品：为调货销售的手动输入产品创建/查找临时产品记录
    const temporaryProductIds = new Map<number, string>(); // itemIndex -> temporaryProductId

    if (validatedData.orderType === 'TRANSFER' && validatedData.supplierId) {
      for (let i = 0; i < validatedData.items.length; i++) {
        const item = validatedData.items[i];
        const tempProductData = buildTemporaryProductDataFromOrderItem(
          item,
          validatedData.supplierId,
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

    if (shouldReserveInventory(validatedData, transferMode)) {
      await reserveInventory(tx, validatedData, transferMode);
    }

    const salesOrder = await tx.salesOrder.create({
      data: {
        orderNumber,
        customerId: validatedData.customerId,
        userId,
        supplierId: validatedData.supplierId,
        status: validatedData.status || 'draft',
        orderType: validatedData.orderType,
        transferMode,
        costAmount: financials.costAmount,
        profitAmount: financials.profitAmount,
        itemsAmount: financials.itemsAmount,
        additionalFees: financials.additionalFees,
        expenseAmount: financials.expenseAmount,
        roundingAdjustment: financials.roundingAdjustment,
        totalAmount: financials.totalAmount,
        remarks: validatedData.remarks,
        items: {
          create: buildOrderItemsInput(
            validatedData,
            transferMode,
            temporaryProductIds
          ),
        },
        feeItems: {
          create: buildFeeItemsInput(validatedData),
        },
      },
      select: createSelect,
    });

    await recordCustomerPriceHistory(tx, validatedData, salesOrder.id);
    await maybeCreatePayable(tx, validatedData, financials.costAmount, userId, {
      id: salesOrder.id,
      orderNumber: salesOrder.orderNumber,
    });

    if (
      salesOrder.status === 'confirmed' &&
      Number(financials.totalAmount) > 0
    ) {
      const paymentNumber = await generatePaymentNumber(tx);
      const paymentAmount = Number(financials.totalAmount);
      await tx.paymentRecord.create({
        data: {
          paymentNumber,
          salesOrderId: salesOrder.id,
          customerId: salesOrder.customerId,
          userId,
          paymentType: 'order_payment',
          paymentMethod: 'cash',
          paymentAmount,
          actualPaymentAmount: 0,
          roundingAmount: Number(financials.roundingAdjustment),
          appliedAmount: 0,
          paymentDate: new Date(),
          status: 'pending',
          remarks: `系统自动生成：销售订单 ${salesOrder.orderNumber} 确认应收`,
        },
      });
    }

    if (validatedData.usePrepayment) {
      const prepaymentResult = await applyPrepaymentToOrder(
        tx,
        validatedData.customerId,
        financials.totalAmount,
        validatedData.prepaymentAmount ?? undefined
      );

      if (prepaymentResult.totalApplied > 0) {
        await tx.salesOrder.update({
          where: { id: salesOrder.id },
          data: {
            paidAmount: prepaymentResult.totalApplied,
          },
        });

        salesOrder.paidAmount = prepaymentResult.totalApplied;
      }
    }

    return salesOrder;
  }, getLongTransactionOptions());

  try {
    await executeInvalidation(ORDER_STATUS_CHANGE_INVALIDATION, {
      orderId: order.id,
      customerId: order.customerId,
    });
  } catch (error) {
    logger.error('sales-orders', '缓存失效失败', error, {
      orderId: order.id,
      customerId: order.customerId,
    });
  }

  const ledgerEligibleStatuses = new Set(['confirmed', 'shipped', 'completed']);
  const totalAmount = Number(order.totalAmount ?? 0);

  if (ledgerEligibleStatuses.has(order.status) && totalAmount > 0) {
    try {
      await recordPartnerTransaction({
        partnerId: order.customerId,
        partnerRole: 'customer',
        entityType: 'customer',
        transactionType: 'sale',
        amount: totalAmount,
        referenceId: order.id,
        referenceNumber: order.orderNumber,
        description: `销售订单 ${order.orderNumber} 创建并已确认`,
        occurredAt: order.createdAt,
        metadata: {
          status: order.status,
          triggeredBy: 'order:create',
        },
      });
    } catch (error) {
      logger.error('sales-orders', '记录往来账失败', error, {
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    }
  }

  // 手动获取产品信息
  const productIds = order.items
    .map(item => item.productId)
    .filter(Boolean) as string[];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      code: true,
      unit: true,
      specification: true,
      piecesPerUnit: true,
      weight: true,
    },
  });

  const productsMap = new Map<
    string,
    {
      id: string;
      name: string;
      code: string;
      unit: string;
      specification: string | null;
      piecesPerUnit: number;
      weight: number | null;
    }
  >(products.map(p => [p.id, p]));

  return mapCreatedOrder(order, productsMap);
}
