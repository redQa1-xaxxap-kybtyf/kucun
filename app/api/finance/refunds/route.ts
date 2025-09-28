import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import { createRefundRecordSchema } from '@/lib/validations/refund';

/**
 * 应退货款API
 * GET /api/finance/refunds - 获取退款记录列表
 * POST /api/finance/refunds - 创建退款记录
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(
      searchParams.get('pageSize') ||
        paginationConfig.defaultPageSize.toString()
    );

    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const refundType = searchParams.get('refundType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { refundNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { reason: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (refundType) {
      where.refundType = refundType;
    }

    if (startDate || endDate) {
      where.refundDate = {};
      if (startDate) {
        (where.refundDate as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.refundDate as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    // 构建排序条件
    const orderBy: Record<string, unknown> = {};
    if (sortBy === 'customerName') {
      orderBy.customer = { name: sortOrder };
    } else if (sortBy === 'refundAmount') {
      orderBy.refundAmount = sortOrder;
    } else {
      orderBy[sortBy] = sortOrder;
    }

    // 计算分页
    const skip = (page - 1) * pageSize;

    // 使用真实数据库查询退款记录
    const [refunds, total] = await Promise.all([
      prisma.refundRecord.findMany({
        where,
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
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.refundRecord.count({ where }),
    ]);

    // 格式化退款记录数据
    const formattedRefunds = refunds.map(refund => ({
      id: refund.id,
      refundNumber: refund.refundNumber,
      returnOrderId: refund.returnOrderId,
      returnOrderNumber: refund.returnOrderNumber,
      salesOrderId: refund.salesOrderId,
      salesOrderNumber: refund.salesOrder?.orderNumber || '',
      customerId: refund.customerId,
      customerName: refund.customer?.name || '',
      refundType: refund.refundType,
      refundMethod: refund.refundMethod,
      refundAmount: refund.refundAmount,
      processedAmount: refund.processedAmount,
      remainingAmount: refund.remainingAmount,
      status: refund.status,
      refundDate: refund.refundDate.toISOString().split('T')[0],
      processedDate: refund.processedDate?.toISOString().split('T')[0] || null,
      reason: refund.reason,
      remarks: refund.remarks,
      bankInfo: refund.bankInfo,
      receiptNumber: refund.receiptNumber,
      createdAt: refund.createdAt.toISOString(),
      updatedAt: refund.updatedAt.toISOString(),
      customer: refund.customer,
      salesOrder: refund.salesOrder,
      user: refund.user,
    }));

    return NextResponse.json({
      success: true,
      data: {
        refunds: formattedRefunds,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取退款记录失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 创建退款记录
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validatedData = createRefundRecordSchema.parse(body);

    // 使用事务创建退款记录，确保数据一致性
    const newRefund = await prisma.$transaction(async tx => {
      // 1. 验证退货订单信息（如果提供）
      if (validatedData.returnOrderId) {
        // 修复：验证退货订单号必须同时提供
        if (!validatedData.returnOrderNumber) {
          throw new Error('退货订单ID和退货订单号必须同时提供');
        }

        // 修复：检查是否已存在相同退货单的退款记录，防止重复退款
        const existingRefundForReturn = await tx.refundRecord.findFirst({
          where: {
            returnOrderId: validatedData.returnOrderId,
            returnOrderNumber: validatedData.returnOrderNumber,
            status: { in: ['pending', 'processing', 'completed'] },
          },
        });

        if (existingRefundForReturn) {
          throw new Error(
            `退货单 ${validatedData.returnOrderNumber} 已存在退款记录，不能重复退款`
          );
        }
      }

      // 2. 验证销售订单是否存在
      const salesOrder = await tx.salesOrder.findUnique({
        where: { id: validatedData.salesOrderId },
        select: { id: true, totalAmount: true, customerId: true },
      });
      if (!salesOrder) {
        throw new Error('指定的销售订单不存在');
      }

      // 3. 验证客户是否存在
      const customer = await tx.customer.findUnique({
        where: { id: validatedData.customerId },
        select: { id: true },
      });
      if (!customer) {
        throw new Error('指定的客户不存在');
      }

      // 4. 检查是否已经有相同的退款记录
      const existingRefund = await tx.refundRecord.findFirst({
        where: {
          salesOrderId: validatedData.salesOrderId,
          returnOrderId: validatedData.returnOrderId,
          status: { in: ['pending', 'processing', 'completed'] },
        },
      });
      if (existingRefund) {
        throw new Error('该订单已存在退款记录');
      }

      // 5. 生成退款单号
      const refundNumber = `RT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // 6. 创建退款记录
      return await tx.refundRecord.create({
        data: {
          refundNumber,
          returnOrderId: validatedData.returnOrderId,
          returnOrderNumber: validatedData.returnOrderNumber,
          salesOrderId: validatedData.salesOrderId,
          customerId: validatedData.customerId,
          refundType: validatedData.refundType,
          refundMethod: validatedData.refundMethod,
          refundAmount: validatedData.refundAmount,
          processedAmount: 0,
          remainingAmount: validatedData.refundAmount,
          status: 'pending',
          refundDate: new Date(validatedData.refundDate),
          reason: validatedData.reason,
          remarks: validatedData.remarks,
          bankInfo: validatedData.bankInfo,
          userId: session.user.id,
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
    });

    return NextResponse.json({
      success: true,
      data: newRefund,
      message: '退款记录创建成功',
    });
  } catch (error) {
    console.error('创建退款记录失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据验证失败',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建退款记录失败',
      },
      { status: 500 }
    );
  }
}
