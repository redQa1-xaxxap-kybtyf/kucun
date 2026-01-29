/**
 * 厂家发货订单状态更新处理器
 * 包含幂等性保护和状态流转验证
 * 遵循全局约定规范和唯一真理原则
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import {
  FACTORY_SHIPMENT_ITEM_OWNERSHIP,
  FACTORY_SHIPMENT_STATUS,
} from '@/lib/types/factory-shipment';
import { toNumber } from '@/lib/utils/number';
import {
  generatePayableNumber,
  generatePaymentNumber,
} from '@/lib/utils/payment-number-generator';

/**
 * 状态流转规则
 *
 * 手动操作流程: 草稿 → 已确认 → 待发货 → 已发货
 * 系统自动流程: 已发货 → 运输中 → 到港 (通过运输查询自动判定)
 *
 * 重要:
 * - 用户手动操作只能到"已发货"状态
 * - "运输中"和"到港"状态由系统自动判定,不允许用户手动变更
 * - 系统通过船运公司查询货物状态,自动更新订单状态
 */
export const validStatusTransitions: Record<string, string[]> = {
  [FACTORY_SHIPMENT_STATUS.DRAFT]: [
    FACTORY_SHIPMENT_STATUS.CONFIRMED,
    FACTORY_SHIPMENT_STATUS.CANCELLED,
  ],
  [FACTORY_SHIPMENT_STATUS.CONFIRMED]: [
    FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT,
    FACTORY_SHIPMENT_STATUS.CANCELLED,
  ],
  [FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT]: [
    FACTORY_SHIPMENT_STATUS.SHIPPED,
    FACTORY_SHIPMENT_STATUS.CANCELLED,
  ],
  // 已发货后,可以补充船公司信息并转为运输中
  // 也允许系统自动从已发货转为运输中
  // 也允许用户直接确认到港（跳过运输中状态）
  [FACTORY_SHIPMENT_STATUS.SHIPPED]: [
    FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
    FACTORY_SHIPMENT_STATUS.ARRIVED,
  ],
  // 运输中可以转为到港
  [FACTORY_SHIPMENT_STATUS.IN_TRANSIT]: [FACTORY_SHIPMENT_STATUS.ARRIVED],
  // 到港是终态
  [FACTORY_SHIPMENT_STATUS.ARRIVED]: [],
  [FACTORY_SHIPMENT_STATUS.CANCELLED]: [],
};

/**
 * 验证状态流转是否合法
 */
export function validateStatusTransition(
  currentStatus: string,
  newStatus: string
): { valid: boolean; message: string } {
  const allowedStatuses = validStatusTransitions[currentStatus] || [];

  if (!allowedStatuses.includes(newStatus)) {
    return {
      valid: false,
      message: `订单状态不能从 ${currentStatus} 变更为 ${newStatus}`,
    };
  }

  return {
    valid: true,
    message: '状态流转合法',
  };
}

/**
 * 状态前置条件验证
 * 确保订单在变更状态前满足必要条件
 */
export function validateStatusPrerequisites(
  newStatus: string,
  order: {
    items?: Array<{ id: string }>;
    totalAmount?: number;
    containerNumber?: string | null;
    shippingCompany?: string | null;
  }
): { valid: boolean; message: string } {
  switch (newStatus) {
    case FACTORY_SHIPMENT_STATUS.CONFIRMED:
      // 已确认: 必须有产品明细和金额
      if (!order.items || order.items.length === 0) {
        return { valid: false, message: '必须有产品明细才能确认订单' };
      }
      if (!order.totalAmount || order.totalAmount <= 0) {
        return { valid: false, message: '订单金额必须大于0才能确认' };
      }
      return { valid: true, message: '' };

    case FACTORY_SHIPMENT_STATUS.SHIPPED:
      // 已发货: 必须有集装箱号(确认发货时填写),船运公司可选
      if (!order.containerNumber?.trim()) {
        return { valid: false, message: '必须填写集装箱号才能标记为已发货' };
      }
      return { valid: true, message: '' };

    case FACTORY_SHIPMENT_STATUS.IN_TRANSIT:
      // 运输中: 必须有集装箱号和船运公司信息才能追踪
      if (!order.containerNumber?.trim()) {
        return {
          valid: false,
          message: '必须填写集装箱号才能标记为运输中(需要追踪货物)',
        };
      }
      if (!order.shippingCompany?.trim()) {
        return {
          valid: false,
          message: '必须填写船运公司信息才能标记为运输中(用于追踪货物状态)',
        };
      }
      return { valid: true, message: '' };

    default:
      return { valid: true, message: '' };
  }
}

