// 单个入库记录API路由
// 提供单个入库记录的查询、更新、删除操作

import { type NextRequest, NextResponse } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthUser } from '@/lib/auth/context';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { prisma } from '@/lib/db';
import { RateLimitType, withRateLimit } from '@/lib/rate-limit';
import { toNumber } from '@/lib/utils/number';
import {
  cleanRemarks,
  formatQuantity,
  inboundIdSchema,
  updateInboundSchema,
} from '@/lib/validations/inbound';

// GET /api/inventory/inbound/[id] - 获取单个入库记录
const getInboundRecordHandler = withAuth(
  async (
    request: NextRequest,
    context: {
      user: AuthUser;
      params?: Promise<Record<string, string>> | Record<string, string>;
    }
  ) =>
    withErrorHandling(async (_req, ctx) => {
      const { id } = await resolveParams(ctx.params);

      // 验证参数
      const validatedId = inboundIdSchema.parse({ id });

      // 查询入库记录
      const record = await prisma.inboundRecord.findUnique({
        where: { id: validatedId.id },
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              specification: true,
              unit: true,
              status: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
      });

      if (!record) {
        return NextResponse.json(
          { success: false, error: '入库记录不存在' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          id: record.id,
          recordNumber: record.recordNumber,
          productId: record.productId,
          quantity: record.quantity,
          reason: record.reason,
          remarks: record.remarks || undefined,
          userId: record.userId,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
          product: record.product,
          user: record.user,
        },
      });
    })(request, context),
  { permissions: ['inventory:view'] }
);

export const GET = withRateLimit(RateLimitType.READ)(getInboundRecordHandler);

// PUT /api/inventory/inbound/[id] - 更新入库记录
const putInboundRecordHandler = withAuth(
  async (
    request: NextRequest,
    context: {
      user: AuthUser;
      params?: Promise<Record<string, string>> | Record<string, string>;
    }
  ) =>
    withErrorHandling(async (_req, ctx) => {
      const { id } = await resolveParams(ctx.params);
      const validatedId = inboundIdSchema.parse({ id });
      const recordId = validatedId.id;

      const body = await request.json();
      const validatedData = updateInboundSchema.parse(body);

      const include = {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            specification: true,
            unit: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      } as const;

      const existingRecord = await prisma.inboundRecord.findUnique({
        where: { id: recordId },
        select: {
          id: true,
          quantity: true,
          unitCost: true,
          totalCost: true,
          productId: true,
          variantId: true,
          batchNumber: true,
        },
      });

      if (!existingRecord) {
        return NextResponse.json(
          { success: false, error: '入库记录不存在' },
          { status: 404 }
        );
      }

      if (!Number.isInteger(existingRecord.quantity)) {
        return NextResponse.json(
          {
            success: false,
            error:
              '该入库记录数量包含小数，无法按“片”库存自动回滚/调整，请联系管理员修复历史数据',
          },
          { status: 400 }
        );
      }

      let updatedRecord;

      try {
        updatedRecord = await prisma.$transaction(async tx => {
          const updateData: Record<string, unknown> = {};

          if (validatedData.reason !== undefined) {
            updateData.reason = validatedData.reason;
          }
          if (validatedData.remarks !== undefined) {
            updateData.remarks = cleanRemarks(validatedData.remarks);
          }

          if (
            validatedData.quantity !== undefined &&
            validatedData.quantity !== existingRecord.quantity
          ) {
            const newQuantity = formatQuantity(validatedData.quantity);
            if (!Number.isInteger(newQuantity)) {
              throw ApiError.badRequest('数量必须是整数（片）');
            }

            const quantityDiff = newQuantity - existingRecord.quantity;

            const inventories = await tx.inventory.findMany({
              where: {
                productId: existingRecord.productId,
                variantId: existingRecord.variantId,
                batchNumber: existingRecord.batchNumber,
              },
              select: { id: true, quantity: true, reservedQuantity: true },
              take: 2,
            });

            if (inventories.length === 0) {
              throw ApiError.badRequest(
                '未找到该入库记录对应的库存记录，无法更新'
              );
            }

            if (inventories.length > 1) {
              throw ApiError.badRequest(
                '发现重复库存记录，无法自动更新，请先合并/清理重复数据'
              );
            }

            const inventory = inventories[0];

            const costEntries = await tx.inventoryCostQueue.findMany({
              where: { inboundRecordId: existingRecord.id },
              select: { id: true, remainingQty: true },
              take: 2,
            });

            if (costEntries.length > 1) {
              throw ApiError.badRequest(
                '该入库记录对应多条 FIFO 队列记录，无法自动更新，请联系管理员处理'
              );
            }

            const costEntry = costEntries[0] ?? null;

            if (costEntry) {
              const consumedQty =
                existingRecord.quantity - costEntry.remainingQty;

              if (consumedQty < 0) {
                throw ApiError.badRequest(
                  'FIFO 队列数据异常：remainingQty 大于入库数量'
                );
              }

              if (newQuantity < consumedQty) {
                throw ApiError.badRequest(
                  `该入库记录已被出库消耗 ${consumedQty} 片，数量不能小于已消耗数量`
                );
              }

              const newRemainingQty = newQuantity - consumedQty;

              await tx.inventoryCostQueue.update({
                where: { id: costEntry.id },
                data: { remainingQty: newRemainingQty },
              });
            } else if (quantityDiff > 0) {
              // 历史记录未写入 FIFO 队列，允许减少/纠错，但禁止增加数量以免账实不符
              throw ApiError.badRequest(
                '该入库记录未写入 FIFO 队列，无法增加数量；如需补齐 FIFO 请使用专用修复脚本'
              );
            }

            if (quantityDiff > 0) {
              await tx.inventory.update({
                where: { id: inventory.id },
                data: {
                  quantity: { increment: quantityDiff },
                  updatedAt: new Date(),
                },
              });
            } else {
              const decrementQty = Math.abs(quantityDiff);
              const availableQty =
                inventory.quantity - inventory.reservedQuantity;

              if (availableQty < decrementQty) {
                throw ApiError.badRequest(
                  `扣减后可用库存不足：当前可用 ${availableQty} 片，需要扣减 ${decrementQty} 片`
                );
              }

              await tx.inventory.update({
                where: { id: inventory.id },
                data: {
                  quantity: { decrement: decrementQty },
                  updatedAt: new Date(),
                },
              });
            }

            updateData.quantity = newQuantity;
            const unitCost = toNumber(existingRecord.unitCost, Number.NaN);
            if (Number.isFinite(unitCost)) {
              updateData.totalCost =
                Math.round(newQuantity * unitCost * 100) / 100;
            }
          }

          return await tx.inboundRecord.update({
            where: { id: recordId },
            data: updateData,
            include,
          });
        });
      } catch (error) {
        if (error instanceof ApiError) {
          return NextResponse.json(
            { success: false, error: error.message },
            { status: error.statusCode }
          );
        }
        throw error;
      }

      await invalidateInventoryCache(existingRecord.productId);

      return NextResponse.json({
        success: true,
        data: {
          id: updatedRecord.id,
          recordNumber: updatedRecord.recordNumber,
          productId: updatedRecord.productId,
          quantity: updatedRecord.quantity,
          reason: updatedRecord.reason,
          remarks: updatedRecord.remarks || undefined,
          userId: updatedRecord.userId,
          createdAt: updatedRecord.createdAt.toISOString(),
          updatedAt: updatedRecord.updatedAt.toISOString(),
          product: updatedRecord.product,
          user: updatedRecord.user,
        },
        message: '更新成功',
      });
    })(request, context),
  { permissions: ['inventory:adjust'] }
);

