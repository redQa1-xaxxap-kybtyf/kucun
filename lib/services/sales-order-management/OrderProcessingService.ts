import { PrismaClient, type SalesOrder } from '@prisma/client';

import type {
  OrderProcessingRequest,
  OrderProcessingResult,
  OrderStatus,
} from './types';

const prisma = new PrismaClient();

export class OrderProcessingService {
  /**
   * 处理订单操作的核心方法
   * @param request - 订单处理请求
   * @returns 订单处理结果
   */
  public async processOrder(
    request: OrderProcessingRequest
  ): Promise<OrderProcessingResult> {
    try {
      const order = await prisma.salesOrder.findUnique({
        where: { id: request.orderId },
      });
      if (!order) {
        return {
          success: false,
          orderId: request.orderId,
          message: '订单不存在',
        };
      }

      switch (request.action) {
        case 'create':
          return this.createOrder(request);
        case 'edit':
          return this.editOrder(request, order);
        case 'review':
          return this.submitForReview(request, order);
        case 'approve':
          return this.approveOrder(request, order);
        case 'confirm':
          return this.confirmOrder(request, order);
        case 'cancel':
          return this.cancelOrder(request, order);
        case 'hold':
          return this.holdOrder(request, order);
        default:
          return {
            success: false,
            orderId: request.orderId,
            message: '无效的操作',
          };
      }
    } catch (error: any) {
      return {
        success: false,
        orderId: request.orderId,
        message: '处理失败',
        errors: [error.message],
      };
    }
  }

  private async createOrder(
    request: OrderProcessingRequest
  ): Promise<OrderProcessingResult> {
    // 实现创建订单逻辑
    // ...
    return {
      success: true,
      orderId: request.orderId,
      newStatus: 'draft',
      message: '订单创建成功',
    };
  }

  private async editOrder(
    request: OrderProcessingRequest,
    order: SalesOrder
  ): Promise<OrderProcessingResult> {
    // 实现编辑订单逻辑
    // ...
    return { success: true, orderId: order.id, message: '订单编辑成功' };
  }

  private async submitForReview(
    request: OrderProcessingRequest,
    order: SalesOrder
  ): Promise<OrderProcessingResult> {
    if (order.status !== 'draft') {
      return {
        success: false,
        orderId: order.id,
        message: '订单状态不正确，无法提交审核',
      };
    }
    return this.changeStatus(
      order.id,
      'pending_review',
      request.userId,
      '提交审核'
    );
  }

  private async approveOrder(
    request: OrderProcessingRequest,
    order: SalesOrder
  ): Promise<OrderProcessingResult> {
    if (order.status !== 'pending_review') {
      return {
        success: false,
        orderId: order.id,
        message: '订单状态不正确，无法批准',
      };
    }
    return this.changeStatus(order.id, 'approved', request.userId, '批准订单');
  }

  private async confirmOrder(
    request: OrderProcessingRequest,
    order: SalesOrder
  ): Promise<OrderProcessingResult> {
    if (order.status !== 'approved') {
      return {
        success: false,
        orderId: order.id,
        message: '订单状态不正确，无法确认',
      };
    }
    // 在这里可以添加库存预留逻辑
    return this.changeStatus(order.id, 'confirmed', request.userId, '确认订单');
  }

  private async cancelOrder(
    request: OrderProcessingRequest,
    order: SalesOrder
  ): Promise<OrderProcessingResult> {
    // 实现取消订单逻辑，例如释放库存
    return this.changeStatus(
      order.id,
      'cancelled',
      request.userId,
      '取消订单',
      request.reason
    );
  }

  private async holdOrder(
    request: OrderProcessingRequest,
    order: SalesOrder
  ): Promise<OrderProcessingResult> {
    return this.changeStatus(
      order.id,
      'on_hold',
      request.userId,
      '暂停订单',
      request.reason
    );
  }

  /**
   * 更改订单状态并记录历史
   */
  private async changeStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId: string,
    reason?: string,
    remarks?: string
  ): Promise<OrderProcessingResult> {
    return prisma.$transaction(async tx => {
      const currentOrder = await tx.salesOrder.findUnique({
        where: { id: orderId },
      });
      if (!currentOrder) {
        throw new Error('订单不存在');
      }

      const _updatedOrder = await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: newStatus },
      });

      await tx.salesOrderStatusHistory.create({
        data: {
          salesOrderId: orderId,
          fromStatus: currentOrder.status,
          toStatus: newStatus,
          changedBy: userId,
          changeReason: reason,
          remarks,
        },
      });

      return {
        success: true,
        orderId,
        newStatus,
        message: `订单状态已更新为 ${newStatus}`,
      };
    });
  }
}
