import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { paymentRecordQuerySchema, paymentRecordCreateSchema } from '@/lib/validations/payment';

/**
 * GET /api/payments - 获取收款记录列表
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
    const queryResult = paymentRecordQuerySchema.safeParse({
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      paymentMethod: searchParams.get('paymentMethod') || undefined,
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
          details: queryResult.error.errors 
        },
        { status: 400 }
      );
    }

    const { page, pageSize, search, status, paymentMethod, customerId, salesOrderId, startDate, endDate } = queryResult.data;

    // 构建查询条件
    const where: any = {};

    if (search) {
      where.OR = [
        { paymentNumber: { contains: search } },
        { receiptNumber: { contains: search } },
        { remarks: { contains: search } },
        { customer: { name: { contains: search } } },
        { salesOrder: { orderNumber: { contains: search } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (salesOrderId) {
      where.salesOrderId = salesOrderId;
    }

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) {
        where.paymentDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.paymentDate.lte = new Date(endDate);
      }
    }

    // 查询数据
    const [payments, total] = await Promise.all([
      prisma.paymentRecord.findMany({
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
          paymentDate: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.paymentRecord.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        payments,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('获取收款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取收款记录失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments - 创建收款记录
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
    const validationResult = paymentRecordCreateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: '数据验证失败', 
          details: validationResult.error.errors 
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

    // 生成收款单号
    const paymentNumber = `PAY${Date.now()}`;

    // 创建收款记录
    const payment = await prisma.paymentRecord.create({
      data: {
        ...data,
        paymentNumber,
        userId: session.user.id,
        paymentDate: new Date(data.paymentDate),
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
      data: payment,
      message: '收款记录创建成功',
    });
  } catch (error) {
    console.error('创建收款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '创建收款记录失败' },
      { status: 500 }
    );
  }
}
