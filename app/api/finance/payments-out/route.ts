// 付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { clearCacheAfterPaymentOut } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';
import { getStandardTransactionOptions } from '@/lib/db/transaction-options';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { updateExpensePaymentStatusAfterPayment } from '@/lib/services/expense-payable-integration';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import type {
  PaymentOutRecordDetail,
  PaymentOutRecordListResponse,
} from '@/lib/types/payable';
import { parseLocalDateString } from '@/lib/utils/datetime';
import { generatePaymentOutNumber } from '@/lib/utils/payment-number-generator';
import {
  createPaymentOutRecordSchema,
  paymentOutRecordQuerySchema,
} from '@/lib/validations/payable';

/**
 * GET /api/finance/payments-out - 获取付款记录列表
 * 权限：需要 finance:view 权限
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    // 解析查询参数
    const searchParams = new URL(request.url).searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validationResult = paymentOutRecordQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return errorResponse(
        `查询参数验证失败: ${validationResult.error.issues[0]?.message}`,
        400
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
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { paymentNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { voucherNumber: { contains: search, mode: 'insensitive' } },
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
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (startDate) {
        const parsedStart =
          parseLocalDateString(startDate) ?? new Date(startDate);
        dateFilter.gte = parsedStart;
      }
      if (endDate) {
        const parsedEnd = parseLocalDateString(endDate) ?? new Date(endDate);
        dateFilter.lte = parsedEnd;
      }
      where.paymentDate = dateFilter;
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

    return successResponse(response);
  },
  { permissions: ['finance:view'] }
);

/**
 * POST /api/finance/payments-out - 创建付款记录
 * 权限：需要 finance:manage 权限
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    // 解析请求体
    const body = await request.json();
    const validationResult = createPaymentOutRecordSchema.safeParse(body);

    if (!validationResult.success) {
      return errorResponse(
        `数据验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const data = validationResult.data;

    // 验证供应商是否存在
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true, name: true, status: true },
    });

    if (!supplier) {
      return errorResponse('供应商不存在', 404);
    }

    if (supplier.status !== 'active') {
      return errorResponse('供应商状态异常，无法创建付款记录', 400);
    }

    // 如果关联应付款记录,验证金额
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
        return errorResponse('关联的应付款记录不存在', 404);
      }

      // 金额验证：检查付款金额是否超过剩余应付金额
      if (data.paymentAmount > payableRecord.remainingAmount) {
        return errorResponse(
          `付款金额超过应付金额。应付: ￥${payableRecord.remainingAmount.toFixed(2)}, 本次付款: ￥${data.paymentAmount.toFixed(2)}`,
          400
        );
      }
    }

    // 生成付款单号(使用数据库序列表确保并发安全)
    const paymentNumber = await generatePaymentOutNumber();

    // 使用事务创建付款记录并更新应付款
    const payment = await prisma.$transaction(
      async tx => {
        // 创建付款记录
        const newPayment = await tx.paymentOutRecord.create({
          data: {
            ...data,
            paymentNumber,
            userId: user.id,
            paymentDate:
              parseLocalDateString(data.paymentDate) ??
              new Date(data.paymentDate),
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

        // 如果关联应付款记录,使用乐观锁更新应付款状态(并发控制)
        if (payableRecord) {
          const updateResult = await tx.payableRecord.updateMany({
            where: {
              id: data.payableRecordId,
              remainingAmount: { gte: data.paymentAmount },
            },
            data: {
              paidAmount: { increment: data.paymentAmount },
              remainingAmount: { decrement: data.paymentAmount },
              updatedAt: new Date(),
            },
          });

          if (updateResult.count === 0) {
            throw new Error('付款失败,可能是并发冲突或金额超限');
          }

          // 计算新的剩余金额,判断是否需要更新状态
          const newRemainingAmount =
            payableRecord.remainingAmount - data.paymentAmount;

          let newStatus = payableRecord.status;
          if (newRemainingAmount <= 0) {
            newStatus = 'paid';
          } else if (payableRecord.paidAmount + data.paymentAmount > 0) {
            newStatus = 'partial';
          }

          // 更新应付款状态
          await tx.payableRecord.update({
            where: { id: payableRecord.id },
            data: {
              status: newStatus,
              updatedAt: new Date(),
            },
          });

          // 阶段3：付款核销后联动更新关联费用的支付状态
          if (env.EXPENSE_TO_PAYABLE_ENABLED && data.payableRecordId) {
            try {
              await updateExpensePaymentStatusAfterPayment({
                payableRecordId: data.payableRecordId,
                paymentAmount: data.paymentAmount,
                tx,
              });
            } catch (error) {
              logger.warn(
                'payments-out',
                '付款后更新费用状态失败，但不影响付款记录',
                error,
                {
                  paymentNumber,
                  payableRecordId: data.payableRecordId,
                  paymentAmount: data.paymentAmount,
                }
              );
              // 不抛出错误，允许付款继续完成
            }
          }
        }

        // ✅ 修复问题1：记录供应商往来账本
        // 在付款单创建成功后，调用 recordPartnerTransaction 记录账本
        try {
          await recordPartnerTransaction({
            partnerId: data.supplierId,
            partnerName: supplier.name,
            partnerRole: 'supplier',
            entityType: 'supplier',
            transactionType: 'payment_out',
            amount: data.paymentAmount,
            referenceId: newPayment.id,
            referenceNumber: paymentNumber,
            description: `付款 ${paymentNumber} 已确认`,
            occurredAt: newPayment.paymentDate,
            metadata: {
              paymentMethod: data.paymentMethod,
              payableRecordId: data.payableRecordId ?? undefined,
              voucherNumber: data.voucherNumber ?? undefined,
              triggeredBy: 'payment_out:create',
            },
          });
        } catch (error) {
          logger.error('payments-out', '记录供应商往来账失败', error, {
            paymentId: newPayment.id,
            paymentNumber,
            supplierId: data.supplierId,
          });
          // 账本记录失败时回滚整个事务
          throw new Error('记录供应商往来账失败');
        }

        return newPayment;
      },
      getStandardTransactionOptions() // 根据数据库类型自动配置事务选项（SQLite默认串行化，MySQL/PostgreSQL使用Serializable）
    );

    // 清除相关缓存
    await clearCacheAfterPaymentOut();

    return successResponse(payment, 201, '付款记录创建成功');
  },
  { permissions: ['finance:manage'] }
);
