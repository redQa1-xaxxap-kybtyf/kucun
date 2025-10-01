import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { clearCacheAfterPayment } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';
import { generatePaymentNumber } from '@/lib/utils/payment-number-generator';
import {
  createPaymentRecordSchema,
  paymentRecordQuerySchema,
} from '@/lib/validations/payment';

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
      paymentMethod,
      customerId,
      startDate,
      endDate,
    } = queryResult.data;

    // 构建查询条件
    const where: Record<string, unknown> = {};

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

    if (startDate || endDate) {
      const paymentDateFilter: any = {};
      if (startDate) {
        paymentDateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        paymentDateFilter.lte = new Date(endDate);
      }
      where.paymentDate = paymentDateFilter;
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
    const validationResult = createPaymentRecordSchema.safeParse(body);

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

    // 验证销售订单是否存在并获取已收款信息
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: data.salesOrderId },
      select: {
        id: true,
        customerId: true,
        totalAmount: true,
        status: true,
        payments: {
          where: { status: 'confirmed' },
          select: { paymentAmount: true },
        },
      },
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

    // 金额验证：计算已收款金额和剩余应收金额
    const totalPaid = salesOrder.payments.reduce(
      (sum, p) => sum + p.paymentAmount,
      0
    );
    const remainingAmount = salesOrder.totalAmount - totalPaid;

    // 验证收款金额不超过剩余应收金额
    if (data.paymentAmount > remainingAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `收款金额超过应收金额。应收: ¥${remainingAmount.toFixed(2)}, 本次收款: ¥${data.paymentAmount.toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    // 生成收款单号(使用数据库序列表确保并发安全)
    const paymentNumber = await generatePaymentNumber();

    // 使用事务确保收款记录创建和订单状态更新的一致性
    const payment = await prisma.$transaction(
      async tx => {
        // 创建收款记录
        const newPayment = await tx.paymentRecord.create({
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

        // 验证收款金额不超过订单总额
        if (totalPaid + data.paymentAmount > salesOrder.totalAmount) {
          throw new Error('收款金额超过订单总额');
        }

        // 如果收款金额达到或超过订单总额,更新订单状态
        const newTotalPaid = totalPaid + data.paymentAmount;
        if (
          newTotalPaid >= salesOrder.totalAmount &&
          salesOrder.status === 'confirmed'
        ) {
          await tx.salesOrder.update({
            where: { id: data.salesOrderId },
            data: {
              status: 'shipped', // 全额收款后可以发货
              updatedAt: new Date(),
            },
          });
        }

        return newPayment;
      },
      {
        isolationLevel: 'Serializable',
        timeout: 10000, // 10秒超时
      }
    );

    // 清除相关缓存
    await clearCacheAfterPayment();

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
