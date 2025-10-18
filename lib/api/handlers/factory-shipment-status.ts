/**
 * 厂家发货订单状态更新处理器
 * 包含幂等性保护和状态流转验证
 * 遵循全局约定规范和唯一真理原则
 */

import { prisma } from '@/lib/db';
import {
  FACTORY_SHIPMENT_ITEM_OWNERSHIP,
  FACTORY_SHIPMENT_STATUS,
} from '@/lib/types/factory-shipment';
import { generatePaymentNumber } from '@/lib/utils/payment-number-generator';

/**
 * 状态流转规则
 */
export const validStatusTransitions: Record<string, string[]> = {
  [FACTORY_SHIPMENT_STATUS.DRAFT]: [
    FACTORY_SHIPMENT_STATUS.PLANNING,
    'cancelled',
  ],
  [FACTORY_SHIPMENT_STATUS.PLANNING]: [
    FACTORY_SHIPMENT_STATUS.WAITING_DEPOSIT,
    'cancelled',
  ],
  [FACTORY_SHIPMENT_STATUS.WAITING_DEPOSIT]: [
    FACTORY_SHIPMENT_STATUS.DEPOSIT_PAID,
    'cancelled',
  ],
  [FACTORY_SHIPMENT_STATUS.DEPOSIT_PAID]: [
    FACTORY_SHIPMENT_STATUS.FACTORY_SHIPPED,
  ],
  [FACTORY_SHIPMENT_STATUS.FACTORY_SHIPPED]: [
    FACTORY_SHIPMENT_STATUS.IN_TRANSIT,
  ],
  [FACTORY_SHIPMENT_STATUS.IN_TRANSIT]: [FACTORY_SHIPMENT_STATUS.ARRIVED],
  [FACTORY_SHIPMENT_STATUS.ARRIVED]: [FACTORY_SHIPMENT_STATUS.DELIVERED],
  [FACTORY_SHIPMENT_STATUS.DELIVERED]: [FACTORY_SHIPMENT_STATUS.COMPLETED],
  [FACTORY_SHIPMENT_STATUS.COMPLETED]: [], // 不能再变更
  cancelled: [], // 不能再变更
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
}

/**
 * 更新厂家发货订单状态
 * 包含状态流转验证和自动化业务逻辑
 */
export async function updateFactoryShipmentStatus(
  orderId: string,
  newStatus: string,
  currentStatus: string,
  data: {
    containerNumber?: string;
    remarks?: string;
    shipmentDate?: Date;
    arrivalDate?: Date;
    deliveryDate?: Date;
    completionDate?: Date;
  }
): Promise<OrderStatusUpdateResult> {
  // 验证状态流转
  const validation = validateStatusTransition(currentStatus, newStatus);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  // 执行状态更新
  return await prisma.$transaction(async tx => {
    // 更新订单状态
    const order = await tx.factoryShipmentOrder.update({
      where: { id: orderId },
      data: {
        status: newStatus,
        ...(data.containerNumber !== undefined && {
          containerNumber: data.containerNumber,
        }),
        ...(data.remarks !== undefined && { remarks: data.remarks }),
        ...(data.shipmentDate && { shipmentDate: data.shipmentDate }),
        ...(data.arrivalDate && { arrivalDate: data.arrivalDate }),
        ...(data.deliveryDate && { deliveryDate: data.deliveryDate }),
        ...(data.completionDate && { completionDate: data.completionDate }),
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
      },
    });

    let receivableCreated = false;
    let paymentRecordId: string | null = null;

    if (
      newStatus === FACTORY_SHIPMENT_STATUS.DELIVERED ||
      newStatus === FACTORY_SHIPMENT_STATUS.COMPLETED
    ) {
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

    if (
      newStatus === FACTORY_SHIPMENT_STATUS.DELIVERED ||
      newStatus === FACTORY_SHIPMENT_STATUS.COMPLETED
    ) {
      const existingReceivable = await tx.paymentRecord.findFirst({
        where: {
          factoryShipmentOrderId: orderId,
        },
        select: { id: true },
      });

      if (!existingReceivable) {
        const customerTotals = await tx.factoryShipmentOrderItem.aggregate({
          where: {
            factoryShipmentOrderId: orderId,
            ownership: FACTORY_SHIPMENT_ITEM_OWNERSHIP.CUSTOMER,
          },
          _sum: {
            totalPrice: true,
          },
        });

        const customerTotal = customerTotals._sum.totalPrice || 0;
        const outstandingAmount = Math.max(
          customerTotal - (order.depositAmount || 0) - (order.paidAmount || 0),
          0
        );

        if (outstandingAmount > 0) {
          const paymentNumber = await generatePaymentNumber(tx);
          const paymentRecord = await tx.paymentRecord.create({
            data: {
              paymentNumber,
              salesOrderId: null,
              factoryShipmentOrderId: orderId,
              customerId: order.customerId,
              userId: order.userId,
              paymentType: 'order_payment',
              paymentMethod: 'other',
              paymentAmount: outstandingAmount,
              actualPaymentAmount: outstandingAmount,
              roundingAmount: 0,
              paymentDate: data.deliveryDate ?? new Date(),
              status: 'pending',
              remarks: '系统自动生成应收（厂家直发）',
            },
            select: {
              id: true,
            },
          });

          paymentRecordId = paymentRecord.id;
          receivableCreated = true;
        }
      }
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
