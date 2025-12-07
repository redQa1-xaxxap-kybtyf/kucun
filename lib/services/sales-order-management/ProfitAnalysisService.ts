// @ts-nocheck

import { PrismaClient } from '@prisma/client';

import type { ProfitAnalysisConfig, ProfitAlert } from './types';

const prisma = new PrismaClient();

export interface ProfitCalculationRequest {
  salesOrderId: string;
  configId?: string; // 使用特定的利润分析配置
}

export interface ProfitCalculationResult {
  salesOrderId: string;
  grossProfit: number; // 毛利润
  netProfit: number; // 净利润
  grossMargin: number; // 毛利率
  netMargin: number; // 净利率
  totalRevenue: number; // 总收入
  totalCost: number; // 总成本
  totalExpenses: number; // 总费用
  breakdown: {
    itemsCost: number; // 商品成本
    shippingCost: number; // 运费
    packagingCost: number; // 包装费
    handlingCost: number; // 手续费
    otherExpenses: number; // 其他费用
    taxes: number; // 税费
  };
  alerts: ProfitAlert[];
}

export class ProfitAnalysisService {
  /**
   * 计算订单利润
   */
  public async calculateOrderProfit(
    request: ProfitCalculationRequest
  ): Promise<ProfitCalculationResult> {
    try {
      // 获取订单详情
      const order = await prisma.salesOrder.findUnique({
        where: { id: request.salesOrderId },
        include: {
          items: true,
          feeItems: true,
        },
      });

      if (!order) {
        throw new Error('订单不存在');
      }

      // 获取利润分析配置
      const config = await this.getProfitAnalysisConfig(request.configId);

      // 计算商品成本
      const itemsCost = order.items.reduce(
        (sum, item) => sum + (item.unitCost || 0) * item.quantity,
        0
      );

      // 计算各项费用
      const expenses = this.calculateExpenses(order.feeItems, config);

      // 计算总收入
      const totalRevenue = order.totalAmount;

      // 计算总成本和费用
      const totalCost = itemsCost;
      const totalExpenses =
        expenses.shippingCost +
        expenses.packagingCost +
        expenses.handlingCost +
        expenses.otherExpenses +
        expenses.taxes;

      // 计算利润
      const grossProfit = totalRevenue - totalCost;
      const netProfit = grossProfit - totalExpenses;

      // 计算利润率
      const grossMargin =
        totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      // 生成预警
      const alerts = await this.generateProfitAlerts(
        order.id,
        {
          grossMargin,
          netMargin,
          grossProfit,
          netProfit,
          totalCost,
          totalRevenue,
        },
        config
      );

      // 更新订单利润字段
      await prisma.salesOrder.update({
        where: { id: order.id },
        data: {
          costAmount: totalCost,
          profitAmount: netProfit,
          expenseAmount: totalExpenses,
        },
      });

      return {
        salesOrderId: order.id,
        grossProfit,
        netProfit,
        grossMargin,
        netMargin,
        totalRevenue,
        totalCost,
        totalExpenses,
        breakdown: {
          itemsCost,
          ...expenses,
        },
        alerts,
      };
    } catch (error: any) {
      throw new Error(`利润计算失败: ${error.message}`);
    }
  }

  /**
   * 计算费用分摊
   */
  private calculateExpenses(feeItems: any[], config: ProfitAnalysisConfig) {
    let shippingCost = 0;
    let packagingCost = 0;
    let handlingCost = 0;
    let otherExpenses = 0;

    feeItems.forEach(fee => {
      switch (fee.feeType) {
        case 'shipping':
          if (config.includeShippingCosts) shippingCost += fee.feeAmount;
          break;
        case 'packaging':
          if (config.includePackagingCosts) packagingCost += fee.feeAmount;
          break;
        case 'handling':
          if (config.includeHandlingCosts) handlingCost += fee.feeAmount;
          break;
        default:
          otherExpenses += fee.feeAmount;
      }
    });

    const subtotal =
      shippingCost + packagingCost + handlingCost + otherExpenses;
    const taxes = subtotal * config.taxRate;

    return {
      shippingCost,
      packagingCost,
      handlingCost,
      otherExpenses,
      taxes,
    };
  }

