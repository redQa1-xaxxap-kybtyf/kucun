// 应付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
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
    // 解析查询参数
    const searchParams = new URL(request.url).searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());
    const sanitizedParams = sanitizePayableSearchParams(queryParams);
    const validationResult =
      payableRecordQuerySchema.safeParse(sanitizedParams);

    if (!validationResult.success) {
      return errorResponse(
        `查询参数验证失败: ${validationResult.error.issues[0]?.message}`,
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
      return await tx.payableRecord.create({
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
    });

    return successResponse(payable, 201, '应付款记录创建成功');
  },
  { permissions: ['finance:manage'] }
);
