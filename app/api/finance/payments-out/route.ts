// 付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import { parseOffsetPagination } from '@/lib/api/pagination';
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
import { buildPaymentOutWhereConditions } from '@/lib/services/payment-out-query-service';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import type {
  PaymentOutRecordDetail,
  PaymentOutRecordListResponse,
} from '@/lib/types/payable';
import { parseLocalDateString } from '@/lib/utils/datetime';
import { withIdempotency } from '@/lib/utils/idempotency';
import { toNumber } from '@/lib/utils/number';
import { generatePaymentOutNumber } from '@/lib/utils/payment-number-generator';
import { normalizePaymentOutAmounts } from '@/lib/utils/payment-out-amounts';
import {
  createPaymentOutRecordSchema,
  paymentOutRecordQuerySchema,
} from '@/lib/validations/payable';

const PAYMENT_OUT_STATUSES = [
  'pending',
  'confirmed',
  'cancelled',
] as const satisfies ReadonlyArray<PaymentOutRecordDetail['status']>;

const PAYMENT_OUT_METHODS = [
  'cash',
  'bank_transfer',
  'alipay',
  'wechat',
  'check',
  'other',
] as const satisfies ReadonlyArray<PaymentOutRecordDetail['paymentMethod']>;

type PaymentOutRecordWithInclude = {
  id: string;
  paymentNumber: string;
  payableRecordId: string | null;
  supplierId: string;
  userId: string;
  paymentMethod: string;
  paymentAmount: unknown;
  actualPaymentAmount: unknown;
  roundingAmount: unknown;
  paymentDate: Date;
  status: string;
  remarks: string | null;
  voucherNumber: string | null;
  bankInfo: string | null;
  createdAt: Date;
  updatedAt: Date;
  payableRecord: {
    id: string;
    payableNumber: string;
    payableAmount: unknown;
    remainingAmount: unknown;
  } | null;
  supplier: {
    id: string;
    name: string;
    phone: string | null;
    address: string | null;
  };
  user: { id: string; name: string; email: string | null };
};

function normalizePaymentOutStatus(
  value: string
): PaymentOutRecordDetail['status'] {
  return (PAYMENT_OUT_STATUSES as readonly string[]).includes(value)
    ? (value as PaymentOutRecordDetail['status'])
    : 'pending';
}

function normalizePaymentOutMethod(
  value: string
): PaymentOutRecordDetail['paymentMethod'] {
  return (PAYMENT_OUT_METHODS as readonly string[]).includes(value)
    ? (value as PaymentOutRecordDetail['paymentMethod'])
    : 'other';
}

function serializePaymentOutRecordDetail(
  payment: PaymentOutRecordWithInclude
): PaymentOutRecordDetail {
  return {
    id: payment.id,
    paymentNumber: payment.paymentNumber,
    supplierId: payment.supplierId,
    userId: payment.userId,
    paymentMethod: normalizePaymentOutMethod(payment.paymentMethod),
    paymentAmount: toNumber(payment.paymentAmount),
    actualPaymentAmount: toNumber(payment.actualPaymentAmount),
    roundingAmount: toNumber(payment.roundingAmount),
    paymentDate: payment.paymentDate,
    status: normalizePaymentOutStatus(payment.status),
    ...(payment.payableRecordId !== null &&
    payment.payableRecordId !== undefined
      ? { payableRecordId: payment.payableRecordId }
      : {}),
    ...(payment.remarks !== null && payment.remarks !== undefined
      ? { remarks: payment.remarks }
      : {}),
    ...(payment.voucherNumber !== null && payment.voucherNumber !== undefined
      ? { voucherNumber: payment.voucherNumber }
      : {}),
    ...(payment.bankInfo !== null && payment.bankInfo !== undefined
      ? { bankInfo: payment.bankInfo }
      : {}),
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    ...(payment.payableRecord
      ? {
          payableRecord: {
            id: payment.payableRecord.id,
            payableNumber: payment.payableRecord.payableNumber,
            payableAmount: toNumber(payment.payableRecord.payableAmount),
            remainingAmount: toNumber(payment.payableRecord.remainingAmount),
          },
        }
      : {}),
    supplier: {
      id: payment.supplier.id,
      name: payment.supplier.name,
      ...(payment.supplier.phone !== null &&
      payment.supplier.phone !== undefined
        ? { phone: payment.supplier.phone }
        : {}),
      ...(payment.supplier.address !== null &&
      payment.supplier.address !== undefined
        ? { address: payment.supplier.address }
        : {}),
    },
    user: {
      id: payment.user.id,
      name: payment.user.name,
      email: payment.user.email ?? '',
    },
  };
}

