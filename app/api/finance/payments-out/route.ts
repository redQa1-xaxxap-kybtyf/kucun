// 付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import { successResponse, withAuth } from '@/lib/auth/api-helpers';
import { clearCacheAfterPaymentOut } from '@/lib/cache/finance-cache';
import { prisma } from '@/lib/db';
import type {
  PaymentOutRecordDetail,
  PaymentOutRecordListResponse,
} from '@/lib/types/payable';
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
      return successResponse(
        null,
        '查询参数验证失败: ' + validationResult.error.issues[0]?.message
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
      return successResponse(
        null,
        '数据验证失败: ' + validationResult.error.issues[0]?.message
      );
    }

    const data = validationResult.data;

    // 验证供应商是否存在
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true, name: true, status: true },
    });

    if (!supplier) {
      return successResponse(null, '供应商不存在');
    }

    if (supplier.status !== 'active') {
      return successResponse(null, '供应商状态异常，无法创建付款记录');
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
        return successResponse(null, '关联的应付款记录不存在');
      }

      // 金额验证：检查付款金额是否超过剩余应付金额
      if (data.paymentAmount > payableRecord.remainingAmount) {
        return successResponse(
          null,
          `付款金额超过应付金额。应付: ¥${payableRecord.remainingAmount.toFixed(2)}, 本次付款: ¥${data.paymentAmount.toFixed(2)}`
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
        }

        return newPayment;
      },
      {
        isolationLevel: 'Serializable',
        timeout: 10000, // 10秒超时
      }
    );

    // 清除相关缓存
    await clearCacheAfterPaymentOut();

    return successResponse(payment, '付款记录创建成功');
  },
  { permissions: ['finance:manage'] }
);
