// 单个入库记录API路由
// 提供单个入库记录的查询、更新、删除操作

import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  cleanRemarks,
  formatQuantity,
  inboundIdSchema,
  updateInboundSchema,
} from '@/lib/validations/inbound';

// GET /api/inventory/inbound/[id] - 获取单个入库记录
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

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
  } catch (error) {
    console.error('获取入库记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取入库记录失败' },
      { status: 500 }
    );
  }
}

// PUT /api/inventory/inbound/[id] - 更新入库记录
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 验证参数
    const validatedId = inboundIdSchema.parse({ id });
    const recordId = validatedId.id;

    // 解析请求数据
    const body = await request.json();
    const validatedData = updateInboundSchema.parse(body);

    // 检查记录是否存在
    const existingRecord = await prisma.inboundRecord.findUnique({
      where: { id: recordId },
      select: { id: true, quantity: true, productId: true },
    });

    if (!existingRecord) {
      return NextResponse.json(
        { success: false, error: '入库记录不存在' },
        { status: 404 }
      );
    }

    // 准备更新数据
    const updateData: any = {};

    if (validatedData.quantity !== undefined) {
      updateData.quantity = formatQuantity(validatedData.quantity);
    }

    if (validatedData.reason !== undefined) {
      updateData.reason = validatedData.reason;
    }

    if (validatedData.remarks !== undefined) {
      updateData.remarks = cleanRemarks(validatedData.remarks);
    }

    // 更新入库记录
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

    // 如果数量发生变化，需要更新库存
    if (
      validatedData.quantity !== undefined &&
      validatedData.quantity !== existingRecord.quantity
    ) {
      const quantityDiff =
        formatQuantity(validatedData.quantity) - existingRecord.quantity;

      await prisma.inventory.upsert({
        where: {
          productId_variantId_colorCode_productionDate: {
            productId: existingRecord.productId,
            variantId: null,
            colorCode: null,
            productionDate: null,
          },
        },
        update: {
          quantity: {
            increment: quantityDiff,
          },
        },
        create: {
          productId: existingRecord.productId,
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
  } catch (error) {
    console.error('更新入库记录失败:', error);
    return NextResponse.json(
      { success: false, error: '更新入库记录失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory/inbound/[id] - 删除入库记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 验证参数
    const validatedId = inboundIdSchema.parse({ id });
    const recordId = validatedId.id;

    // 查询要删除的记录
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

    // 删除入库记录
    await prisma.inboundRecord.delete({
      where: { id: recordId },
    });

    // 从库存中减去相应数量
    await prisma.inventory.updateMany({
      where: {
        productId: record.productId,
        variantId: null,
        colorCode: null,
        productionDate: null,
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
  } catch (error) {
    console.error('删除入库记录失败:', error);
    return NextResponse.json(
      { success: false, error: '删除入库记录失败' },
      { status: 500 }
    );
  }
}
