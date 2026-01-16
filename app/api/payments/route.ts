import { type NextRequest, NextResponse } from 'next/server';

import { buildOffsetPaginationMeta, parseOffsetPagination } from '@/lib/api/pagination';
import { withAuth } from '@/lib/auth/api-helpers';
import { clearCacheAfterPayment } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';
import { getStandardTransactionOptions } from '@/lib/db/transaction-options';
import { publishFinanceEvent } from '@/lib/events';
import { logger } from '@/lib/logger';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import { generatePaymentNumber } from '@/lib/utils/payment-number-generator';
import {
  createPaymentRecordSchema,
  paymentRecordQuerySchema,
} from '@/lib/validations/payment';

const toMinorUnits = (
  amount: number | { toString(): string } | null | undefined
): number => {
  const parsed = Number(amount ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100);
};

const fromMinorUnits = (amountInCents: number): number =>
  Number((amountInCents / 100).toFixed(2));

const serializeError = (error: unknown) =>
  error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { value: String(error) };

/**
 * GET /api/payments - 获取收款记录列表
 * 支持分页、搜索、筛选等查询参数
 */
export const GET = withAuth(
  async (request: NextRequest, { user }) => {
  try {
    // 解析查询参数
    const { searchParams } = request.nextUrl;
    const { page: parsedPage, limit: parsedLimit } = parseOffsetPagination(
      searchParams,
      { defaultLimit: 10, maxLimit: 50000 }
    );
    const queryResult = paymentRecordQuerySchema.safeParse({
      page: parsedPage,
      limit: parsedLimit,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      paymentMethod: searchParams.get('paymentMethod') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      // ✅ P0修复: 添加缺失的查询参数
      userId: searchParams.get('userId') || undefined,
      sortBy: searchParams.get('sortBy') || 'paymentDate',
      sortOrder: searchParams.get('sortOrder') || 'desc',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数验证失败',
          details: queryResult.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      page,
      limit,
      search,
      status,
      paymentMethod,
      customerId,
      userId,
      sortBy,
      sortOrder,
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

    // ✅ P0修复: 添加经办人筛选
    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      const paymentDateFilter: { gte?: Date; lte?: Date } = {};
      if (startDate) {
        paymentDateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        paymentDateFilter.lte = new Date(endDate);
      }
      where.paymentDate = paymentDateFilter;
    }

    // ✅ P1修复: 构建动态排序条件
    const orderByMap: Record<
      string,
      {
        paymentDate?: 'asc' | 'desc';
        paymentAmount?: 'asc' | 'desc';
        createdAt?: 'asc' | 'desc';
      }
    > = {
      paymentDate: { paymentDate: sortOrder as 'asc' | 'desc' },
      paymentAmount: { paymentAmount: sortOrder as 'asc' | 'desc' },
      createdAt: { createdAt: sortOrder as 'asc' | 'desc' },
    };
    const orderBy = orderByMap[sortBy] ?? { paymentDate: 'desc' };

    const skip = (page - 1) * limit;

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
        orderBy: [orderBy, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.paymentRecord.count({ where }),
    ]);

    const serializedPayments = payments.map(payment => ({
      ...payment,
      paymentAmount: Number(payment.paymentAmount),
      actualPaymentAmount: Number(payment.actualPaymentAmount),
      roundingAmount: Number(payment.roundingAmount),
      appliedAmount: Number(payment.appliedAmount),
    }));

    return NextResponse.json({
      success: true,
      data: {
        payments: serializedPayments,
        pagination: buildOffsetPaginationMeta({
          page,
          limit,
          total,
          hasMore: skip + serializedPayments.length < total,
        }),
      },
    });
  } catch (error) {
    logger.error('payments', '获取收款记录失败', error, {
      userId: user.id,
      url: request.url,
    });
    return NextResponse.json(
      { success: false, error: '获取收款记录失败' },
      { status: 500 }
    );
  }
  },
  { permissions: ['finance:view'] }
);


