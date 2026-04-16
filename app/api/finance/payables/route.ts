// 应付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import { parseOffsetPagination } from '@/lib/api/pagination';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import {
  fetchPayableRecordList,
  normalizePayableQuery,
  sanitizePayableSearchParams,
} from '@/lib/services/payable-query-service';
import { generatePayableNumber } from '@/lib/utils/payment-number-generator';
import {
  createPayableRecordSchema,
  payableRecordQuerySchema,
} from '@/lib/validations/payable';

/**
 * GET /api/finance/payables - 获取应付款记录列表
 * 权限：需要 finance:view 权限
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    const searchParams = request.nextUrl.searchParams;

    try {
      const { page, limit } = parseOffsetPagination(searchParams, {
        defaultLimit: 20,
        maxLimit: 50000,
        strict: true,
        pageFieldLabel: '页码',
        limitFieldLabel: '每页数量',
      });

      const queryParams = Object.fromEntries(searchParams.entries());
      queryParams.page = String(page);
      queryParams.limit = String(limit);

      const sanitizedParams = sanitizePayableSearchParams(queryParams);
      const validationResult =
        payableRecordQuerySchema.safeParse(sanitizedParams);

      if (!validationResult.success) {
        return errorResponse(
          `查询条件有误： ${validationResult.error.issues[0]?.message}`,
          400
        );
      }

      const parsedQuery = validationResult.data;
      const normalizedQuery = normalizePayableQuery({
        ...parsedQuery,
        limit: parsedQuery.limit ?? paginationConfig.defaultPageSize,
      });
      const response = await fetchPayableRecordList(normalizedQuery);

      return successResponse(response);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : '查询参数格式不正确',
        400
      );
    }
  },
  { permissions: ['finance:view'] }
);

/**
 * POST /api/finance/payables - 创建应付款记录
 * 权限：需要 finance:manage 权限
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    // 解析请求体
    const body = await request.json();
    const validationResult = createPayableRecordSchema.safeParse(body);

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
      return errorResponse('供应商状态异常，无法创建应付款', 400);
    }

    // ✅ 使用事务确保单号生成和记录创建的原子性
    // 如果记录创建失败,单号不会被浪费
    const payable = await prisma.$transaction(async tx => {
      // 在事务内生成应付款单号
      const payableNumber = await generatePayableNumber(tx);

      // 创建应付款记录
      const newPayable = await tx.payableRecord.create({
        data: {
          ...data,
          payableNumber,
          userId: user.id,
          remainingAmount: data.payableAmount,
        },
        include: {
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
          paymentOutRecords: true,
        },
      });

      // ✅ 修复问题1：记录供应商往来账本
      // 在应付款创建成功后，调用 recordPartnerTransaction 记录账本
      try {
        await recordPartnerTransaction(
          {
            partnerId: data.supplierId,
            partnerName: supplier.name,
            partnerRole: 'supplier',
            entityType: 'supplier',
            transactionType: 'purchase',
            amount: data.payableAmount,
            referenceId: newPayable.id,
            referenceNumber: payableNumber,
            description: `应付款 ${payableNumber} 创建`,
            userId: user.id,
            occurredAt: newPayable.createdAt,
            dueDate: data.dueDate,
            metadata: {
              sourceType: data.sourceType,
              purchaseOrderId: data.sourceId ?? undefined,
              triggeredBy: 'payable:create',
            },
          },
          tx
        );
      } catch (error) {
        logger.error('payables', '记录供应商往来账失败', error, {
          payableId: newPayable.id,
          payableNumber,
          supplierId: data.supplierId,
        });
        // 账本记录失败时回滚整个事务
        throw new Error('记录供应商往来账失败');
      }

      return newPayable;
    });

    return successResponse(payable, 201, '应付款记录创建成功');
  },
  { permissions: ['finance:manage'] }
);