/**
 * 订单状态更新结果
 */
export interface OrderStatusUpdateResult {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    remarks?: string | null;
  };
  receivableCreated: boolean;
  paymentRecordId?: string | null;
  payableCreated: boolean;
  payableRecordIds?: string[];
}

/**
 * 获取智能状态流转路径
 * 用于确认发货时的自动状态流转
 */
function getSmartStatusTransition(
  currentStatus: string,
  targetStatus: string
): string[] {
  // 如果目标状态可以直接流转，返回单步
  if (validStatusTransitions[currentStatus]?.includes(targetStatus)) {
    return [targetStatus];
  }

  // 确认发货的特殊流转逻辑
  if (targetStatus === FACTORY_SHIPMENT_STATUS.SHIPPED) {
    switch (currentStatus) {
      case FACTORY_SHIPMENT_STATUS.DRAFT:
        // 草稿 → 已确认 → 待发货 → 已发货
        return [
          FACTORY_SHIPMENT_STATUS.CONFIRMED,
          FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT,
          FACTORY_SHIPMENT_STATUS.SHIPPED,
        ];
      case FACTORY_SHIPMENT_STATUS.CONFIRMED:
        // 已确认 → 待发货 → 已发货
        return [
          FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT,
          FACTORY_SHIPMENT_STATUS.SHIPPED,
        ];
      case FACTORY_SHIPMENT_STATUS.PENDING_SHIPMENT:
        // 待发货 → 已发货
        return [FACTORY_SHIPMENT_STATUS.SHIPPED];
      default:
        return [];
    }
  }

  return [];
}

/**
 * 更新厂家发货订单状态
 * 包含状态流转验证和自动化业务逻辑
 *
 * @param orderId - 订单ID
 * @param newStatus - 新状态
 * @param currentStatus - 当前状态
 * @param data - 更新数据
 * @param isSystemUpdate - 是否为系统自动更新(用于运输中/到港状态)
 * @param enableSmartTransition - 是否启用智能状态流转(用于确认发货)
 */
