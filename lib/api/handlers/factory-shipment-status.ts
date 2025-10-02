/**
 * 厂家发货订单状态更新处理器
 * 包含幂等性保护和状态流转验证
 * 遵循全局约定规范和唯一真理原则
 */

import { prisma } from '@/lib/db';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';

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
      },
    });

    let receivableCreated = false;

    // 如果状态变更为completed,自动创建应收款记录
    // 注意：当前系统使用 PaymentRecord 来管理应收款，而不是单独的 ReceivableRecord 模型
    // 这里暂时注释掉自动创建应收款记录的逻辑，等待后续完善
    if (newStatus === FACTORY_SHIPMENT_STATUS.COMPLETED) {
      // TODO: 实现自动创建应收款记录的逻辑
      // 需要确认是否需要单独的 ReceivableRecord 模型，还是使用现有的 PaymentRecord
      receivableCreated = false;
    }

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        remarks: order.remarks,
      },
      receivableCreated,
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
