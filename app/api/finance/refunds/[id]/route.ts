import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { updateRefundSchema } from '@/lib/validations/refund';

// GET /api/finance/refunds/[id] - 获取单个退款记录详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const refund = await prisma.refundRecord.findUnique({
      where: { id: params.id },
      include: {
        salesOrder: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!refund) {
      return NextResponse.json({ error: '退款记录不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: refund,
    });
  } catch (error) {
    console.error('获取退款记录失败:', error);
    return NextResponse.json(
      { error: '获取退款记录失败' },
      { status: 500 }
    );
  }
}

// PUT /api/finance/refunds/[id] - 更新退款记录
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateRefundSchema.parse(body);

    const refund = await prisma.refundRecord.update({
      where: { id: params.id },
      data: {
        ...validatedData,
        updatedAt: new Date(),
      },
      include: {
        salesOrder: {
          include: {
            customer: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: refund,
      message: '退款记录更新成功',
    });
  } catch (error) {
    console.error('更新退款记录失败:', error);
    return NextResponse.json(
      { error: '更新退款记录失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/finance/refunds/[id] - 删除退款记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 检查退款记录是否存在且可以删除
    const refund = await prisma.refundRecord.findUnique({
      where: { id: params.id },
    });

    if (!refund) {
      return NextResponse.json({ error: '退款记录不存在' }, { status: 404 });
    }

    if (refund.status === 'completed') {
      return NextResponse.json(
        { error: '已完成的退款记录不能删除' },
        { status: 400 }
      );
    }

    await prisma.refundRecord.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: '退款记录删除成功',
    });
  } catch (error) {
    console.error('删除退款记录失败:', error);
    return NextResponse.json(
      { error: '删除退款记录失败' },
      { status: 500 }
    );
  }
}
