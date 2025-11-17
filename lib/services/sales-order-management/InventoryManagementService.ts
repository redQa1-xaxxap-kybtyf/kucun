import { PrismaClient } from '@prisma/client';

import type { InventoryReservation } from './types';

const prisma = new PrismaClient();

export interface InventoryCheckRequest {
  productId: string;
  variantId?: string;
  batchNumber?: string;
  requiredQuantity: number;
}

export interface InventoryCheckResult {
  available: boolean;
  availableQuantity: number;
  reservedQuantity: number;
  totalQuantity: number;
  shortfall?: number;
  message: string;
}

export interface ReservationRequest {
  salesOrderId: string;
  salesOrderItemId: string;
  productId: string;
  variantId?: string;
  batchNumber?: string;
  quantity: number;
  reservedBy: string;
  expirationHours?: number;
}

export class InventoryManagementService {
  /**
   * 检查库存可用性
   */
  public async checkInventoryAvailability(
    request: InventoryCheckRequest
  ): Promise<InventoryCheckResult> {
    try {
      const inventory = await prisma.inventory.findFirst({
        where: {
          productId: request.productId,
          variantId: request.variantId || null,
          batchNumber: request.batchNumber || null,
        },
      });

      if (!inventory) {
        return {
          available: false,
          availableQuantity: 0,
          reservedQuantity: 0,
          totalQuantity: 0,
          shortfall: request.requiredQuantity,
          message: '产品库存不存在',
        };
      }

      const availableQuantity = inventory.quantity - inventory.reservedQuantity;
      const available = availableQuantity >= request.requiredQuantity;

      return {
        available,
        availableQuantity,
        reservedQuantity: inventory.reservedQuantity,
        totalQuantity: inventory.quantity,
        shortfall: available ? 0 : request.requiredQuantity - availableQuantity,
        message: available
          ? '库存充足'
          : `库存不足，缺少 ${request.requiredQuantity - availableQuantity} 件`,
      };
    } catch (error: any) {
      throw new Error(`库存检查失败: ${error.message}`);
    }
  }

  /**
   * 预留库存
   */
  public async reserveInventory(
    request: ReservationRequest
  ): Promise<InventoryReservation> {
    return prisma.$transaction(async tx => {
      // 检查库存可用性
      const checkResult = await this.checkInventoryAvailability({
        productId: request.productId,
        variantId: request.variantId,
        batchNumber: request.batchNumber,
        requiredQuantity: request.quantity,
      });

      if (!checkResult.available) {
        throw new Error(`库存不足: ${checkResult.message}`);
      }

      // 更新库存预留量
      await tx.inventory.updateMany({
        where: {
          productId: request.productId,
          variantId: request.variantId || null,
          batchNumber: request.batchNumber || null,
        },
        data: {
          reservedQuantity: {
            increment: request.quantity,
          },
        },
      });

      // 创建预留记录
      const expiresAt = request.expirationHours
        ? new Date(Date.now() + request.expirationHours * 60 * 60 * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // 默认24小时

      const reservation = await tx.inventoryReservation.create({
        data: {
          reservationNumber: await this.generateReservationNumber(),
          salesOrderId: request.salesOrderId,
          salesOrderItemId: request.salesOrderItemId,
          productId: request.productId,
          variantId: request.variantId,
          batchNumber: request.batchNumber,
          reservedQuantity: request.quantity,
          availableQuantity: checkResult.availableQuantity,
          reservationStatus: 'ACTIVE',
          expiresAt,
          reservedBy: request.reservedBy,
        },
      });

      return reservation as InventoryReservation;
    });
  }

  /**
   * 释放库存预留
   */
  public async releaseReservation(
    reservationId: string,
    releasedBy: string,
    reason?: string
  ): Promise<void> {
    return prisma.$transaction(async tx => {
      const reservation = await tx.inventoryReservation.findUnique({
        where: { id: reservationId },
      });

      if (!reservation) {
        throw new Error('预留记录不存在');
      }

      if (reservation.reservationStatus !== 'ACTIVE') {
        throw new Error('预留记录状态不正确，无法释放');
      }

      // 更新库存预留量
      await tx.inventory.updateMany({
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

      // 更新预留记录状态
      await tx.inventoryReservation.update({
        where: { id: reservationId },
        data: {
          reservationStatus: 'RELEASED',
          releasedBy,
          releasedAt: new Date(),
          releaseReason: reason,
        },
      });
    });
  }

  /**
   * 检查安全库存预警
   */
  public async checkSafetyStockAlerts(): Promise<
    Array<{
      productId: string;
      variantId?: string;
      currentStock: number;
      safetyStock: number;
      alertLevel: 'WARNING' | 'CRITICAL';
      message: string;
    }>
  > {
    const safetyStockConfigs = await prisma.inventorySafetyStock.findMany({
      where: { alertEnabled: true },
    });

    const alerts = [];

    for (const config of safetyStockConfigs) {
      const inventory = await prisma.inventory.findFirst({
        where: {
          productId: config.productId,
          variantId: config.variantId,
        },
      });

      if (inventory) {
        const availableStock = inventory.quantity - inventory.reservedQuantity;
        const alertThreshold = config.safetyStock * config.alertThreshold;

        if (availableStock <= config.safetyStock) {
          alerts.push({
            productId: config.productId,
            variantId: config.variantId ?? undefined,
            currentStock: availableStock,
            safetyStock: config.safetyStock,
            alertLevel:
              availableStock <= alertThreshold ? 'CRITICAL' : 'WARNING',
            message: `库存低于安全库存线，当前库存: ${availableStock}，安全库存: ${config.safetyStock}`,
          });
        }
      }
    }

    return alerts;
  }

  /**
   * 生成预留编号
   */
  private async generateReservationNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = await prisma.orderSequence.upsert({
      where: {
        sequenceType_dateKey: {
          sequenceType: 'RESERVATION',
          dateKey: today,
        },
      },
      update: {
        currentSequence: { increment: 1 },
      },
      create: {
        sequenceType: 'RESERVATION',
        dateKey: today,
        currentSequence: 1,
      },
    });

    return `RSV${today}${sequence.currentSequence.toString().padStart(4, '0')}`;
  }
}