export const PUT = withRateLimit(RateLimitType.WRITE)(putInboundRecordHandler);

// DELETE /api/inventory/inbound/[id] - 删除入库记录
const deleteInboundRecordHandler = withAuth(
  async (
    request: NextRequest,
    context: {
      user: AuthUser;
      params?: Promise<Record<string, string>> | Record<string, string>;
    }
  ) =>
    withErrorHandling(async (_req, ctx) => {
      const { id } = await resolveParams(ctx.params);
      const validatedId = inboundIdSchema.parse({ id });
      const recordId = validatedId.id;

      const record = await prisma.inboundRecord.findUnique({
        where: { id: recordId },
        select: {
          id: true,
          quantity: true,
          productId: true,
          variantId: true,
          batchNumber: true,
        },
      });

      if (!record) {
        return NextResponse.json(
          { success: false, error: '入库记录不存在' },
          { status: 404 }
        );
      }

      if (!Number.isInteger(record.quantity)) {
        return NextResponse.json(
          {
            success: false,
            error:
              '该入库记录数量包含小数，无法按“片”库存自动回滚/删除，请联系管理员修复历史数据',
          },
          { status: 400 }
        );
      }

      try {
        await prisma.$transaction(async tx => {
          const inventories = await tx.inventory.findMany({
            where: {
              productId: record.productId,
              variantId: record.variantId,
              batchNumber: record.batchNumber,
            },
            select: { id: true, quantity: true, reservedQuantity: true },
            take: 2,
          });

          if (inventories.length === 0) {
            throw ApiError.badRequest(
              '未找到该入库记录对应的库存记录，无法删除'
            );
          }

          if (inventories.length > 1) {
            throw ApiError.badRequest(
              '发现重复库存记录，无法自动删除，请先合并/清理重复数据'
            );
          }

          const inventory = inventories[0];
          const decrementQty = record.quantity;
          const availableQty = inventory.quantity - inventory.reservedQuantity;

          if (availableQty < decrementQty) {
            throw ApiError.badRequest(
              `扣减后可用库存不足：当前可用 ${availableQty} 片，需要扣减 ${decrementQty} 片`
            );
          }

          const costEntries = await tx.inventoryCostQueue.findMany({
            where: { inboundRecordId: record.id },
            select: { id: true, remainingQty: true },
            take: 2,
          });

          if (costEntries.length > 1) {
            throw ApiError.badRequest(
              '该入库记录对应多条 FIFO 队列记录，无法自动删除，请联系管理员处理'
            );
          }

          const costEntry = costEntries[0] ?? null;
          if (costEntry) {
            const consumedQty = record.quantity - costEntry.remainingQty;

            if (consumedQty < 0) {
              throw ApiError.badRequest(
                'FIFO 队列数据异常：remainingQty 大于入库数量'
              );
            }

            if (consumedQty > 0) {
              throw ApiError.badRequest(
                `该入库记录已被出库消耗 ${consumedQty} 片，无法删除；如需纠正请使用“库存调整”`
              );
            }

            // 外键 onDelete: Restrict，需要先删除 FIFO 队列记录
            await tx.inventoryCostQueue.delete({
              where: { id: costEntry.id },
            });
          }

          await tx.inboundRecord.delete({
            where: { id: recordId },
          });

          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: { decrement: decrementQty },
              updatedAt: new Date(),
            },
          });
        });
      } catch (error) {
        if (error instanceof ApiError) {
          return NextResponse.json(
            { success: false, error: error.message },
            { status: error.statusCode }
          );
        }
        throw error;
      }

      await invalidateInventoryCache(record.productId);

      return NextResponse.json({
        success: true,
        message: '删除成功',
      });
    })(request, context),
  { permissions: ['inventory:adjust'] }
);

export const DELETE = withRateLimit(RateLimitType.WRITE)(
  deleteInboundRecordHandler
);
