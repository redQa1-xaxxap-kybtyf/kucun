import { NextResponse, type NextRequest } from 'next/server';

import { logger } from '@/lib/logger';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { productVariantUpdateSchema } from '@/lib/validations/product';

// 获取单个产品变体详情
export const GET = withAuth(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const { id } = params;
    try {
      // 验证ID格式
      if (!id || typeof id !== 'string') {
        return NextResponse.json(
          { success: false, error: '变体ID格式不正确' },
          { status: 400 }
        );
      }

      // 查询产品变体详情
      const variant = await prisma.productVariant.findUnique({
        where: { id },
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              specification: true,
              unit: true,
              piecesPerUnit: true,
              status: true,
            },
          },
          inventory: {
            select: {
              id: true,
              quantity: true,
              reservedQuantity: true,
              batchNumber: true,
              location: true,
              unitCost: true,
              updatedAt: true,
            },
            orderBy: {
              updatedAt: 'desc',
            },
          },
        },
      });

      if (!variant) {
        return NextResponse.json(
          { success: false, error: '产品变体不存在' },
          { status: 404 }
        );
      }

      // 计算库存汇总
      const totalInventory = variant.inventory.reduce(
        (sum: number, inv) => sum + inv.quantity,
        0
      );
      const reservedInventory = variant.inventory.reduce(
        (sum: number, inv) => sum + inv.reservedQuantity,
        0
      );

      // 转换数据格式
      const formattedVariant = {
        id: variant.id,
        productId: variant.productId,
        colorCode: variant.colorCode,
        colorName: variant.colorName,
        colorValue: variant.colorValue,
        sku: variant.sku,
        status: variant.status,
        createdAt: variant.createdAt,
        updatedAt: variant.updatedAt,
        product: variant.product,
        totalInventory,
        reservedInventory,
        availableInventory: totalInventory - reservedInventory,
        inventory: variant.inventory.map(inv => ({
          id: inv.id,
          quantity: inv.quantity,
          reservedQuantity: inv.reservedQuantity,
          availableQuantity: inv.quantity - inv.reservedQuantity,
          batchNumber: inv.batchNumber,
          location: inv.location,
          unitCost: inv.unitCost,
          updatedAt: inv.updatedAt,
        })),
      };

      return NextResponse.json({
        success: true,
        data: formattedVariant,
      });
    } catch (error) {
      logger.error('product-variants', '获取产品变体详情失败', error, { variantId: id });

      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : '获取产品变体详情失败',
        },
        { status: 500 }
      );
    }
  }
);

// 更新产品变体
export const PUT = withAuth(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const { id } = params;
    try {
      const body = await request.json();

      // 验证ID格式
      if (!id || typeof id !== 'string') {
        return NextResponse.json(
          { success: false, error: '变体ID格式不正确' },
          { status: 400 }
        );
      }

      // 验证输入数据
      const validationResult = productVariantUpdateSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: '输入数据格式不正确',
            details: validationResult.error.issues,
          },
          { status: 400 }
        );
      }

      const updateData = validationResult.data;

      // 检查变体是否存在
      const existingVariant = await prisma.productVariant.findUnique({
        where: { id },
        include: {
          product: {
            select: { id: true, code: true },
          },
        },
      });

      if (!existingVariant) {
        return NextResponse.json(
          { success: false, error: '产品变体不存在' },
          { status: 404 }
        );
      }

      // 如果更新色号，检查同一产品下是否已存在该色号
      if (
        updateData.colorCode &&
        updateData.colorCode !== existingVariant.colorCode
      ) {
        const duplicateVariant = await prisma.productVariant.findFirst({
          where: {
            productId: existingVariant.productId,
            colorCode: updateData.colorCode,
            id: { not: id },
          },
        });

        if (duplicateVariant) {
          return NextResponse.json(
            { success: false, error: '该产品的此色号变体已存在' },
            { status: 409 }
          );
        }
      }

      // 如果更新SKU，检查是否已存在
      if (updateData.sku && updateData.sku !== existingVariant.sku) {
        const duplicateSku = await prisma.productVariant.findUnique({
          where: { sku: updateData.sku },
        });

        if (duplicateSku) {
          return NextResponse.json(
            { success: false, error: 'SKU已存在，请使用其他SKU' },
            { status: 409 }
          );
        }
      }

      // 更新产品变体
      const updatedVariant = await prisma.productVariant.update({
        where: { id },
        data: updateData,
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
              status: true,
            },
          },
          inventory: {
            select: {
              quantity: true,
              reservedQuantity: true,
            },
          },
        },
      });

      // 计算库存汇总
      const totalInventory = updatedVariant.inventory.reduce(
        (sum, inv) => sum + inv.quantity,
        0
      );
      const reservedInventory = updatedVariant.inventory.reduce(
        (sum, inv) => sum + inv.reservedQuantity,
        0
      );

      // 转换数据格式
      const formattedVariant = {
        id: updatedVariant.id,
        productId: updatedVariant.productId,
        colorCode: updatedVariant.colorCode,
        colorName: updatedVariant.colorName,
        colorValue: updatedVariant.colorValue,
        sku: updatedVariant.sku,
        status: updatedVariant.status,
        createdAt: updatedVariant.createdAt,
        updatedAt: updatedVariant.updatedAt,
        product: updatedVariant.product,
        totalInventory,
        reservedInventory,
        availableInventory: totalInventory - reservedInventory,
      };

      return NextResponse.json({
        success: true,
        data: formattedVariant,
      });
    } catch (error) {
      logger.error('product-variants', '更新产品变体失败', error, { variantId: id });

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '更新产品变体失败',
        },
        { status: 500 }
      );
    }
  }
);

// 删除产品变体
export const DELETE = withAuth(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const { id } = params;
    try {
      // 验证ID格式
      if (!id || typeof id !== 'string') {
        return NextResponse.json(
          { success: false, error: '变体ID格式不正确' },
          { status: 400 }
        );
      }

      // 检查变体是否存在
      const existingVariant = await prisma.productVariant.findUnique({
        where: { id },
        include: {
          inventory: {
            select: { id: true, quantity: true },
          },
        },
      });

      if (!existingVariant) {
        return NextResponse.json(
          { success: false, error: '产品变体不存在' },
          { status: 404 }
        );
      }

      // 检查是否有库存记录
      const hasInventory = existingVariant.inventory.some(
        inv => inv.quantity > 0
      );
      if (hasInventory) {
        return NextResponse.json(
          { success: false, error: '该变体仍有库存，无法删除' },
          { status: 400 }
        );
      }

      // 使用事务删除变体及其相关数据
      await prisma.$transaction(async tx => {
        // 删除库存记录（如果有零库存记录）
        await tx.inventory.deleteMany({
          where: { variantId: id },
        });

        // 删除产品变体
        await tx.productVariant.delete({
          where: { id },
        });
      });

      return NextResponse.json({
        success: true,
        data: null,
      });
    } catch (error) {
      logger.error('product-variants', '删除产品变体失败', error, { variantId: id });

      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '删除产品变体失败',
        },
        { status: 500 }
      );
    }
  }
);