export async function updateFactoryShipmentStatus(
  orderId: string,
  newStatus: string,
  currentStatus: string,
  data: {
    containerNumber?: string;
    shippingCompany?: string;
    estimatedArrival?: Date;
    remarks?: string;
    shipmentDate?: Date;
    arrivalDate?: Date;
    deliveryDate?: Date;
    completionDate?: Date;
  },
  _isSystemUpdate = false,
  enableSmartTransition = false
): Promise<OrderStatusUpdateResult> {
  // 确定状态流转路径
  let statusPath: string[];
  if (
    enableSmartTransition &&
    !validateStatusTransition(currentStatus, newStatus).valid
  ) {
    // 需要智能流转
    statusPath = getSmartStatusTransition(currentStatus, newStatus);
    if (statusPath.length === 0) {
      throw new Error(`无法从状态 ${currentStatus} 流转到 ${newStatus}`);
    }
  } else {
    // 直接流转
    statusPath = [newStatus];
  }

  // 执行状态更新
  const startTime = Date.now();
  console.log(
    `[PERF] 开始执行 updateFactoryShipmentStatus, orderId: ${orderId}`
  );

  return await prisma.$transaction(async tx => {
    console.log(`[PERF] 事务开始, 耗时: ${Date.now() - startTime}ms`);

    const existingOrder = await tx.factoryShipmentOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        remarks: true,
        customerId: true,
        userId: true,
        receivableAmount: true,
        paidAmount: true,
        depositAmount: true,
        // ✅ 优化：只选择items中实际需要的字段，避免加载大量不必要的数据
        items: {
          select: {
            id: true,
            supplierId: true,
            quantity: true,
            unitCost: true,
            totalPrice: true,
            ownership: true,
          },
        },
        containerNumber: true,
        shippingCompany: true,
        shipmentDate: true,
        arrivalDate: true,
        deliveryDate: true,
        costAmount: true,
      },
    });

    console.log(`[PERF] 订单查询完成, 耗时: ${Date.now() - startTime}ms`);

    if (!existingOrder) {
      throw new Error('订单不存在');
    }

    // ... (省略中间代码)

    const { items: orderItems, ...orderWithoutItems } = existingOrder;
    type OrderSnapshot = typeof orderWithoutItems;
    let order: OrderSnapshot = orderWithoutItems;

    // 逐步执行状态流转
    for (const targetStatus of statusPath) {
      // 验证当前步骤的状态流转
      const validation = validateStatusTransition(order.status, targetStatus);
      if (!validation.valid) {
        throw new Error(`状态流转失败: ${validation.message}`);
      }

      // 验证状态前置条件 - 合并数据库中的现有值和新提交的值
      const prerequisites = validateStatusPrerequisites(targetStatus, {
        items: orderItems,
        totalAmount: toNumber(order.receivableAmount),
        containerNumber: data.containerNumber ?? order.containerNumber,
        shippingCompany: data.shippingCompany ?? order.shippingCompany,
      });
      if (!prerequisites.valid) {
        throw new Error(`状态前置条件不满足: ${prerequisites.message}`);
      }

      // 更新订单状态
      order = await tx.factoryShipmentOrder.update({
        where: { id: orderId },
        data: {
          status: targetStatus,
          // 只在最终状态时更新业务数据
          ...(targetStatus === statusPath[statusPath.length - 1] && {
            ...(data.containerNumber !== undefined && {
              containerNumber: data.containerNumber,
            }),
            ...(data.shippingCompany !== undefined && {
              shippingCompany: data.shippingCompany,
            }),
            ...(data.estimatedArrival && {
              estimatedArrival: data.estimatedArrival,
            }),
            ...(data.remarks !== undefined && { remarks: data.remarks }),
            ...(data.shipmentDate && { shipmentDate: data.shipmentDate }),
            ...(data.arrivalDate && { arrivalDate: data.arrivalDate }),
            ...(data.deliveryDate && { deliveryDate: data.deliveryDate }),
            ...(data.completionDate && { completionDate: data.completionDate }),
          }),
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          remarks: true,
          customerId: true,
          userId: true,
          receivableAmount: true,
          paidAmount: true,
          depositAmount: true,
          containerNumber: true,
          shippingCompany: true,
          shipmentDate: true,
          arrivalDate: true,
          deliveryDate: true,
          costAmount: true,
        },
      });
    }

    let receivableCreated = false;
    let paymentRecordId: string | null = null;
    let payableCreated = false;
    const payableRecordIds: string[] = [];

    // 当订单状态变更为已到港时，自动标记客户货为已交付
    const finalStatus = statusPath[statusPath.length - 1];
    if (finalStatus === FACTORY_SHIPMENT_STATUS.ARRIVED) {
      await tx.factoryShipmentOrderItem.updateMany({
        where: {
          factoryShipmentOrderId: orderId,
          ownership: FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER,
          customerDeliveryStatus: { not: 'delivered' },
        },
        data: {
          customerDeliveryStatus: 'delivered',
          deliveryConfirmedAt: data.deliveryDate ?? new Date(),
        },
      });
    }

    // 当订单状态变更为已发货或已到港时，创建应收账款记录
    if (
      finalStatus === FACTORY_SHIPMENT_STATUS.SHIPPED ||
      finalStatus === FACTORY_SHIPMENT_STATUS.ARRIVED
    ) {
      try {
        logger.info('factory-shipment-status', '开始创建应收账款', {
          orderId,
          orderNumber: order.orderNumber,
          finalStatus,
        });

        const existingReceivable = await tx.paymentRecord.findFirst({
          where: {
            factoryShipmentOrderId: orderId,
          },
          select: { id: true },
        });

        if (!existingReceivable) {
          // ✅ 性能优化：使用已加载的orderItems数据计算，避免额外的数据库查询
          const customerTotal = orderItems
            .filter(
              item =>
                item.ownership === FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER
            )
            .reduce((sum, item) => sum + toNumber(item.totalPrice), 0);

          const depositAmount = toNumber(order.depositAmount);
          const paidAmount = toNumber(order.paidAmount);

          const outstandingAmount = Math.max(
            customerTotal - depositAmount - paidAmount,
            0
          );

          if (outstandingAmount > 0) {
            // 确保金额精度为2位小数（Decimal类型要求）
            const formattedAmount = Number(outstandingAmount.toFixed(2));

            logger.info('factory-shipment-status', '应收账款金额计算完成', {
              customerTotal,
              depositAmount,
              paidAmount,
              outstandingAmount: formattedAmount,
            });

            const paymentNumber = await generatePaymentNumber(tx);
            const paymentDate =
              data.shipmentDate ??
              order.shipmentDate ??
              data.arrivalDate ??
              order.arrivalDate ??
              data.deliveryDate ??
              order.deliveryDate ??
              new Date();
            const paymentRecord = await tx.paymentRecord.create({
              data: {
                paymentNumber,
                salesOrderId: null,
                factoryShipmentOrderId: orderId,
                customerId: order.customerId,
                userId: order.userId,
                paymentType: 'order_payment',
                paymentMethod: 'other',
                paymentAmount: formattedAmount,
                actualPaymentAmount: formattedAmount,
                roundingAmount: 0,
                paymentDate,
                status: 'pending',
                remarks: '系统自动生成应收（厂家直发）',
              },
              select: {
                id: true,
              },
            });

            paymentRecordId = paymentRecord.id;
            receivableCreated = true;

            logger.info('factory-shipment-status', '应收账款创建成功', {
              paymentRecordId,
              paymentNumber,
              amount: formattedAmount,
            });
          } else {
            logger.info(
              'factory-shipment-status',
              '无需创建应收账款（金额为0）',
              {
                orderId,
                outstandingAmount,
              }
            );
          }
        } else {
          logger.info('factory-shipment-status', '应收账款已存在，跳过创建', {
            orderId,
            existingReceivableId: existingReceivable.id,
          });
        }
      } catch (error) {
        logger.error('factory-shipment-status', '创建应收账款失败', error, {
          orderId,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
        });
        throw new Error(
          `创建应收账款失败: ${error instanceof Error ? error.message : '未知错误'}`
        );
      }
      console.log(`[PERF] 应收账款处理完成, 耗时: ${Date.now() - startTime}ms`);
    }

    // 记录厂家直发订单的往来账(应收), 保证伙伴账本与利润表口径一致
    const receivableAmount = toNumber(order.receivableAmount, 0);
    if (
      order.customerId &&
      (finalStatus === FACTORY_SHIPMENT_STATUS.ARRIVED ||
        finalStatus === FACTORY_SHIPMENT_STATUS.SHIPPED) &&
      receivableAmount > 0
    ) {
      try {
        await recordPartnerTransaction(
          {
            partnerId: order.customerId,
            partnerRole: 'customer',
            entityType: 'customer',
            transactionType: 'sale',
            amount: receivableAmount,
            referenceId: order.id,
            referenceNumber: order.orderNumber,
            description: `厂家直发订单 ${order.orderNumber} 确认应收`,
            userId: order.userId,
            occurredAt:
              data.shipmentDate ??
              order.shipmentDate ??
              data.arrivalDate ??
              order.arrivalDate ??
              new Date(),
            metadata: {
              source: 'factory_shipment_order',
              status: finalStatus,
            },
          },
          tx
        );
      } catch (error) {
        logger.error(
          'factory-shipment-status',
          '记录厂家直发往来账失败',
          error,
          {
            orderId,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
          }
        );
        // 往来账记录失败视为严重问题, 回滚本次状态更新以避免账实不一致
        throw new Error(
          `记录厂家直发往来账失败: ${
            error instanceof Error ? error.message : '未知错误'
          }`
        );
      }
    }

    const roundCurrency = (value: number): number =>
      Math.round((value + Number.EPSILON) * 100) / 100;

    if (
      finalStatus === FACTORY_SHIPMENT_STATUS.SHIPPED ||
      finalStatus === FACTORY_SHIPMENT_STATUS.ARRIVED
    ) {
      console.log(`[PERF] 开始处理应付账款, 耗时: ${Date.now() - startTime}ms`);
      try {
        logger.info('factory-shipment-status', '开始创建应付账款', {
          orderId,
          orderNumber: order.orderNumber,
          finalStatus,
        });

        const existingPayableCount = await tx.payableRecord.count({
          where: {
            sourceType: 'factory_shipment',
            sourceId: orderId,
          },
        });

        if (existingPayableCount === 0) {
          const supplierTotalsMap = new Map<string, number>();
          for (const item of orderItems) {
            if (!item.supplierId) continue;
            const quantity = Number(item.quantity ?? 0);
            const unitCost = toNumber(item.unitCost, Number.NaN);
            const fallbackTotal = toNumber(item.totalPrice, 0);
            const computedCost = Number.isFinite(unitCost)
              ? quantity * unitCost
              : fallbackTotal;
            const roundedCost = roundCurrency(computedCost);
            if (roundedCost <= 0) {
              continue;
            }
            supplierTotalsMap.set(
              item.supplierId,
              roundCurrency(
                (supplierTotalsMap.get(item.supplierId) ?? 0) + roundedCost
              )
            );
          }

          const supplierEntries = Array.from(supplierTotalsMap.entries());
          if (supplierEntries.length > 0) {
            const supplierTotalsSum = supplierEntries.reduce(
              (sum, [, amount]) => sum + Math.max(0, amount),
              0
            );

            // 始终使用供应商明细成本之和作为应付分配基数，避免被订单级 costAmount 人为“打折”
            const baseCost = roundCurrency(supplierTotalsSum);

            logger.info('factory-shipment-status', '应付账款成本计算完成', {
              supplierCount: supplierEntries.length,
              baseCost,
              supplierTotalsSum,
            });

            if (baseCost > 0) {
              const payableDateBase =
                data.shipmentDate ??
                order.shipmentDate ??
                data.arrivalDate ??
                order.arrivalDate ??
                new Date();
              const computeDueDate = () => {
                const dueDate = new Date(payableDateBase);
                dueDate.setDate(dueDate.getDate() + 30);
                return dueDate;
              };

              const creationQueue: Array<{
                supplierId: string;
                amount: number;
              }> = [];
              let allocatedBase = 0;
              let allocatedDeposit = 0;
              const depositAmount = roundCurrency(
                Math.min(
                  baseCost,
                  Math.max(0, toNumber(order.depositAmount, 0))
                )
              );

              supplierEntries.forEach(([supplierId, supplierCost], index) => {
                const normalizedCost = Math.max(0, supplierCost);
                const proportion =
                  supplierTotalsSum > 0
                    ? normalizedCost / supplierTotalsSum
                    : 1 / supplierEntries.length;

                const grossAmount =
                  index === supplierEntries.length - 1
                    ? roundCurrency(baseCost - allocatedBase)
                    : roundCurrency(baseCost * proportion);

                if (grossAmount <= 0) {
                  return;
                }

                allocatedBase = roundCurrency(allocatedBase + grossAmount);

                let depositShare = 0;
                if (depositAmount > 0) {
                  depositShare =
                    index === supplierEntries.length - 1
                      ? roundCurrency(depositAmount - allocatedDeposit)
                      : roundCurrency(depositAmount * proportion);
                  allocatedDeposit = roundCurrency(
                    allocatedDeposit + depositShare
                  );
                }

                const netAmount = roundCurrency(grossAmount - depositShare);

                if (netAmount <= 0) {
                  return;
                }

                creationQueue.push({ supplierId, amount: netAmount });
              });

              logger.info('factory-shipment-status', '应付账款分配完成', {
                queueLength: creationQueue.length,
                depositAmount,
              });

              // ✅ 性能优化：批量生成应付款编号，避免在循环中多次查询数据库
              const payableNumbers: string[] = [];
              for (let i = 0; i < creationQueue.length; i++) {
                payableNumbers.push(await generatePayableNumber(tx));
              }

              console.log(
                `[PERF] 应付款编号生成完成, 耗时: ${Date.now() - startTime}ms`
              );

              for (let i = 0; i < creationQueue.length; i++) {
                const payable = creationQueue[i];
                const payableNumber = payableNumbers[i];
                const description =
                  depositAmount > 0
                    ? `厂家直发订单 ${order.orderNumber} 自动生成应付款（已扣除定金）`
                    : `厂家直发订单 ${order.orderNumber} 自动生成应付款`;
                const dueDate = computeDueDate();
                const createdPayable = await tx.payableRecord.create({
                  data: {
                    payableNumber,
                    supplierId: payable.supplierId,
                    userId: order.userId,
                    sourceType: 'factory_shipment',
                    sourceId: orderId,
                    sourceNumber: order.orderNumber,
                    payableAmount: payable.amount,
                    remainingAmount: payable.amount,
                    dueDate,
                    status: 'pending',
                    paymentTerms: '30天',
                    description,
                    remarks: `关联厂家直发订单：${order.orderNumber}`,
                  },
                  select: {
                    id: true,
                  },
                });
                payableRecordIds.push(createdPayable.id);

                try {
                  await recordPartnerTransaction(
                    {
                      partnerId: payable.supplierId,
                      partnerRole: 'supplier',
                      entityType: 'supplier',
                      transactionType: 'purchase',
                      amount: payable.amount,
                      referenceId: createdPayable.id,
                      referenceNumber: payableNumber,
                      description,
                      userId: order.userId,
                      occurredAt: payableDateBase,
                      dueDate,
                      metadata: {
                        sourceType: 'factory_shipment',
                        sourceId: orderId,
                        sourceNumber: order.orderNumber,
                        payableRecordId: createdPayable.id,
                        triggeredBy: 'factory_shipment:payable_auto',
                      },
                    },
                    tx
                  );
                } catch (error) {
                  logger.error(
                    'factory-shipment-status',
                    '记录供应商往来账失败',
                    error,
                    {
                      orderId,
                      orderNumber: order.orderNumber,
                      payableRecordId: createdPayable.id,
                      supplierId: payable.supplierId,
                    }
                  );
                  throw new Error('记录供应商往来账失败');
                }
              }

              if (payableRecordIds.length > 0) {
                payableCreated = true;
                logger.info('factory-shipment-status', '应付账款创建成功', {
                  count: payableRecordIds.length,
                  payableRecordIds: payableRecordIds.join(', '),
                });
              }
            } else {
              logger.info(
                'factory-shipment-status',
                '无需创建应付账款（成本为0）',
                {
                  orderId,
                  baseCost,
                }
              );
            }
          } else {
            logger.info(
              'factory-shipment-status',
              '无供应商信息，跳过应付账款创建',
              {
                orderId,
              }
            );
          }
        } else {
          logger.info('factory-shipment-status', '应付账款已存在，跳过创建', {
            orderId,
            existingPayableCount,
          });
        }
      } catch (error) {
        logger.error('factory-shipment-status', '创建应付账款失败', error, {
          orderId,
          orderNumber: order.orderNumber,
        });
        throw new Error(
          `创建应付账款失败: ${error instanceof Error ? error.message : '未知错误'}`
        );
      }
      console.log(`[PERF] 应付账款处理完成, 耗时: ${Date.now() - startTime}ms`);
    }

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        remarks: order.remarks,
      },
      receivableCreated,
      paymentRecordId,
      payableCreated,
      payableRecordIds,
    };
  });
}

/**
 * 获取订单当前状态
 */
export async function getOrderCurrentStatus(
  orderId: string
): Promise<string | null> {
  const order = await prisma.factoryShipmentOrder.findUnique({
    where: { id: orderId },
    select: { status: true },
  });

  return order?.status || null;
}
