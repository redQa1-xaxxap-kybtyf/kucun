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
  // 已发货后,可以补充船公司信息并转为运输中
  // 也允许系统自动从已发货转为运输中
  [FACTORY_SHIPMENT_STATUS.SHIPPED]: [FACTORY_SHIPMENT_STATUS.IN_TRANSIT],
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
      // 已确认: 必须有商品明细和金额
      if (!order.items || order.items.length === 0) {
        return { valid: false, message: '必须有商品明细才能确认订单' };
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
  if (enableSmartTransition && !validateStatusTransition(currentStatus, newStatus).valid) {
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
  return await prisma.$transaction(async tx => {
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
        items: true,
        containerNumber: true,
        shippingCompany: true,
      },
    });

    if (!existingOrder) {
      throw new Error('订单不存在');
    }

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
        totalAmount: order.receivableAmount || 0,
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
        },
      });
    }

    let receivableCreated = false;
    let paymentRecordId: string | null = null;

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
    if (finalStatus === FACTORY_SHIPMENT_STATUS.SHIPPED || finalStatus === FACTORY_SHIPMENT_STATUS.ARRIVED) {
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