/**
 * GET /api/finance/payments-out - 获取付款记录列表
 * 权限：需要 finance:view 权限
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;

    let normalizedPage: number;
    let normalizedLimit: number;
    try {
      ({ page: normalizedPage, limit: normalizedLimit } = parseOffsetPagination(
        searchParams,
        {
          defaultLimit: 20,
          maxLimit: 50000,
          strict: true,
          pageFieldLabel: '页码',
          limitFieldLabel: '每页数量',
        }
      ));
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : '分页参数格式不正确',
        400
      );
    }

    const queryParams = Object.fromEntries(searchParams.entries());
    queryParams.page = String(normalizedPage);
    queryParams.limit = String(normalizedLimit);
    const validationResult = paymentOutRecordQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return errorResponse(
        `查询条件有误： ${validationResult.error.issues[0]?.message}`,
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

    const where = buildPaymentOutWhereConditions({
      page,
      limit,
      search,
      payableRecordId,
      supplierId,
      status,
      paymentMethod,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    });

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
        orderBy: [{ [sortBy]: sortOrder } as any, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.paymentOutRecord.count({ where }),
    ]);

    const response: PaymentOutRecordListResponse = {
      data: payments.map(payment =>
        serializePaymentOutRecordDetail(payment as PaymentOutRecordWithInclude)
      ),
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

    const normalizedAmounts = normalizePaymentOutAmounts({
      paymentAmount: parseNumber(body?.paymentAmount),
      actualPaymentAmount:
        body?.actualPaymentAmount !== undefined
          ? parseNumber(body.actualPaymentAmount)
          : undefined,
      roundingAmount:
        body?.roundingAmount !== undefined
          ? parseNumber(body.roundingAmount)
          : undefined,
    });

    const validationResult = createPaymentOutRecordSchema.safeParse({
      ...body,
      ...normalizedAmounts,
    });

    if (!validationResult.success) {
      return errorResponse(
        `数据验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const { idempotencyKey, ...data } = validationResult.data;
    const normalizedData = {
      ...data,
      ...normalizePaymentOutAmounts({
        paymentAmount: data.paymentAmount,
        actualPaymentAmount: data.actualPaymentAmount,
        roundingAmount: data.roundingAmount,
      }),
    };

    // 验证供应商是否存在
    const supplier = await prisma.supplier.findUnique({
      where: { id: normalizedData.supplierId },
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
    if (normalizedData.payableRecordId) {
      payableRecord = await prisma.payableRecord.findUnique({
        where: { id: normalizedData.payableRecordId },
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
      const existingRemainingAmount = toNumber(
        payableRecord.remainingAmount,
        0
      );
      if (normalizedData.paymentAmount > existingRemainingAmount) {
        return errorResponse(
          `付款金额超过应付金额。应付: ￥${existingRemainingAmount.toFixed(2)}, 本次付款: ￥${normalizedData.paymentAmount.toFixed(2)}`,
          400
        );
      }
    }

    const payment = await withIdempotency(
      idempotencyKey,
      'payment_out_create',
      normalizedData.payableRecordId ?? normalizedData.supplierId,
      user.id,
      validationResult.data,
      async () => {
        // 生成付款单号(使用数据库序列表确保并发安全)
        const paymentNumber = await generatePaymentOutNumber();

        // 使用事务创建付款记录并更新应付款
        return await prisma.$transaction(
          async tx => {
            // 创建付款记录
            const newPayment = await tx.paymentOutRecord.create({
              data: {
                ...normalizedData,
                paymentNumber,
                userId: user.id,
                // ✅ 付款核销创建即为“已确认”状态（与统计口径、账本描述一致）
                status: 'confirmed',
                paymentDate:
                  parseLocalDateString(normalizedData.paymentDate) ??
                  new Date(normalizedData.paymentDate),
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
            if (payableRecord && normalizedData.payableRecordId) {
              const updateResult = await tx.payableRecord.updateMany({
                where: {
                  id: normalizedData.payableRecordId,
                  remainingAmount: { gte: normalizedData.paymentAmount },
                },
                data: {
                  paidAmount: { increment: normalizedData.paymentAmount },
                  remainingAmount: { decrement: normalizedData.paymentAmount },
                  updatedAt: new Date(),
                },
              });

              if (updateResult.count === 0) {
                throw new Error('付款失败,可能是并发冲突或金额超限');
              }

              const refreshedPayable = await tx.payableRecord.findUnique({
                where: { id: normalizedData.payableRecordId },
                select: {
                  status: true,
                  paidAmount: true,
                  remainingAmount: true,
                },
              });

              if (!refreshedPayable) {
                throw new Error('关联的应付款记录不存在');
              }

              const remaining = toNumber(refreshedPayable.remainingAmount, 0);
              const paid = toNumber(refreshedPayable.paidAmount, 0);
              const computedStatus =
                remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';

              if (computedStatus !== refreshedPayable.status) {
                await tx.payableRecord.update({
                  where: { id: normalizedData.payableRecordId },
                  data: {
                    status: computedStatus,
                    updatedAt: new Date(),
                  },
                });
              }

              // 阶段3：付款核销后联动更新关联费用的支付状态
              if (env.EXPENSE_TO_PAYABLE_ENABLED) {
                try {
                  await updateExpensePaymentStatusAfterPayment({
                    payableRecordId: normalizedData.payableRecordId,
                    paymentAmount: normalizedData.paymentAmount,
                    payableAlreadyUpdated: true,
                    tx,
                  });
                } catch (error) {
                  logger.warn(
                    'payments-out',
                    '付款后更新费用状态失败，但不影响付款记录',
                    undefined,
                    {
                      paymentNumber,
                      payableRecordId: normalizedData.payableRecordId,
                      paymentAmount: normalizedData.paymentAmount,
                      error:
                        error instanceof Error
                          ? error.message
                          : String(error ?? ''),
                    }
                  );
                  // 不抛出错误，允许付款继续完成
                }
              }
            }

            // ✅ 修复问题1：记录供应商往来账本（与付款记录同事务）
            try {
              if (normalizedData.actualPaymentAmount > 0) {
                await recordPartnerTransaction(
                  {
                    partnerId: normalizedData.supplierId,
                    partnerName: supplier.name,
                    partnerRole: 'supplier',
                    entityType: 'supplier',
                    transactionType: 'payment_out',
                    amount: normalizedData.actualPaymentAmount,
                    referenceId: newPayment.id,
                    referenceNumber: paymentNumber,
                    description: `付款 ${paymentNumber} 已确认`,
                    userId: user.id,
                    occurredAt: newPayment.paymentDate,
                    metadata: {
                      paymentMethod: normalizedData.paymentMethod,
                      payableRecordId:
                        normalizedData.payableRecordId ?? undefined,
                      voucherNumber: normalizedData.voucherNumber ?? undefined,
                      paymentAmount: normalizedData.paymentAmount,
                      actualPaymentAmount:
                        normalizedData.actualPaymentAmount,
                      roundingAmount: normalizedData.roundingAmount,
                      triggeredBy: 'payment_out:create',
                    },
                  },
                  tx
                );
              }
            } catch (error) {
              logger.error(
                'payments-out',
                '记录供应商往来账失败',
                error,
                undefined,
                {
                  paymentId: newPayment.id,
                  paymentNumber,
                  supplierId: normalizedData.supplierId,
                }
              );
              // 账本记录失败时回滚整个事务
              throw new Error('记录供应商往来账失败');
            }

            // 返回最新数据（包含应付款最新状态/金额）
            const refreshedPayment = await tx.paymentOutRecord.findUnique({
              where: { id: newPayment.id },
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

            if (!refreshedPayment) {
              throw new Error('付款记录创建失败');
            }

            return refreshedPayment;
          },
          getStandardTransactionOptions() // 根据数据库类型自动配置事务选项（SQLite默认串行化，MySQL/PostgreSQL使用Serializable）
        );
      }
    );

    // 清除相关缓存
    await clearCacheAfterPaymentOut();

    return successResponse(
      serializePaymentOutRecordDetail(payment as PaymentOutRecordWithInclude),
      201,
      '付款记录创建成功'
    );
  },
  { permissions: ['finance:manage'] }
);

