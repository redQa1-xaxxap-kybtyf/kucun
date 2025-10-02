import { getServerSession } from 'next-auth';
import { type NextRequest, NextResponse } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { UpdateSupplierSchema } from '@/lib/schemas/supplier';
import type { Supplier } from '@/lib/types/supplier';

/**
 * GET /api/suppliers/[id] - 获取单个供应商详情
 */
export const GET = withErrorHandling(
  async (
    _request: NextRequest,
    context: { params?: Promise<{ id: string }> | { id: string } }
  ) => {
    // 验证用户身份 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session) {
        throw ApiError.unauthorized();
      }
    }

    const { id } = await resolveParams(context.params);

    // 查询供应商
    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw ApiError.notFound('供应商');
    }

    // 转换数据格式
    const transformedSupplier: Supplier = {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone || undefined,
      address: supplier.address || undefined,
      status: supplier.status as 'active' | 'inactive',
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: transformedSupplier,
    });
  }
);

/**
 * PUT /api/suppliers/[id] - 更新供应商信息
 */
export const PUT = withErrorHandling(
  async (
    request: NextRequest,
    context: { params?: Promise<{ id: string }> | { id: string } }
  ) => {
    // 验证用户身份 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session) {
        throw ApiError.unauthorized();
      }
    }

    const { id } = await resolveParams(context.params);

    // 检查供应商是否存在
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
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
      });

      if (duplicateSupplier) {
        throw ApiError.badRequest('供应商名称已存在');
      }
    }

    // 更新供应商
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
    });

    // 转换数据格式
    const transformedSupplier: Supplier = {
      id: updatedSupplier.id,
      name: updatedSupplier.name,
      phone: updatedSupplier.phone || undefined,
      address: updatedSupplier.address || undefined,
      status: updatedSupplier.status as 'active' | 'inactive',
      createdAt: updatedSupplier.createdAt.toISOString(),
      updatedAt: updatedSupplier.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: transformedSupplier,
      message: '供应商更新成功',
    });
  }
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
export const DELETE = withErrorHandling(
  async (
    _request: NextRequest,
    context: { params?: Promise<{ id: string }> | { id: string } }
  ) => {
    // 验证用户身份 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session) {
        throw ApiError.unauthorized();
      }
    }

    const { id } = await resolveParams(context.params);

    // 检查供应商是否存在
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
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
);
