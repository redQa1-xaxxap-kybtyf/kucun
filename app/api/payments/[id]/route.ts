import { NextResponse, type NextRequest } from 'next/server';

import { errorResponse, verifyApiAuth } from '@/lib/api-helpers';
import { prisma } from '@/lib/db';
import { updatePaymentRecordSchema } from '@/lib/validations/payment';

/**
 * GET /api/payments/[id] - 获取单个收款记录详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 身份验证
    const auth = verifyApiAuth(request);
    if (!auth.success) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    const { id } = params;

    // 查询收款记录
    const payment = await prisma.paymentRecord.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { success: false, error: '收款记录不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error('获取收款记录详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取收款记录详情失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/payments/[id] - 更新收款记录
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 身份验证
    const auth = verifyApiAuth(request);
    if (!auth.success) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    const { id } = params;

    // 验证收款记录是否存在
    const existingPayment = await prisma.paymentRecord.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { success: false, error: '收款记录不存在' },
        { status: 404 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const validationResult = updatePaymentRecordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '数据验证失败',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // 处理日期字段并创建更新对象
    const updateDataWithDate = {
      ...updateData,
      ...(updateData.paymentDate && {
        paymentDate: new Date(updateData.paymentDate),
      }),
    };

    // 更新收款记录
    const updatedPayment = await prisma.paymentRecord.update({
      where: { id },
      data: updateDataWithDate,
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
      data: updatedPayment,
      message: '收款记录更新成功',
    });
  } catch (error) {
    console.error('更新收款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '更新收款记录失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payments/[id] - 删除收款记录
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 身份验证
    const auth = verifyApiAuth(request);
    if (!auth.success) {
      return errorResponse(auth.error || '未授权访问', 401);
    }

    const { id } = params;

    // 验证收款记录是否存在
    const existingPayment = await prisma.paymentRecord.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { success: false, error: '收款记录不存在' },
        { status: 404 }
      );
    }

    // 检查是否可以删除（只有待确认状态的记录可以删除）
    if (existingPayment.status === 'confirmed') {
      return NextResponse.json(
        { success: false, error: '已确认的收款记录不能删除' },
        { status: 400 }
      );
    }

    // 删除收款记录
    await prisma.paymentRecord.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '收款记录删除成功',
    });
  } catch (error) {
    console.error('删除收款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '删除收款记录失败' },
      { status: 500 }
    );
  }
}
