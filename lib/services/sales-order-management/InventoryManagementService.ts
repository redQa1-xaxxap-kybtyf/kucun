// @ts-nocheck

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
  inventoryId?: string;
  inventoryUpdatedAt?: Date;
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
    request: InventoryCheckRequest,
    tx?: PrismaClient
  ): Promise<InventoryCheckResult> {
    try {
      const db = tx ?? prisma;
      const inventory = await db.inventory.findFirst({
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
        inventoryId: inventory.id,
        inventoryUpdatedAt: inventory.updatedAt,
        shortfall: available ? 0 : request.requiredQuantity - availableQuantity,
        message: available
          ? '库存充足'
          : `库存不足，缺少 ${request.requiredQuantity - availableQuantity} 片`,
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
      }, tx as unknown as PrismaClient);

      if (!checkResult.available) {
        throw new Error(`库存不足: ${checkResult.message}`);
      }

      if (!checkResult.inventoryId || !checkResult.inventoryUpdatedAt) {
        throw new Error('库存记录不存在');
      }

      // 更新库存预留量
      const inventoryUpdate = await tx.inventory.updateMany({
        where: {
          id: checkResult.inventoryId,
          updatedAt: checkResult.inventoryUpdatedAt,
          quantity: checkResult.totalQuantity,
          reservedQuantity: checkResult.reservedQuantity,
        },
        data: {
          reservedQuantity: {
            increment: request.quantity,
          },
        },
      });

      if (inventoryUpdate.count === 0) {
        throw new Error('库存预留失败，库存已被其他事务修改，请重试');
      }

      // 创建预留记录
      const expiresAt = request.expirationHours
        ? new Date(Date.now() + request.expirationHours * 60 * 60 * 1000)
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // 默认24小时

      const reservation = await tx.inventoryReservation.create({
        data: {
          reservationNumber: await this.generateReservationNumber(tx as any),
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

      const inventory = await tx.inventory.findFirst({
        where: {
          productId: reservation.productId,
          variantId: reservation.variantId,
          batchNumber: reservation.batchNumber,
        },
        select: {
          id: true,
          reservedQuantity: true,
          updatedAt: true,
        },
      });

      if (!inventory) {
        throw new Error('库存记录不存在');
      }

      if (inventory.reservedQuantity < reservation.reservedQuantity) {
        throw new Error('库存预留量不足，可能已被其他事务修改，请刷新后重试');
      }

      // 更新库存预留量
      const inventoryUpdate = await tx.inventory.updateMany({
        where: {
          id: inventory.id,
          updatedAt: inventory.updatedAt,
          reservedQuantity: inventory.reservedQuantity,
        },
        data: {
          reservedQuantity: {
            decrement: reservation.reservedQuantity,
          },
        },
      });

      if (inventoryUpdate.count === 0) {
        throw new Error('释放预留失败，库存已被其他事务修改，请重试');
      }

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
    const alerts = [];
    let cursor: string | undefined;
    const batchSize = 1000;

    while (true) {
      const safetyStockConfigs = await prisma.inventorySafetyStock.findMany({
        where: { alertEnabled: true },
        select: {
          id: true,
          productId: true,
          variantId: true,
          safetyStock: true,
          alertThreshold: true,
        },
        orderBy: {
          id: 'asc',
        },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (safetyStockConfigs.length === 0) {
        break;
      }

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

      cursor = safetyStockConfigs[safetyStockConfigs.length - 1].id;
    }

    return alerts;
  }

  /**
   * 生成预留编号
   */
  private async generateReservationNumber(tx: any): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const sequence = await tx.orderSequence.upsert({
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
