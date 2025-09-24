import { getServerSession } from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  createRefundRecordSchema,
  refundQuerySchema,
} from '@/lib/validations/refund';

/**
 * GET /api/refunds - 获取退款记录列表
 * 支持分页、搜索、筛选等查询参数
 */
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const searchParams = new URL(request.url).searchParams;
    const queryResult = refundQuerySchema.safeParse({
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      refundType: searchParams.get('refundType') || undefined,
      refundMethod: searchParams.get('refundMethod') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      salesOrderId: searchParams.get('salesOrderId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数验证失败',
          details: queryResult.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      page,
      pageSize,
      search,
      status,
      refundType,
      refundMethod,
      customerId,
      salesOrderId,
      startDate,
      endDate,
    } = queryResult.data;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { refundNumber: { contains: search } },
        { receiptNumber: { contains: search } },
        { reason: { contains: search } },
        { remarks: { contains: search } },
        { customer: { name: { contains: search } } },
        { salesOrder: { orderNumber: { contains: search } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (refundType) {
      where.refundType = refundType;
    }

    if (refundMethod) {
      where.refundMethod = refundMethod;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (salesOrderId) {
      where.salesOrderId = salesOrderId;
    }

    if (startDate || endDate) {
      where.refundDate = {};
      if (startDate) {
        where.refundDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.refundDate.lte = new Date(endDate);
      }
    }

    // 查询数据
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
        orderBy: {
          refundDate: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.refundRecord.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        refunds,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('获取退款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取退款记录失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/refunds - 创建退款记录
 */
export async function POST(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const validationResult = createRefundRecordSchema.safeParse(body);

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

    const data = validationResult.data;

    // 验证销售订单是否存在
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: data.salesOrderId },
      select: { id: true, customerId: true, totalAmount: true, status: true },
    });

    if (!salesOrder) {
      return NextResponse.json(
        { success: false, error: '销售订单不存在' },
        { status: 404 }
      );
    }

    // 验证客户ID是否匹配
    if (salesOrder.customerId !== data.customerId) {
      return NextResponse.json(
        { success: false, error: '客户信息与订单不匹配' },
        { status: 400 }
      );
    }

    // 生成退款单号
    const refundNumber = `REF${Date.now()}`;

    // 计算剩余金额
    const remainingAmount = data.refundAmount;

    // 创建退款记录
    const refund = await prisma.refundRecord.create({
      data: {
        ...data,
        refundNumber,
        userId: session.user.id,
        refundDate: new Date(data.refundDate),
        remainingAmount,
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
      data: refund,
      message: '退款记录创建成功',
    });
  } catch (error) {
    console.error('创建退款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '创建退款记录失败' },
      { status: 500 }
    );
  }
}
