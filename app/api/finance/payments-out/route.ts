// 付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type {
  PaymentOutRecordDetail,
  PaymentOutRecordListResponse,
} from '@/lib/types/payable';
import {
  createPaymentOutRecordSchema,
  paymentOutRecordQuerySchema,
} from '@/lib/validations/payable';

/**
 * GET /api/finance/payments-out - 获取付款记录列表
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
    const queryParams = Object.fromEntries(searchParams.entries());
    const validationResult = paymentOutRecordQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数验证失败',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      page,
      limit,
      search,
      payableRecordId,
      supplierId,
      status,
      paymentMethod,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = validationResult.data;

    // 构建查询条件
    const where: any = {};

    if (search) {
      where.OR = [
        { paymentNumber: { contains: search } },
        { supplier: { name: { contains: search } } },
        { voucherNumber: { contains: search } },
      ];
    }

    if (payableRecordId) {
      where.payableRecordId = payableRecordId;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
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

    // 计算分页
    const skip = (page - 1) * limit;

    // 查询付款记录
    const [payments, total] = await Promise.all([
      prisma.paymentOutRecord.findMany({
        where,
        include: {
          payableRecord: {
            select: {
              id: true,
              payableNumber: true,
              payableAmount: true,
              remainingAmount: true,
            },
          },
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
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),
      prisma.paymentOutRecord.count({ where }),
    ]);

    const response: PaymentOutRecordListResponse = {
      data: payments as PaymentOutRecordDetail[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('获取付款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取付款记录失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/finance/payments-out - 创建付款记录
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
    const validationResult = createPaymentOutRecordSchema.safeParse(body);

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

    // 验证供应商是否存在
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true, name: true, status: true },
    });

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: '供应商不存在' },
        { status: 404 }
      );
    }

    if (supplier.status !== 'active') {
      return NextResponse.json(
        { success: false, error: '供应商状态异常，无法创建付款记录' },
        { status: 400 }
      );
    }

    // 如果关联应付款记录，验证并更新
    let payableRecord = null;
    if (data.payableRecordId) {
      payableRecord = await prisma.payableRecord.findUnique({
        where: { id: data.payableRecordId },
        select: {
          id: true,
          payableAmount: true,
          paidAmount: true,
          remainingAmount: true,
          status: true,
        },
      });

      if (!payableRecord) {
        return NextResponse.json(
          { success: false, error: '关联的应付款记录不存在' },
          { status: 404 }
        );
      }

      // 检查付款金额是否超过剩余应付金额
      if (data.paymentAmount > payableRecord.remainingAmount) {
        return NextResponse.json(
          { success: false, error: '付款金额不能超过剩余应付金额' },
          { status: 400 }
        );
      }
    }

    // 生成付款单号
    const paymentNumber = `PAYOUT-${Date.now()}`;

    // 使用事务创建付款记录并更新应付款
    const payment = await prisma.$transaction(async tx => {
      // 创建付款记录
      const newPayment = await tx.paymentOutRecord.create({
        data: {
          ...data,
          paymentNumber,
          userId: session.user.id,
          paymentDate: new Date(data.paymentDate),
        },
        include: {
          payableRecord: {
            select: {
              id: true,
              payableNumber: true,
              payableAmount: true,
              remainingAmount: true,
            },
          },
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
        },
      });

      // 如果关联应付款记录，更新应付款状态
      if (payableRecord) {
        const newPaidAmount = payableRecord.paidAmount + data.paymentAmount;
        const newRemainingAmount = payableRecord.payableAmount - newPaidAmount;

        let newStatus = payableRecord.status;
        if (newRemainingAmount <= 0) {
          newStatus = 'paid';
        } else if (newPaidAmount > 0) {
          newStatus = 'partial';
        }

        await tx.payableRecord.update({
          where: { id: payableRecord.id },
          data: {
            paidAmount: newPaidAmount,
            remainingAmount: newRemainingAmount,
            status: newStatus,
          },
        });
      }

      return newPayment;
    });

    return NextResponse.json({
      success: true,
      data: payment,
      message: '付款记录创建成功',
    });
  } catch (error) {
    console.error('创建付款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '创建付款记录失败' },
      { status: 500 }
    );
  }
}
