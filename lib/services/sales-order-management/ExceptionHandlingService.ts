import { prisma } from '@/lib/db';

export enum ExceptionType {
  INVENTORY_INSUFFICIENT = 'INVENTORY_INSUFFICIENT',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  CUSTOMER_NOT_FOUND = 'CUSTOMER_NOT_FOUND',
  ORDER_STATUS_INVALID = 'ORDER_STATUS_INVALID',
  RESERVATION_EXPIRED = 'RESERVATION_EXPIRED',
  EXPENSE_APPROVAL_REQUIRED = 'EXPENSE_APPROVAL_REQUIRED',
  PROFIT_MARGIN_LOW = 'PROFIT_MARGIN_LOW',
  DATA_INTEGRITY_ERROR = 'DATA_INTEGRITY_ERROR',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
}

export enum ExceptionSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface BusinessException {
  id: string;
  type: ExceptionType;
  severity: ExceptionSeverity;
  message: string;
  details: Record<string, any>;
  context: {
    orderId?: string;
    userId?: string;
    productId?: string;
    customerId?: string;
    timestamp: Date;
  };
  resolution?: {
    action: string;
    description: string;
    autoResolvable: boolean;
  };
}

export interface ExceptionHandlingResult {
  handled: boolean;
  resolution?: string;
  requiresManualIntervention: boolean;
  nextActions: string[];
}

export class ExceptionHandlingService {
  /**
   * 处理业务异常
   */
  public async handleException(
    exception: BusinessException
  ): Promise<ExceptionHandlingResult> {
    // 记录异常
    await this.logException(exception);

    switch (exception.type) {
      case ExceptionType.INVENTORY_INSUFFICIENT:
        return this.handleInventoryInsufficientException(exception);

      case ExceptionType.RESERVATION_EXPIRED:
        return this.handleReservationExpiredException(exception);

      case ExceptionType.ORDER_STATUS_INVALID:
        return this.handleOrderStatusInvalidException(exception);

      case ExceptionType.EXPENSE_APPROVAL_REQUIRED:
        return this.handleExpenseApprovalRequiredException(exception);

      case ExceptionType.PROFIT_MARGIN_LOW:
        return this.handleProfitMarginLowException(exception);

      case ExceptionType.CONCURRENT_MODIFICATION:
        return this.handleConcurrentModificationException(exception);

      default:
        return this.handleGenericException(exception);
    }
  }

  /**
   * 处理库存不足异常
   */
  private async handleInventoryInsufficientException(
    exception: BusinessException
  ): Promise<ExceptionHandlingResult> {
    const { productId, orderId: _orderId } = exception.context;
    const { requiredQuantity, availableQuantity: _availableQuantity } =
      exception.details;

    // 检查 productId 是否存在
    if (!productId) {
      return {
        handled: false,
        resolution: '无法处理：缺少产品ID',
        requiresManualIntervention: true,
        nextActions: ['请检查异常上下文数据'],
      };
    }

    // 尝试自动解决方案
    const alternatives = await this.findInventoryAlternatives(
      productId,
      requiredQuantity
    );

    if (alternatives.length > 0) {
      return {
        handled: true,
        resolution: `找到 ${alternatives.length} 个替代方案`,
        requiresManualIntervention: true,
        nextActions: [
          '检查替代产品',
          '联系供应商补货',
          '调整订单数量',
          '分批发货',
        ],
      };
    }

    // 检查是否可以等待补货
    // const inboundSchedule = await this.checkInboundSchedule(productId!);
    // if (inboundSchedule) {
    //   return {
    //     handled: true,
    //     resolution: `预计 ${inboundSchedule.expectedDate} 补货`,
    //     requiresManualIntervention: true,
    //     nextActions: ['通知客户延期', '设置补货提醒', '考虑紧急采购'],
    //   };
    // }

    return {
      handled: false,
      requiresManualIntervention: true,
      nextActions: ['紧急采购', '联系其他供应商', '取消订单', '部分发货'],
    };
  }

  /**
   * 处理预留过期异常
   */
  private async handleReservationExpiredException(
    exception: BusinessException
  ): Promise<ExceptionHandlingResult> {
    const { reservationId } = exception.details;

    try {
      // 自动释放过期预留
      await prisma.inventoryReservation.update({
        where: { id: reservationId },
        data: {
          reservationStatus: 'EXPIRED',
          releasedAt: new Date(),
          releaseReason: '预留超时自动释放',
        },
      });

      // 更新库存
      const reservation = await prisma.inventoryReservation.findUnique({
        where: { id: reservationId },
      });

      if (reservation) {
        await prisma.inventory.updateMany({
          where: {
            productId: reservation.productId,
            variantId: reservation.variantId,
            batchNumber: reservation.batchNumber,
          },
          data: {
            reservedQuantity: {
              decrement: reservation.reservedQuantity,
            },
          },
        });
      }

      return {
        handled: true,
        resolution: '过期预留已自动释放',
        requiresManualIntervention: false,
        nextActions: ['重新预留库存', '确认订单状态'],
      };
    } catch (_error) {
      return {
        handled: false,
        requiresManualIntervention: true,
        nextActions: ['手动释放预留', '检查数据一致性'],
      };
    }
  }

