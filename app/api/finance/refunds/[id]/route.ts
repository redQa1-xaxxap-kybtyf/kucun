// 退款记录详情API
// 提供单个退款记录的查询、更新和删除功能

import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/finance/refunds/[id]
 * 获取退款记录详情
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { id } = params;

    // 查询退款记录详情
    const refund = await prisma.refundRecord.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!refund) {
      return NextResponse.json(
        { success: false, error: '退款记录不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: refund,
    });
  } catch (error) {
    console.error('获取退款记录详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取退款记录详情失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/finance/refunds/[id]
 * 更新退款记录
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();

    // 查询现有退款记录
    const existingRefund = await prisma.refundRecord.findUnique({
      where: { id },
    });

    if (!existingRefund) {
      return NextResponse.json(
        { success: false, error: '退款记录不存在' },
        { status: 404 }
      );
    }

    // 检查是否可以修改
    if (existingRefund.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: '只能修改待处理状态的退款记录' },
        { status: 400 }
      );
    }

    // 更新退款记录
    const updatedRefund = await prisma.refundRecord.update({
      where: { id },
      data: {
        ...body,
        updatedAt: new Date(),
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedRefund,
      message: '退款记录更新成功',
    });
  } catch (error) {
    console.error('更新退款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '更新退款记录失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/finance/refunds/[id]
 * 删除退款记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { id } = params;

    // 查询现有退款记录
    const existingRefund = await prisma.refundRecord.findUnique({
      where: { id },
    });

    if (!existingRefund) {
      return NextResponse.json(
        { success: false, error: '退款记录不存在' },
        { status: 404 }
      );
    }

    // 检查是否可以删除
    if (existingRefund.status === 'completed') {
      return NextResponse.json(
        { success: false, error: '已完成的退款记录不能删除' },
        { status: 400 }
      );
    }

    // 删除退款记录
    await prisma.refundRecord.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '退款记录删除成功',
    });
  } catch (error) {
    console.error('删除退款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '删除退款记录失败' },
      { status: 500 }
    );
  }
}
