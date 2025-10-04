import { type NextRequest, NextResponse } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { UpdateSupplierSchema } from '@/lib/validations/supplier';

/**
 * GET /api/suppliers/[id] - 获取单个供应商详情
 */
export const GET = withAuth(
  withErrorHandling(
    async (
      request: NextRequest,
      context: {
        params?: Promise<Record<string, string>> | Record<string, string>;
      }
    ) => {
      const { id } = await resolveParams(context.params);

      // 查询供应商 - 使用 select 明确指定返回字段
      const supplier = await prisma.supplier.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!supplier) {
        throw ApiError.notFound('供应商');
      }

      // 直接返回，无需二次映射
      return NextResponse.json({
        success: true,
        data: supplier,
      });
    }
  ),
  { permissions: ['suppliers:view'] }
);

/**
 * PUT /api/suppliers/[id] - 更新供应商信息
 */
export const PUT = withAuth(
  withErrorHandling(
    async (
      request: NextRequest,
      context: {
        params?: Promise<Record<string, string>> | Record<string, string>;
      }
    ) => {
      const { id } = await resolveParams(context.params);

      // 检查供应商是否存在 - 只需要 id 和 name 字段
      const existingSupplier = await prisma.supplier.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
        },
      });

      if (!existingSupplier) {
        throw ApiError.notFound('供应商');
      }

      // 解析请求体
      const body = await request.json();
      const validatedData = UpdateSupplierSchema.parse(body);

      // 如果更新名称，检查是否与其他供应商重复
      if (validatedData.name && validatedData.name !== existingSupplier.name) {
        const duplicateSupplier = await prisma.supplier.findFirst({
          where: {
            name: validatedData.name,
            id: { not: id },
          },
          select: {
            id: true,
          },
        });

        if (duplicateSupplier) {
          throw ApiError.badRequest('供应商名称已存在');
        }
      }

      // 更新供应商 - 使用 select 指定返回字段
      const updatedSupplier = await prisma.supplier.update({
        where: { id },
        data: {
          ...(validatedData.name && { name: validatedData.name }),
          ...(validatedData.phone !== undefined && {
            phone: validatedData.phone || null,
          }),
          ...(validatedData.address !== undefined && {
            address: validatedData.address || null,
          }),
          ...(validatedData.status && { status: validatedData.status }),
        },
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // 直接返回，无需二次映射
      return NextResponse.json({
        success: true,
        data: updatedSupplier,
        message: '供应商更新成功',
      });
    }
  ),
  { permissions: ['suppliers:edit'] }
);

/**
 * 检查供应商关联数据
 * @param supplierId 供应商ID
 * @throws ApiError 如果有关联数据
 */
async function checkSupplierRelations(supplierId: string): Promise<void> {
  // 检查是否有关联的销售订单(调货销售)
  const salesOrderCount = await prisma.salesOrder.count({
    where: { supplierId },
  });

  if (salesOrderCount > 0) {
    throw ApiError.badRequest(
      `无法删除供应商,该供应商有 ${salesOrderCount} 个关联的销售订单`
    );
  }

  // 检查是否有关联的厂家发货订单明细
  const factoryShipmentItemCount = await prisma.factoryShipmentOrderItem.count({
    where: { supplierId },
  });

  if (factoryShipmentItemCount > 0) {
    throw ApiError.badRequest(
      `无法删除供应商,该供应商有 ${factoryShipmentItemCount} 个关联的厂家发货订单明细`
    );
  }

  // 检查是否有关联的应付款记录
  const payableCount = await prisma.payableRecord.count({
    where: { supplierId },
  });

  if (payableCount > 0) {
    throw ApiError.badRequest(
      `无法删除供应商,该供应商有 ${payableCount} 个关联的应付款记录`
    );
  }

  // 检查是否有关联的付款记录
  const paymentOutCount = await prisma.paymentOutRecord.count({
    where: { supplierId },
  });

  if (paymentOutCount > 0) {
    throw ApiError.badRequest(
      `无法删除供应商,该供应商有 ${paymentOutCount} 个关联的付款记录`
    );
  }
}

/**
 * DELETE /api/suppliers/[id] - 删除供应商
 */
export const DELETE = withAuth(
  withErrorHandling(
    async (
      request: NextRequest,
      context: {
        params?: Promise<Record<string, string>> | Record<string, string>;
      }
    ) => {
      const { id } = await resolveParams(context.params);

      // 检查供应商是否存在 - 只需要 id 字段
      const existingSupplier = await prisma.supplier.findUnique({
        where: { id },
        select: {
          id: true,
        },
      });

      if (!existingSupplier) {
        throw ApiError.notFound('供应商');
      }

      // 检查关联数据
      await checkSupplierRelations(id);

      // 所有检查通过,可以安全删除
      await prisma.supplier.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: '供应商删除成功',
      });
    }
  ),
  { permissions: ['suppliers:delete'] }
);
