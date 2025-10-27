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
  // 重要: 已发货后,用户不能手动变更状态
  // 运输中和到港由系统自动判定
  [FACTORY_SHIPMENT_STATUS.SHIPPED]: [],
  [FACTORY_SHIPMENT_STATUS.IN_TRANSIT]: [],
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
      // 已确认: 必须有商品明细和金额
      if (!order.items || order.items.length === 0) {
        return { valid: false, message: '必须有商品明细才能确认订单' };
      }
      if (!order.totalAmount || order.totalAmount <= 0) {
        return { valid: false, message: '订单金额必须大于0才能确认' };
      }
      return { valid: true, message: '' };

    case FACTORY_SHIPMENT_STATUS.SHIPPED:
      // 已发货: 必须填写集装箱号和船运公司
      if (!order.containerNumber?.trim()) {
        return { valid: false, message: '必须填写集装箱号才能标记为已发货' };
      }
      if (!order.shippingCompany?.trim()) {
        return {
          valid: false,
          message: '必须填写船运公司信息才能标记为已发货(用于自动查询运输状态)',
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
  isSystemUpdate = false
): Promise<OrderStatusUpdateResult> {
  // 验证状态流转(系统自动更新时跳过验证)
  if (!isSystemUpdate) {
    const validation = validateStatusTransition(currentStatus, newStatus);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
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

    // 当订单状态变更为已到港时，自动标记客户货为已交付
    if (newStatus === FACTORY_SHIPMENT_STATUS.ARRIVED) {
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

    // 当订单状态变更为已到港时，创建应收账款记录
    if (newStatus === FACTORY_SHIPMENT_STATUS.ARRIVED) {
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
