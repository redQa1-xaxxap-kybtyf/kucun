import { type NextRequest, NextResponse } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { publishOrderStatus } from '@/lib/events';
import { logger } from '@/lib/logger';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import {
  createTransferPayableRecord,
  validateStatusTransition,
} from '@/lib/services/sales-order-service';
import { withIdempotency } from '@/lib/utils/idempotency';
import { updateOrderStatusSchema } from '@/lib/validations/sales-order';

// 获取单个销售订单信息
export const GET = withAuth(
  async (request: NextRequest, { params }) => {
    const { id } = await (params as Promise<{ id: string }>);

    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        userId: true,
        status: true,
        orderType: true,
        transferMode: true,
        itemsAmount: true,
        additionalFees: true,
        roundingAdjustment: true,
        supplierId: true,
        costAmount: true,
        profitAmount: true,
        totalAmount: true,
        remarks: true,
        shippedAt: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
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
            costSubtotal: true,
            profitAmount: true,
            isManualProduct: true,
            manualProductName: true,
            manualSpecification: true,
            manualWeight: true,
            manualUnit: true,
            displayUnit: true,
            displayQuantity: true,
            piecesPerUnit: true,
            specification: true,
            remarks: true,
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
          orderBy: {
            id: 'asc',
          },
        },
        feeItems: {
          select: {
            id: true,
            feeType: true,
            feeName: true,
            feeAmount: true,
            remarks: true,
          },
        },
        payments: {
          select: {
            id: true,
            paymentNumber: true,
            paymentAmount: true,
            actualPaymentAmount: true, // ✅ 新增: 实际到账金额
            roundingAmount: true, // ✅ 新增: 收款抹零金额
            paymentMethod: true,
            paymentDate: true,
            status: true,
            remarks: true,
            createdAt: true,
          },
          orderBy: {
            paymentDate: 'desc',
          },
        },
        returnOrders: {
          where: {
            status: {
              not: 'cancelled',
            },
          },
          select: {
            id: true,
            returnNumber: true,
            status: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!salesOrder) {
      throw ApiError.notFound('销售订单');
    }

    // 计算收款统计
    // ✅ 修复: 等效已收款 = 实际到账金额 + 收款抹零金额
    // 收款抹零算作已收款(优惠/减免视为收款完成)
    const confirmedPayments = salesOrder.payments.filter(
      record => record.status === 'confirmed'
    );
    const actualPaidAmount = confirmedPayments.reduce(
      (sum, record) => sum + Number(record.actualPaymentAmount),
      0
    );
    const paymentRounding = confirmedPayments.reduce(
      (sum, record) => sum + Number(record.roundingAmount || 0),
      0
    );
    const paidAmount = actualPaidAmount + paymentRounding;

    // ✅ 修复: 实际应收金额 = totalAmount + roundingAdjustment
    // roundingAdjustment 可正可负: 正数表示加价，负数表示减价(抹零)
    const actualTotalAmount =
      Number(salesOrder.totalAmount) +
      Number(salesOrder.roundingAdjustment || 0);
    const remainingAmount = Math.max(0, actualTotalAmount - paidAmount);

    const { returnOrders, ...rest } = salesOrder;

    return NextResponse.json({
      success: true,
      data: {
        ...rest,
        hasReturnOrder: returnOrders.length > 0,
        returnOrders: returnOrders.map(order => ({
          id: order.id,
          returnNumber: order.returnNumber,
          status: order.status,
          createdAt: order.createdAt.toISOString(),
        })),
        // ✅ 修复: 转换收款记录中的 Date 对象为 ISO 字符串
        paymentRecords: salesOrder.payments.map(payment => ({
          ...payment,
          paymentDate: payment.paymentDate.toISOString(),
          createdAt: payment.createdAt.toISOString(),
        })),
        actualPaidAmount, // ✅ 新增: 实际到账金额
        paymentRounding, // ✅ 新增: 收款抹零金额
        paidAmount, // 等效已收款(到账+抹零)
        remainingAmount,
      },
    });
  },
  { permissions: ['orders:view'] }
);

