// 单个应付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { PayableRecordDetail } from '@/lib/types/payable';
import { updatePayableRecordSchema } from '@/lib/validations/payable';

/**
 * GET /api/finance/payables/[id] - 获取单个应付款记录详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 查询应付款记录
    const payable = await prisma.payableRecord.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        paymentOutRecords: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            paymentDate: 'desc',
          },
        },
      },
    });

    if (!payable) {
      return NextResponse.json(
        { success: false, error: '应付款记录不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: payable as PayableRecordDetail,
    });
  } catch (error) {
    console.error('获取应付款记录详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取应付款记录详情失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/finance/payables/[id] - 更新应付款记录
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 解析请求体
    const body = await request.json();
    const validationResult = updatePayableRecordSchema.safeParse({
      ...body,
      id,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '数据验证失败',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { id: _, ...updateData } = validationResult.data;

    // 检查应付款记录是否存在
    const existingPayable = await prisma.payableRecord.findUnique({
      where: { id },
      select: {
        id: true,
        payableAmount: true,
        paidAmount: true,
        status: true,
      },
    });

    if (!existingPayable) {
      return NextResponse.json(
        { success: false, error: '应付款记录不存在' },
        { status: 404 }
      );
    }

    // 如果更新应付金额，需要重新计算剩余金额
    let remainingAmount =
      existingPayable.payableAmount - existingPayable.paidAmount;
    if (updateData.payableAmount !== undefined) {
      remainingAmount = updateData.payableAmount - existingPayable.paidAmount;

      // 检查应付金额不能小于已付金额
      if (updateData.payableAmount < existingPayable.paidAmount) {
        return NextResponse.json(
          { success: false, error: '应付金额不能小于已付金额' },
          { status: 400 }
        );
      }
    }

    // 更新应付款记录
    const updatedPayable = await prisma.payableRecord.update({
      where: { id },
      data: {
        ...updateData,
        ...(updateData.payableAmount !== undefined && { remainingAmount }),
        ...(updateData.dueDate && { dueDate: new Date(updateData.dueDate) }),
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        paymentOutRecords: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            paymentDate: 'desc',
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedPayable as PayableRecordDetail,
      message: '应付款记录更新成功',
    });
  } catch (error) {
    console.error('更新应付款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '更新应付款记录失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/finance/payables/[id] - 删除应付款记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 检查应付款记录是否存在
    const existingPayable = await prisma.payableRecord.findUnique({
      where: { id },
      select: {
        id: true,
        paidAmount: true,
        paymentOutRecords: {
          select: { id: true },
        },
      },
    });

    if (!existingPayable) {
      return NextResponse.json(
        { success: false, error: '应付款记录不存在' },
        { status: 404 }
      );
    }

    // 检查是否已有付款记录
    if (
      existingPayable.paidAmount > 0 ||
      existingPayable.paymentOutRecords.length > 0
    ) {
      return NextResponse.json(
        { success: false, error: '已有付款记录的应付款不能删除' },
        { status: 400 }
      );
    }

    // 删除应付款记录
    await prisma.payableRecord.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '应付款记录删除成功',
    });
  } catch (error) {
    console.error('删除应付款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '删除应付款记录失败' },
      { status: 500 }
    );
  }
}
