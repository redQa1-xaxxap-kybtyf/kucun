import { type NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';

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

type CreatePaymentRecordInput = z.infer<typeof createPaymentRecordSchema>;

/**
 * GET /api/payments - 获取收款记录列表
 * 支持分页、搜索、筛选等查询参数
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    // 解析查询参数
    const searchParams = new URL(request.url).searchParams;
    const queryResult = paymentRecordQuerySchema.safeParse({
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
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
      const paymentDateFilter: { gte?: Date; lte?: Date } = {};
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.paymentRecord.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        payments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
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
});

/**
 * POST /api/payments - 创建收款记录
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  const userId = user.id;
  let requestData: CreatePaymentRecordInput | null = null;

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

    const data = validationResult.data;
    requestData = data;

    // 根据收款类型执行不同的验证逻辑
    if (data.paymentType === 'order_payment') {
      // 订单收款：验证销售订单
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
              status: true,
              payments: {
                where: { status: { in: ['confirmed', 'pending'] } },
                select: { paymentAmount: true, status: true },
              },
            },
          });

          if (!salesOrder) {
            throw new Error('销售订单不存在');
          }

          const confirmedAmount = salesOrder.payments
            .filter(payment => payment.status === 'confirmed')
            .reduce((sum, payment) => sum + payment.paymentAmount, 0);
          const pendingAmount = salesOrder.payments
            .filter(payment => payment.status === 'pending')
            .reduce((sum, payment) => sum + payment.paymentAmount, 0);

          // 验证收款金额不超过订单总额
          if (
            confirmedAmount + pendingAmount + data.paymentAmount >
            salesOrder.totalAmount
          ) {
            throw new Error('收款金额超过订单总额');
          }

          // 如果收款金额达到或超过订单总额且订单已发货,自动更新为已完成
          const newTotalPaid = confirmedAmount + data.paymentAmount;
          if (
            newTotalPaid >= salesOrder.totalAmount &&
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
    await clearCacheAfterPayment();

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
          occurredAt: payment.paymentDate ?? new Date(),
          metadata: {
            paymentType: payment.paymentType,
            paymentMethod: payment.paymentMethod,
            salesOrderId: payment.salesOrderId ?? undefined,
            paymentAmount: payment.paymentAmount,
            actualPaymentAmount: payment.actualPaymentAmount,
            roundingAmount: payment.roundingAmount,
            triggeredBy: 'payment:create',
          },
        });
      } catch (error) {
        logger.error('payments', '记录收款往来账失败', error, {
          paymentId: payment.id,
          paymentNumber: payment.paymentNumber,
        });
      }
    }

    // 发布财务事件
    await publishFinanceEvent({
      action: 'created',
      recordType: 'payment',
      recordId: payment.id,
      recordNumber: payment.paymentNumber,
      amount: payment.paymentAmount,
      customerId: payment.customerId,
      customerName: payment.customer.name,
      userId,
    });

    return NextResponse.json({
      success: true,
      data: payment,
      message: '收款记录创建成功',
    });
  } catch (error) {
    logger.error('payments', '创建收款记录失败', error, {
      userId,
      salesOrderId: requestData?.salesOrderId,
    });
    return NextResponse.json(
      { success: false, error: '创建收款记录失败' },
      { status: 500 }
    );
  }
});