// 更新销售订单状态
export const PUT = withAuth(
  async (request: NextRequest, { user, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    const userId = user.id;

    const body = await request.json();

    // 验证输入数据 - 使用状态更新专用schema
    const validationResult = updateOrderStatusSchema.safeParse({
      id,
      ...body,
    });
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { idempotencyKey, status, remarks } = validationResult.data;

    // 检查订单是否存在
    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        orderType: true,
        supplierId: true,
        costAmount: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: '销售订单不存在' },
        { status: 404 }
      );
    }

    // 验证状态流转规则(使用服务层函数)
    const validation = validateStatusTransition(existingOrder.status, status);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.error,
        },
        { status: 400 }
      );
    }

    // 如果要标记为完成状态，检查是否已全部收款
    if (status === 'completed') {
      const orderWithPayments = await prisma.salesOrder.findUnique({
        where: { id },
        select: {
          totalAmount: true,
          roundingAdjustment: true, // ✅ 新增: 获取订单抹零金额
          payments: {
            where: { status: 'confirmed' },
            select: {
              actualPaymentAmount: true, // 实际到账金额
              roundingAmount: true, // 收款抹零金额(优惠/减免)
            },
          },
        },
      });

      if (orderWithPayments) {
        // ✅ 修复: 等效收款 = 实际到账 + 收款抹零(优惠/减免算作已收)
        const paidAmount = orderWithPayments.payments.reduce(
          (sum, record) =>
            sum +
            Number(record.actualPaymentAmount) +
            Number(record.roundingAmount || 0),
          0
        );
        // ✅ 修复: 实际应收金额 = totalAmount + roundingAdjustment
        const actualTotalAmount =
          Number(orderWithPayments.totalAmount) +
          Number(orderWithPayments.roundingAdjustment || 0);
        const remainingAmount = actualTotalAmount - paidAmount;

        if (remainingAmount > 0.01) {
          // 允许0.01的浮点误差
          return NextResponse.json(
            {
              success: false,
              error: `订单尚未全部收款，还有 ${remainingAmount.toFixed(2)} 元待收款，无法标记为完成`,
            },
            { status: 400 }
          );
        }
      }
    }

    // 使用幂等性包装器执行状态更新
    const { updateSalesOrderStatus, getAffectedProductIds } = await import(
      '@/lib/api/handlers/sales-order-status'
    );

    const result = await withIdempotency(
      idempotencyKey,
      'sales_order_status_change',
      id,
      userId,
      { status, remarks },
      async () =>
        await updateSalesOrderStatus(
          id,
          status,
          existingOrder.status,
          remarks,
          userId
        )
    );

    // 如果涉及库存变更,清除缓存
    if (result.inventoryUpdated || result.reservedInventoryReleased) {
      const { invalidateInventoryCache } = await import(
        '@/lib/cache/inventory-cache'
      );
      const productIds = await getAffectedProductIds(id);
      for (const productId of productIds) {
        await invalidateInventoryCache(productId);
      }
    }

    // 如果是调货销售且状态变更为confirmed,创建应付款记录(使用服务层函数)
    if (
      status === 'confirmed' &&
      existingOrder.orderType === 'TRANSFER' &&
      existingOrder.supplierId &&
      (existingOrder.costAmount || 0) > 0
    ) {
      await createTransferPayableRecord(
        existingOrder.id,
        existingOrder.orderNumber,
        existingOrder.supplierId,
        existingOrder.costAmount || 0,
        userId
      );
    }

    // ✅ 修复: 如果订单状态变更为已发货,检查是否已全额收款,如果是则自动完成订单
    let autoCompletedOrder = false;
    if (status === 'shipped') {
      const orderWithPayments = await prisma.salesOrder.findUnique({
        where: { id },
        select: {
          totalAmount: true,
          roundingAdjustment: true, // ✅ 新增: 获取订单抹零金额
          payments: {
            where: { status: 'confirmed' },
            select: {
              actualPaymentAmount: true, // 实际到账金额
              roundingAmount: true, // 收款抹零金额(优惠/减免)
            },
          },
        },
      });

      if (orderWithPayments) {
        // ✅ 修复: 等效收款 = 实际到账 + 收款抹零(优惠/减免算作已收)
        const paidAmount = orderWithPayments.payments.reduce(
          (sum, record) =>
            sum +
            Number(record.actualPaymentAmount) +
            Number(record.roundingAmount || 0),
          0
        );
        // ✅ 修复: 实际应收金额 = totalAmount + roundingAdjustment
        const actualTotalAmount =
          Number(orderWithPayments.totalAmount) +
          Number(orderWithPayments.roundingAdjustment || 0);
        const remainingAmount = actualTotalAmount - paidAmount;

        // 如果已全额收款(允许0.01的浮点误差),自动完成订单
        if (remainingAmount <= 0.01) {
          await prisma.salesOrder.update({
            where: { id },
            data: { status: 'completed' },
          });
          autoCompletedOrder = true;

          logger.info(
            'sales-orders',
            `订单 ${existingOrder.orderNumber} 发货后检测到已全额收款,自动完成订单`,
            {
              orderId: id,
              orderNumber: existingOrder.orderNumber,
              totalAmount: orderWithPayments.totalAmount,
              roundingAdjustment: orderWithPayments.roundingAdjustment,
              actualTotalAmount,
              paidAmount,
              remainingAmount,
            }
          );
        }
      }
    }

    // 获取更新后的完整订单信息
    const fullOrder = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        userId: true,
        status: true,
        returnOrders: {
          where: {
            status: {
              not: 'cancelled',
            },
          },
          select: {
            id: true,
            returnNumber: true,
            status: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        totalAmount: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            productId: true,
            colorCode: true,
            productionDate: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    // 转换数据格式
    if (!fullOrder) {
      return NextResponse.json(
        { success: false, error: '订单更新失败' },
        { status: 500 }
      );
    }

    const formattedOrder = {
      id: fullOrder.id,
      orderNumber: fullOrder.orderNumber,
      customerId: fullOrder.customerId,
      userId: fullOrder.userId,
      status: fullOrder.status,
      hasReturnOrder: fullOrder.returnOrders.length > 0,
      returnOrders: fullOrder.returnOrders.map(order => ({
        id: order.id,
        returnNumber: order.returnNumber,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      })),
      totalAmount: fullOrder.totalAmount,
      remarks: fullOrder.remarks,
      customer: fullOrder.customer,
      user: fullOrder.user,
      items: fullOrder.items.map(item => ({
        id: item.id,
        productId: item.productId,
        colorCode: item.colorCode,
        productionDate: item.productionDate,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        product: item.product,
      })),
      createdAt: fullOrder.createdAt,
      updatedAt: fullOrder.updatedAt,
    };

    const ledgerAmount = Number(fullOrder.totalAmount ?? 0);
    // ✅ 业务规则: 订单发货时记录应收款，取消已发货订单时冲销应收款
    const becameShipped =
      status === 'shipped' &&
      !['shipped', 'completed'].includes(existingOrder.status);
    const becameCancelled =
      status === 'cancelled' &&
      ['confirmed', 'shipped', 'completed'].includes(
        existingOrder.status as string
      );

    if (ledgerAmount > 0) {
      if (becameShipped) {
        try {
          // 1. 记录应收款
          await recordPartnerTransaction({
            partnerId: fullOrder.customerId,
            partnerRole: 'customer',
            entityType: 'customer',
            transactionType: 'sale',
            amount: ledgerAmount,
            referenceId: fullOrder.id,
            referenceNumber: fullOrder.orderNumber,
            description: `销售订单 ${fullOrder.orderNumber} 已发货`,
            occurredAt: fullOrder.updatedAt ?? new Date(),
            metadata: {
              previousStatus: existingOrder.status,
              status,
              triggeredBy: 'order:status-change',
            },
          });

          // 2. ✅ 补充记录：检查是否有已确认的收款记录，需要补充记录到往来账单
          const confirmedPayments = await prisma.paymentRecord.findMany({
            where: {
              salesOrderId: fullOrder.id,
              status: 'confirmed',
              paymentType: 'order_payment',
            },
            select: {
              id: true,
              paymentNumber: true,
              actualPaymentAmount: true,
              paymentDate: true,
              paymentMethod: true,
            },
          });

          // 为每笔已确认的收款补充往来账记录
          for (const payment of confirmedPayments) {
            try {
              await recordPartnerTransaction({
                partnerId: fullOrder.customerId,
                partnerRole: 'customer',
                entityType: 'customer',
                transactionType: 'payment_in',
                amount: Number(payment.actualPaymentAmount),
                referenceId: payment.id,
                referenceNumber: payment.paymentNumber,
                description: `收款 ${payment.paymentNumber}（订单发货时补记）`,
                occurredAt: payment.paymentDate ?? new Date(),
                metadata: {
                  paymentMethod: payment.paymentMethod,
                  paymentType: 'order_payment',
                  salesOrderId: fullOrder.id,
                  triggeredBy: 'order:shipped-補記',
                },
              });
            } catch (error) {
              logger.error('sales-orders', '补记收款往来账失败', error, {
                paymentId: payment.id,
                paymentNumber: payment.paymentNumber,
              });
            }
          }
        } catch (error) {
          logger.error('sales-orders', '记录销售订单往来账失败', error, {
            orderId: fullOrder.id,
            orderNumber: fullOrder.orderNumber,
            previousStatus: existingOrder.status,
            status,
          });
        }
      } else if (becameCancelled) {
        try {
          await recordPartnerTransaction({
            partnerId: fullOrder.customerId,
            partnerRole: 'customer',
            entityType: 'customer',
            transactionType: 'order_cancellation', // ✅ 使用订单取消类型,而非销售退货
            amount: ledgerAmount,
            referenceId: fullOrder.id,
            referenceNumber: fullOrder.orderNumber,
            description: `销售订单 ${fullOrder.orderNumber} 取消`,
            occurredAt: fullOrder.updatedAt ?? new Date(),
            metadata: {
              previousStatus: existingOrder.status,
              status,
              triggeredBy: 'order:status-change',
            },
          });
        } catch (error) {
          logger.error('sales-orders', '回滚销售订单往来账失败', error, {
            orderId: fullOrder.id,
            orderNumber: fullOrder.orderNumber,
            previousStatus: existingOrder.status,
            status,
          });
        }
      }
    }

    // 发布订单状态变更事件
    await publishOrderStatus({
      orderType: 'sales',
      orderId: fullOrder.id,
      orderNumber: fullOrder.orderNumber,
      oldStatus: existingOrder.status,
      newStatus: fullOrder.status,
      customerId: fullOrder.customerId,
      customerName: fullOrder.customer.name,
      userId: user.id,
    });

    // ✅ 关键修复：销售订单状态更新后，失效应收款缓存
    // 因为订单状态变更（特别是发货、完成、取消）会影响应收款数据
    const { revalidateFinance } = await import('@/lib/cache');
    await revalidateFinance('receivables');

    // 根据是否自动完成订单生成不同的提示消息
    const message = autoCompletedOrder
      ? '销售订单已发货，检测到已全额收款，订单已自动完成'
      : '销售订单更新成功';

    return NextResponse.json({
      success: true,
      data: formattedOrder,
      message,
    });
  },
  { permissions: ['orders:edit'] }
);