  /**
   * 生成利润预警
   */
  private async generateProfitAlerts(
    orderId: string,
    metrics: {
      grossMargin: number;
      netMargin: number;
      grossProfit: number;
      netProfit: number;
      totalCost: number;
      totalRevenue: number;
    },
    config: ProfitAnalysisConfig
  ): Promise<ProfitAlert[]> {
    const alerts: ProfitAlert[] = [];

    // 检查负利润
    if (metrics.netProfit < 0) {
      alerts.push({
        id: '', // 将在保存时生成
        salesOrderId: orderId,
        alertType: 'NEGATIVE_PROFIT',
        alertLevel: 'CRITICAL',
        currentMargin: metrics.netMargin,
        profitAmount: metrics.netProfit,
        costAmount: metrics.totalCost,
        alertMessage: `订单出现负利润: ${metrics.netProfit.toFixed(2)}元`,
        isAcknowledged: false,
        createdAt: new Date(),
      });
    }

    // 检查低利润率
    if (metrics.netMargin < config.profitMarginThresholdLow * 100) {
      alerts.push({
        id: '',
        salesOrderId: orderId,
        alertType: 'LOW_MARGIN',
        alertLevel:
          metrics.netMargin < config.profitMarginThresholdLow * 50
            ? 'CRITICAL'
            : 'WARNING',
        currentMargin: metrics.netMargin,
        thresholdMargin: config.profitMarginThresholdLow * 100,
        profitAmount: metrics.netProfit,
        alertMessage: `利润率过低: ${metrics.netMargin.toFixed(2)}%，低于阈值 ${(config.profitMarginThresholdLow * 100).toFixed(2)}%`,
        isAcknowledged: false,
        createdAt: new Date(),
      });
    }

    // 检查高成本
    const costRatio = metrics.totalCost / metrics.totalRevenue;
    if (costRatio > 0.8) {
      alerts.push({
        id: '',
        salesOrderId: orderId,
        alertType: 'HIGH_COST',
        alertLevel: costRatio > 0.9 ? 'CRITICAL' : 'WARNING',
        costAmount: metrics.totalCost,
        alertMessage: `成本占比过高: ${(costRatio * 100).toFixed(2)}%`,
        isAcknowledged: false,
        createdAt: new Date(),
      });
    }

    // 保存预警记录
    for (const alert of alerts) {
      const savedAlert = await prisma.profitAlert.create({
        data: {
          salesOrderId: alert.salesOrderId,
          alertType: alert.alertType,
          alertLevel: alert.alertLevel,
          currentMargin: alert.currentMargin,
          thresholdMargin: alert.thresholdMargin,
          profitAmount: alert.profitAmount,
          costAmount: alert.costAmount,
          alertMessage: alert.alertMessage,
          isAcknowledged: false,
        },
      });
      alert.id = savedAlert.id;
    }

    return alerts;
  }

  /**
   * 获取利润分析配置
   */
  private async getProfitAnalysisConfig(
    configId?: string
  ): Promise<ProfitAnalysisConfig> {
    let config;

    if (configId) {
      config = await prisma.profitAnalysisConfig.findUnique({
        where: { id: configId },
      });
    }

    if (!config) {
      config = await prisma.profitAnalysisConfig.findFirst({
        where: { isDefault: true },
      });
    }

    if (!config) {
      // 返回默认配置
      return {
        id: 'default',
        configName: '默认配置',
        profitMarginThresholdLow: 0.1,
        profitMarginThresholdMedium: 0.2,
        profitMarginThresholdHigh: 0.3,
        costAllocationMethod: 'PROPORTIONAL',
        includeShippingCosts: true,
        includePackagingCosts: true,
        includeHandlingCosts: true,
        taxRate: 0,
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return config as ProfitAnalysisConfig;
  }
}
