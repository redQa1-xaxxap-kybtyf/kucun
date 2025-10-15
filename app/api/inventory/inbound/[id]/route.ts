// 单个入库记录API路由
// 提供单个入库记录的查询、更新、删除操作

import { type NextRequest, NextResponse } from 'next/server';

import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthUser } from '@/lib/auth/context';
import { prisma } from '@/lib/db';
import {
  cleanRemarks,
  formatQuantity,
  inboundIdSchema,
  updateInboundSchema,
} from '@/lib/validations/inbound';

// GET /api/inventory/inbound/[id] - 获取单个入库记录
export const GET = withAuth(
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

// PUT /api/inventory/inbound/[id] - 更新入库记录
export const PUT = withAuth(
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

      const existingRecord = await prisma.inboundRecord.findUnique({
        where: { id: recordId },
        select: {
          id: true,
          quantity: true,
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

      const updateData: Record<string, unknown> = {};
      if (validatedData.quantity !== undefined) {
        updateData.quantity = formatQuantity(validatedData.quantity);
      }
      if (validatedData.reason !== undefined) {
        updateData.reason = validatedData.reason;
      }
      if (validatedData.remarks !== undefined) {
        updateData.remarks = cleanRemarks(validatedData.remarks);
      }

      const updatedRecord = await prisma.inboundRecord.update({
        where: { id: recordId },
        data: updateData,
        include: {
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
        },
      });

      if (
        validatedData.quantity !== undefined &&
        validatedData.quantity !== existingRecord.quantity
      ) {
        const quantityDiff =
          formatQuantity(validatedData.quantity) - existingRecord.quantity;

        await prisma.inventory.upsert({
          where: {
            productId_variantId_batchNumber: {
              productId: existingRecord.productId,
              variantId: existingRecord.variantId ?? '',
              batchNumber: existingRecord.batchNumber ?? '',
            },
          },
          update: {
            quantity: {
              increment: quantityDiff,
            },
          },
          create: {
            productId: existingRecord.productId,
            variantId: existingRecord.variantId,
            batchNumber: existingRecord.batchNumber,
            quantity: Math.max(0, quantityDiff),
          },
        });
      }

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

// DELETE /api/inventory/inbound/[id] - 删除入库记录
export const DELETE = withAuth(
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
        select: { id: true, quantity: true, productId: true },
      });

      if (!record) {
        return NextResponse.json(
          { success: false, error: '入库记录不存在' },
          { status: 404 }
        );
      }

      await prisma.inboundRecord.delete({
        where: { id: recordId },
      });

      await prisma.inventory.updateMany({
        where: {
          productId: record.productId,
          variantId: undefined,
          batchNumber: undefined,
        },
        data: {
          quantity: {
            decrement: record.quantity,
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: '删除成功',
      });
    })(request, context),
  { permissions: ['inventory:adjust'] }
);