// 完整更新销售订单（草稿状态）
export const PATCH = withAuth(
  async (request: NextRequest, { params }) => {
    const { id } = await (params as Promise<{ id: string }>);

    const body = await request.json();

    // 导入更新schema
    const { salesOrderUpdateSchema } = await import(
      '@/lib/validations/sales-order'
    );

    // 验证输入数据
    const validationResult = salesOrderUpdateSchema.safeParse({
      id,
      ...body,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // 检查订单是否存在且为草稿状态
    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        orderNumber: true,
        orderType: true,
        transferMode: true,
        supplierId: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: '销售订单不存在' },
        { status: 404 }
      );
    }

    // 只允许更新草稿状态的订单
    if (existingOrder.status !== 'draft') {
      return NextResponse.json(
        {
          success: false,
          error: '只能更新草稿状态的订单',
        },
        { status: 400 }
      );
    }

    const orderType =
      updateData.orderType ?? existingOrder.orderType ?? 'NORMAL';
    const transferMode =
      orderType === 'TRANSFER'
        ? (updateData.transferMode ??
          existingOrder.transferMode ??
          'SUPPLIER_ONLY')
        : 'SUPPLIER_ONLY';

    let itemsAmount = 0;
    let costAmount = 0;

    if (updateData.items && updateData.items.length > 0) {
      for (const item of updateData.items) {
        const quantity = item.quantity ?? 0;
        const unitPrice = item.unitPrice ?? 0;
        const subtotal =
          item.subtotal ?? Math.round(quantity * unitPrice * 100) / 100;

        itemsAmount += subtotal;

        const effectiveTransferQuantity =
          orderType === 'TRANSFER' && transferMode === 'MIXED'
            ? (item.transferQuantity ?? 0)
            : quantity;

        const unitCost = item.unitCost ?? 0;
        const itemCost = unitCost * effectiveTransferQuantity;

        costAmount += itemCost;
      }
    }

    itemsAmount = Math.round(itemsAmount * 100) / 100;
    costAmount = Math.round(costAmount * 100) / 100;

    const rawAdditionalFees =
      updateData.feeItems?.reduce((sum, fee) => sum + fee.feeAmount, 0) ?? 0;
    const additionalFees = Math.round(rawAdditionalFees * 100) / 100;
    const roundingAdjustment =
      Math.round((updateData.roundingAdjustment ?? 0) * 100) / 100;

    const totalAmount =
      Math.round((itemsAmount + additionalFees + roundingAdjustment) * 100) /
      100;
    const profitAmount =
      orderType === 'TRANSFER'
        ? Math.round((itemsAmount - costAmount) * 100) / 100
        : 0;

    // 使用事务更新订单
    const updatedOrder = await prisma.$transaction(async tx => {
      // 删除现有明细项
      await tx.salesOrderItem.deleteMany({
        where: { salesOrderId: id },
      });
      await tx.salesOrderFeeItem.deleteMany({
        where: { salesOrderId: id },
      });

      // 更新订单主表
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
          roundingAdjustment,
          totalAmount,
          remarks: updateData.remarks || null,
          items: updateData.items
            ? {
                create: updateData.items.map(item => {
                  const quantity = item.quantity ?? 0;
                  const unitPrice = item.unitPrice ?? 0;
                  const subtotal =
                    item.subtotal ??
                    Math.round(quantity * unitPrice * 100) / 100;

                  const localQuantity =
                    orderType === 'TRANSFER'
                      ? transferMode === 'MIXED'
                        ? (item.localQuantity ?? 0)
                        : 0
                      : quantity;
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

                  const unitCost =
                    item.unitCost === undefined ? undefined : item.unitCost;
                  const costSubtotal =
                    unitCost !== undefined && orderType === 'TRANSFER'
                      ? Math.round(unitCost * effectiveCostQuantity * 100) / 100
                      : undefined;
                  const profitSubtotal =
                    orderType === 'TRANSFER' && costSubtotal !== undefined
                      ? Math.round((subtotal - costSubtotal) * 100) / 100
                      : undefined;

                  return {
                    productId: item.productId,
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
                }),
              }
            : undefined,
          feeItems: updateData.feeItems
            ? {
                create: updateData.feeItems.map(fee => ({
                  feeType: fee.feeType,
                  feeName: fee.feeName,
                  feeAmount: fee.feeAmount,
                  remarks: fee.remarks ?? null,
                })),
              }
            : undefined,
        },
        select: {
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
          roundingAdjustment: true,
          costAmount: true,
          profitAmount: true,
          totalAmount: true,
          remarks: true,
          createdAt: true,
          updatedAt: true,
          returnOrders: {
            where: {
              status: {
                not: 'cancelled',
              },
            },
            select: {
              id: true,
              returnNumber: true,
              status: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              address: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
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
              remarks: true,
            },
          },
        },
      });
    });

    const { returnOrders, ...rest } = updatedOrder;

    return NextResponse.json({
      success: true,
      data: {
        ...rest,
        hasReturnOrder: returnOrders.length > 0,
        returnOrders: returnOrders.map(order => ({
          id: order.id,
          returnNumber: order.returnNumber,
          status: order.status,
          createdAt: order.createdAt.toISOString(),
        })),
      },
      message: '销售订单更新成功',
    });
  },
  { permissions: ['orders:edit'] }
);

// 删除销售订单（仅支持已取消的订单）
export const DELETE = withAuth(
  async (_request: NextRequest, { params }) => {
    const { id } = await (params as Promise<{ id: string }>);

    const existingOrder = await prisma.salesOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: '销售订单不存在' },
        { status: 404 }
      );
    }

    if (existingOrder.status !== 'cancelled') {
      return NextResponse.json(
        {
          success: false,
          error: '只有已取消的销售订单才能删除',
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async tx => {
      await tx.salesOrderItem.deleteMany({
        where: { salesOrderId: id },
      });
      await tx.salesOrderFeeItem.deleteMany({
        where: { salesOrderId: id },
      });
      await tx.salesOrder.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      data: { id },
      message: `销售订单 ${existingOrder.orderNumber} 已删除`,
    });
  },
  { permissions: ['orders:edit'] }
);
