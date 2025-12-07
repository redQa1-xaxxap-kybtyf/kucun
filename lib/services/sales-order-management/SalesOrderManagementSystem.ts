// @ts-nocheck

import { ExceptionHandlingService } from './ExceptionHandlingService';
import { ExpenseManagementService } from './ExpenseManagementService';
import { InventoryManagementService } from './InventoryManagementService';
import { OrderProcessingService } from './OrderProcessingService';
import { ProfitAnalysisService } from './ProfitAnalysisService';
import { ReportGenerationService } from './ReportGenerationService';
import type { OrderProcessingRequest } from './types';
import { ValidationService } from './ValidationService';

/**
 * 销售订单管理系统主入口类
 * 整合所有子模块，提供统一的API接口
 */
export class SalesOrderManagementSystem {
  private orderService: OrderProcessingService;
  private inventoryService: InventoryManagementService;
  private profitService: ProfitAnalysisService;
  private expenseService: ExpenseManagementService;
  private reportService: ReportGenerationService;
  private validationService: ValidationService;
  private exceptionService: ExceptionHandlingService;

  constructor() {
    this.orderService = new OrderProcessingService();
    this.inventoryService = new InventoryManagementService();
    this.profitService = new ProfitAnalysisService();
    this.expenseService = new ExpenseManagementService();
    this.reportService = new ReportGenerationService();
    this.validationService = new ValidationService();
    this.exceptionService = new ExceptionHandlingService();
  }

  /**
   * 完整的订单处理流程
   * 包括验证、库存检查、费用计算、利润分析等
   */
  public async processOrderComplete(
    orderData: any,
    userId: string
  ): Promise<{
    success: boolean;
    orderId?: string;
    message: string;
    validationResult?: any;
    inventoryResult?: any;
    profitResult?: any;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      // 1. 数据验证
      const validationResult =
        await this.validationService.validateOrderData(orderData);
      if (!validationResult.isValid) {
        return {
          success: false,
          message: '订单数据验证失败',
          validationResult,
          errors: validationResult.errors,
        };
      }

      // 2. 库存验证
      for (const item of orderData.items) {
        const inventoryCheck =
          await this.inventoryService.checkInventoryAvailability({
            productId: item.productId,
            variantId: item.variantId,
            requiredQuantity: item.quantity,
          });

        if (!inventoryCheck.available) {
          return {
            success: false,
            message: `库存不足: ${inventoryCheck.message}`,
            inventoryResult: inventoryCheck,
          };
        }
      }

      // 3. 创建订单
      const orderRequest: OrderProcessingRequest = {
        orderId: orderData.id || 'new-order',
        action: 'create',
        userId,
        data: orderData,
      };

      const orderResult = await this.orderService.processOrder(orderRequest);
      if (!orderResult.success) {
        return {
          success: false,
          message: orderResult.message,
          errors: orderResult.errors,
        };
      }

      // 4. 库存预留
      const reservations = [];
      for (const item of orderData.items) {
        try {
          const reservation = await this.inventoryService.reserveInventory({
            salesOrderId: orderResult.orderId,
            salesOrderItemId: item.id || `item-${Date.now()}`,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            reservedBy: userId,
          });
          reservations.push(reservation);
        } catch (error: any) {
          // 如果预留失败，回滚之前的预留
          for (const prevReservation of reservations) {
            await this.inventoryService.releaseReservation(
              prevReservation.id,
              userId,
              '订单创建失败回滚'
            );
          }
          return {
            success: false,
            message: `库存预留失败: ${error.message}`,
          };
        }
      }

      // 5. 计算费用
      const expenseTypes = await this.expenseService.getExpenseTypes();
      for (const expenseType of expenseTypes) {
        if (expenseType.calculationMethod === 'PERCENTAGE') {
          const expenseCalc = await this.expenseService.calculateExpense({
            salesOrderId: orderResult.orderId,
            expenseTypeCode: expenseType.typeCode,
            baseAmount: orderData.totalAmount,
          });

          if (expenseCalc.requiresApproval) {
            await this.expenseService.submitExpenseApproval({
              salesOrderId: orderResult.orderId,
              feeItemId: `fee-${expenseType.typeCode}`,
              expenseTypeId: expenseType.id,
              requestedAmount: expenseCalc.finalAmount,
              requestedBy: userId,
            });
          }
        }
      }

      // 6. 利润分析
      const profitResult = await this.profitService.calculateOrderProfit({
        salesOrderId: orderResult.orderId,
      });

      return {
        success: true,
        orderId: orderResult.orderId,
        message: '订单处理完成',
        validationResult,
        profitResult,
        warnings: validationResult.warnings,
      };
    } catch (error: any) {
      // 异常处理
      const exception = {
        id: `exception-${Date.now()}`,
        type: 'BUSINESS_RULE_VIOLATION' as const,
        severity: 'HIGH' as const,
        message: error.message,
        details: { error: error.stack },
        context: {
          userId,
          timestamp: new Date(),
        },
      };

      const _handlingResult =
        await this.exceptionService.handleException(exception);

      return {
        success: false,
        message: `订单处理异常: ${error.message}`,
        errors: [error.message],
      };
    }
  }

  /**
   * 获取系统健康状态
   */
  public async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'error';
    checks: Record<string, boolean>;
    alerts: any[];
  }> {
    const checks: Record<string, boolean> = {};
    const alerts: any[] = [];

    try {
      // 数据完整性检查
      const integrityCheck = await this.reportService.validateDataIntegrity();
      checks.dataIntegrity = integrityCheck.isValid;
      if (!integrityCheck.isValid) {
        alerts.push(
          ...integrityCheck.errors.map(error => ({
            type: 'error',
            message: error,
          }))
        );
      }

      // 库存预警检查
      const stockAlerts = await this.inventoryService.checkSafetyStockAlerts();
      checks.inventoryAlerts = stockAlerts.length === 0;
      alerts.push(
        ...stockAlerts.map(alert => ({
          type: 'warning',
          message: alert.message,
        }))
      );

      // 待审核费用检查
      const pendingApprovals = await this.expenseService.getPendingApprovals();
      checks.pendingApprovals = pendingApprovals.length < 10; // 假设超过10个待审核为异常
      if (pendingApprovals.length >= 10) {
        alerts.push({
          type: 'warning',
          message: `有 ${pendingApprovals.length} 个费用待审核`,
        });
      }

      const overallStatus = Object.values(checks).every(check => check)
        ? alerts.length === 0
          ? 'healthy'
          : 'warning'
        : 'error';

      return {
        status: overallStatus,
        checks,
        alerts,
      };
    } catch (error: any) {
      return {
        status: 'error',
        checks: { systemError: false },
        alerts: [{ type: 'error', message: `系统检查失败: ${error.message}` }],
      };
    }
  }

  // 暴露各个子服务的实例，供外部直接调用
  public get services() {
    return {
      order: this.orderService,
      inventory: this.inventoryService,
      profit: this.profitService,
      expense: this.expenseService,
      report: this.reportService,
      validation: this.validationService,
      exception: this.exceptionService,
    };
  }
}