/**
 * POST /api/payments - 创建收款记录
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
  const userId = user.id;
  let data: any = null;

  try {
    // 解析请求体
    const body = await request.json();
    const parseNumber = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return Number.NaN;
    };

    const rawPaymentAmount = parseNumber(body?.paymentAmount);
    const normalizedActual =
      body?.actualPaymentAmount !== undefined
        ? parseNumber(body.actualPaymentAmount)
        : rawPaymentAmount;
    const normalizedRounding =
      body?.roundingAmount !== undefined
        ? parseNumber(body.roundingAmount)
        : Number((rawPaymentAmount - normalizedActual).toFixed(2));

    const validationResult = createPaymentRecordSchema.safeParse({
      ...body,
      paymentAmount: rawPaymentAmount,
      actualPaymentAmount: normalizedActual,
      roundingAmount: normalizedRounding,
    });

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

    data = validationResult.data;

    // 根据收款类型执行不同的验证逻辑
    if (data.paymentType === 'order_payment') {
      // 订单收款：验证销售订单
      const salesOrder = await prisma.salesOrder.findUnique({
        where: { id: data.salesOrderId },
        select: {
          id: true,
          customerId: true,
          totalAmount: true,
          roundingAdjustment: true,
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
      const orderTotalCents =
        toMinorUnits(salesOrder.totalAmount) +
        toMinorUnits(salesOrder.roundingAdjustment);
      const totalPaidCents = salesOrder.payments.reduce(
        (sum, payment) => sum + toMinorUnits(payment.paymentAmount),
        0
      );
      const remainingCents = Math.max(orderTotalCents - totalPaidCents, 0);
      const paymentCents = toMinorUnits(data.paymentAmount);

      // 验证收款金额不超过剩余应收金额
      // paymentAmount 代表本次要核销的应收账款金额
      // actualPaymentAmount 是实际收到的金额，可能因差额调整而不同
      if (paymentCents > remainingCents) {
        return NextResponse.json(
          {
            success: false,
            error: `收款金额超过应收金额。应收: ¥${fromMinorUnits(remainingCents).toFixed(2)}, 本次收款: ¥${data.paymentAmount.toFixed(2)}`,
          },
          { status: 400 }
        );
      }
    } else {
      // 预收款：验证客户是否存在
      const customer = await prisma.customer.findUnique({
        where: { id: data.customerId },
        select: { id: true },
      });

      if (!customer) {
        return NextResponse.json(
          { success: false, error: '客户不存在' },
          { status: 404 }
        );
      }
    }

    // 生成收款单号(使用数据库序列表确保并发安全)
    const paymentNumber = await generatePaymentNumber();

    // 使用事务确保收款记录创建和订单状态更新的一致性
    const payment = await prisma.$transaction(
      async tx => {
        // 创建收款记录
        const newPayment = await tx.paymentRecord.create({
          data: {
            paymentNumber,
            salesOrderId: data.salesOrderId || null, // ✅ 预收款时为null
            customerId: data.customerId,
            userId,
            paymentType: data.paymentType, // ✅ 支持 order_payment | prepayment
            paymentMethod: data.paymentMethod,
            paymentAmount: data.paymentAmount,
            actualPaymentAmount: data.actualPaymentAmount,
            roundingAmount: data.roundingAmount,
            appliedAmount: 0, // ✅ 预收款初始已冲抵金额为0
            paymentDate: new Date(data.paymentDate),
            status: data.paymentType === 'prepayment' ? 'confirmed' : 'pending', // ✅ 预收款直接确认
            remarks: data.remarks,
            receiptNumber: data.receiptNumber,
            bankInfo: data.bankInfo,
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

        // ✅ 仅订单付款需要验证金额和更新订单状态
        if (data.paymentType === 'order_payment' && data.salesOrderId) {
          // 从之前的验证中获取订单信息(避免重复查询)
          const salesOrder = await tx.salesOrder.findUnique({
            where: { id: data.salesOrderId },
            select: {
              totalAmount: true,
              roundingAdjustment: true,
              status: true,
              payments: {
                where: {
                  status: { in: ['confirmed', 'pending'] },
                  NOT: { id: newPayment.id }, // 排除当前事务中新建的待确认收款，避免重复计入
                },
                select: { paymentAmount: true, status: true },
              },
            },
          });

          if (!salesOrder) {
            throw new Error('销售订单不存在');
          }

          // 计算已确认的收款金额
          const confirmedAmountCents = salesOrder.payments
            .filter(payment => payment.status === 'confirmed')
            .reduce(
              (sum, payment) => sum + toMinorUnits(payment.paymentAmount),
              0
            );
          const orderTotalCents =
            toMinorUnits(salesOrder.totalAmount) +
            toMinorUnits(salesOrder.roundingAdjustment);
          const newPaymentCents = toMinorUnits(data.paymentAmount);

          // 注意：金额验证已在事务前完成（第252-273行），此处不再重复验证
          // 事务中只需要判断是否需要更新订单状态

          // 如果收款金额达到或超过订单总额且订单已发货,自动更新为已完成
          const newTotalPaidCents = confirmedAmountCents + newPaymentCents;
          if (
            newTotalPaidCents >= orderTotalCents &&
            salesOrder.status === 'shipped'
          ) {
            await tx.salesOrder.update({
              where: { id: data.salesOrderId },
              data: {
                status: 'completed', // 已发货 + 全额收款 = 已完成
                updatedAt: new Date(),
              },
            });
          }
        }

        return newPayment;
      },
      getStandardTransactionOptions() // 根据数据库类型自动配置事务选项（SQLite默认串行化，MySQL/PostgreSQL使用Serializable）
    );

    // 清除相关缓存
    try {
      await clearCacheAfterPayment();
    } catch (error) {
      logger.warn(
        'payments',
        '清除收款缓存失败',
        {
          paymentId: payment.id,
          paymentNumber: payment.paymentNumber,
        },
        { error: serializeError(error) }
      );
    }

    if (
      payment.status === 'confirmed' &&
      payment.customerId &&
      Number(payment.actualPaymentAmount) > 0
    ) {
      try {
        await recordPartnerTransaction({
          partnerId: payment.customerId,
          partnerRole: 'customer',
          entityType: 'customer',
          transactionType: 'payment_in',
          amount: Number(payment.actualPaymentAmount),
          referenceId: payment.id,
          referenceNumber: payment.paymentNumber,
          description: `收款 ${payment.paymentNumber} 已确认`,
          userId,
          occurredAt: payment.paymentDate ?? new Date(),
          metadata: {
            paymentType: payment.paymentType,
            paymentMethod: payment.paymentMethod,
            salesOrderId: payment.salesOrderId ?? undefined,
            paymentAmount: Number(payment.paymentAmount),
            actualPaymentAmount: Number(payment.actualPaymentAmount),
            roundingAmount: Number(payment.roundingAmount),
            triggeredBy: 'payment:create',
          },
        });
      } catch (error) {
        logger.warn(
          'payments',
          '记录收款往来账失败',
          {
            paymentId: payment.id,
            paymentNumber: payment.paymentNumber,
          },
          { error: serializeError(error) }
        );
      }
    }

    // 发布财务事件
    try {
      await publishFinanceEvent({
        action: 'created',
        recordType: 'payment',
        recordId: payment.id,
        recordNumber: payment.paymentNumber,
        amount: Number(payment.paymentAmount),
        customerId: payment.customerId,
        customerName: payment.customer.name,
        userId,
      });
    } catch (error) {
      logger.warn(
        'payments',
        '发布收款事件失败',
        {
          paymentId: payment.id,
          paymentNumber: payment.paymentNumber,
        },
        { error: serializeError(error) }
      );
    }

    const serializedPayment = {
      ...payment,
      paymentAmount: Number(payment.paymentAmount),
      actualPaymentAmount: Number(payment.actualPaymentAmount),
      roundingAmount: Number(payment.roundingAmount),
      appliedAmount: Number(payment.appliedAmount),
    };

    return NextResponse.json({
      success: true,
      data: serializedPayment,
      message: '收款记录创建成功',
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '创建收款记录失败';
    logger.error('payments', '创建收款记录失败', error, {
      userId,
      salesOrderId: data?.salesOrderId,
      errorMessage,
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details:
          process.env.NODE_ENV === 'development'
            ? error instanceof Error
              ? error.stack
              : String(error)
            : undefined,
      },
      { status: 500 }
    );
  }
  },
  { permissions: ['finance:manage'] }
);