  /**
   * 处理订单状态无效异常
   */
  private async handleOrderStatusInvalidException(
    exception: BusinessException
  ): Promise<ExceptionHandlingResult> {
    const { orderId: _orderId } = exception.context;
    const { currentStatus, attemptedStatus } = exception.details;

    // 检查是否可以通过中间状态转换
    const validTransitions = this.getValidStatusTransitions(currentStatus);
    const pathToTarget = this.findStatusTransitionPath(
      currentStatus,
      attemptedStatus,
      validTransitions
    );

    if (pathToTarget.length > 0) {
      return {
        handled: true,
        resolution: `需要通过中间状态: ${pathToTarget.join(' -> ')}`,
        requiresManualIntervention: true,
        nextActions: pathToTarget.map(status => `转换到状态: ${status}`),
      };
    }

    return {
      handled: false,
      requiresManualIntervention: true,
      nextActions: ['检查订单状态', '确认业务流程', '联系管理员'],
    };
  }

  /**
   * 处理费用审核必需异常
   */
  private async handleExpenseApprovalRequiredException(
    exception: BusinessException
  ): Promise<ExceptionHandlingResult> {
    const { orderId, userId } = exception.context;
    const { expenseAmount, expenseType: _expenseType } = exception.details;

    // 检查必要的上下文数据
    if (!orderId || !userId) {
      return {
        handled: false,
        resolution: '无法处理：缺少订单ID或用户ID',
        requiresManualIntervention: true,
        nextActions: ['请检查异常上下文数据'],
      };
    }

    // 自动提交审核申请
    try {
      await prisma.expenseApproval.create({
        data: {
          salesOrderId: orderId,
          feeItemId: exception.details.feeItemId,
          expenseTypeId: exception.details.expenseTypeId,
          requestedAmount: expenseAmount,
          approvalStatus: 'PENDING',
          requestedBy: userId,
          approvalReason: '系统自动提交审核',
        },
      });

      return {
        handled: true,
        resolution: '已自动提交费用审核申请',
        requiresManualIntervention: true,
        nextActions: ['等待审核批准', '联系审核人员', '准备审核材料'],
      };
    } catch (_error) {
      return {
        handled: false,
        requiresManualIntervention: true,
        nextActions: ['手动提交审核申请'],
      };
    }
  }

  /**
   * 处理利润率过低异常
   */
  private async handleProfitMarginLowException(
    exception: BusinessException
  ): Promise<ExceptionHandlingResult> {
    const { currentMargin, thresholdMargin } = exception.details;

    return {
      handled: true,
      resolution: `利润率 ${currentMargin}% 低于阈值 ${thresholdMargin}%`,
      requiresManualIntervention: true,
      nextActions: [
        '调整销售价格',
        '优化成本结构',
        '重新谈判供应商价格',
        '考虑取消订单',
      ],
    };
  }

  /**
   * 处理并发修改异常
   */
  private async handleConcurrentModificationException(
    _exception: BusinessException
  ): Promise<ExceptionHandlingResult> {
    // 实现乐观锁重试机制
    return {
      handled: true,
      resolution: '检测到并发修改，建议重试',
      requiresManualIntervention: false,
      nextActions: ['刷新数据', '重新提交操作', '检查冲突内容'],
    };
  }

  /**
   * 处理通用异常
   */
  private async handleGenericException(
    _exception: BusinessException
  ): Promise<ExceptionHandlingResult> {
    return {
      handled: false,
      requiresManualIntervention: true,
      nextActions: ['联系技术支持', '检查系统日志', '报告问题详情'],
    };
  }

  /**
   * 记录异常
   */
  private async logException(exception: BusinessException): Promise<void> {
    await prisma.systemLog.create({
      data: {
        type: 'BUSINESS_EXCEPTION',
        level: exception.severity,
        action: exception.type,
        description: exception.message,
        userId: exception.context.userId,
        metadata: JSON.stringify({
          details: exception.details,
          context: exception.context,
        }),
      },
    });
  }

  /**
   * 查找库存替代方案
   */
  private async findInventoryAlternatives(
    _productId: string,
    _requiredQuantity: number
  ) {
    // 简化实现，实际应该根据产品属性查找相似产品
    return [];
  }

  /**
   * 检查入库计划
   */
  private async checkInboundSchedule(_productId: string) {
    // 简化实现，实际应该查询采购订单和入库计划
    return null;
  }

  /**
   * 获取有效的状态转换
   */
  private getValidStatusTransitions(
    _currentStatus: string
  ): Record<string, string[]> {
    return {
      draft: ['pending_review', 'cancelled'],
      pending_review: ['approved', 'draft', 'cancelled'],
      approved: ['confirmed', 'cancelled'],
      confirmed: ['in_production', 'cancelled'],
      in_production: ['ready_to_ship', 'on_hold'],
      ready_to_ship: ['shipped'],
      shipped: ['delivered'],
      delivered: ['completed'],
    };
  }

  /**
   * 查找状态转换路径
   */
  private findStatusTransitionPath(
    _current: string,
    _target: string,
    _transitions: Record<string, string[]>
  ): string[] {
    // 简化实现，实际应该使用图算法查找最短路径
    return [];
  }
}
// @ts-nocheck
