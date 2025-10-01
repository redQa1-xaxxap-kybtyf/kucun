import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { UpdateSupplierSchema } from '@/lib/schemas/supplier';
import type { Supplier } from '@/lib/types/supplier';

/**
 * GET /api/suppliers/[id] - 获取单个供应商详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户身份 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    const { id } = params;

    // 查询供应商
    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: '供应商不存在' },
        { status: 404 }
      );
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
  } catch (error) {
    console.error('获取供应商详情失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取供应商详情失败',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/suppliers/[id] - 更新供应商信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户身份 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    const { id } = params;

    // 检查供应商是否存在
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      return NextResponse.json(
        { success: false, error: '供应商不存在' },
        { status: 404 }
      );
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
        return NextResponse.json(
          { success: false, error: '供应商名称已存在' },
          { status: 400 }
        );
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
  } catch (error) {
    console.error('更新供应商失败:', error);

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { success: false, error: '供应商名称已存在' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新供应商失败',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/suppliers/[id] - 删除供应商
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户身份 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    const { id } = params;

    // 检查供应商是否存在
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      return NextResponse.json(
        { success: false, error: '供应商不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联的销售订单(调货销售)
    const salesOrderCount = await prisma.salesOrder.count({
      where: { supplierId: id },
    });

    if (salesOrderCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `无法删除供应商,该供应商有 ${salesOrderCount} 个关联的销售订单`,
        },
        { status: 400 }
      );
    }

    // 检查是否有关联的厂家发货订单明细
    const factoryShipmentItemCount =
      await prisma.factoryShipmentOrderItem.count({
        where: { supplierId: id },
      });

    if (factoryShipmentItemCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `无法删除供应商,该供应商有 ${factoryShipmentItemCount} 个关联的厂家发货订单明细`,
        },
        { status: 400 }
      );
    }

    // 检查是否有关联的应付款记录
    const payableCount = await prisma.payableRecord.count({
      where: { supplierId: id },
    });

    if (payableCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `无法删除供应商,该供应商有 ${payableCount} 个关联的应付款记录`,
        },
        { status: 400 }
      );
    }

    // 检查是否有关联的付款记录
    const paymentOutCount = await prisma.paymentOutRecord.count({
      where: { supplierId: id },
    });

    if (paymentOutCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `无法删除供应商,该供应商有 ${paymentOutCount} 个关联的付款记录`,
        },
        { status: 400 }
      );
    }

    // 所有检查通过,可以安全删除
    await prisma.supplier.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '供应商删除成功',
    });
  } catch (error) {
    console.error('删除供应商失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除供应商失败',
      },
      { status: 500 }
    );
  }
}
