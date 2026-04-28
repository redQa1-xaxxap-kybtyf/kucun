import { type NextRequest } from 'next/server';

import {
  buildOffsetPaginationMeta,
  parseOffsetPagination,
} from '@/lib/api/pagination';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import { publishFinanceEvent } from '@/lib/events';
import { recordPartnerTransaction } from '@/lib/services/partner-ledger-service';
import {
  buildRefundQueryParams,
  fetchRefundsList,
  sanitizeRefundSearchParams,
} from '@/lib/services/refund-query-service';
import { toNumber } from '@/lib/utils/number';
import {
  createRefundRecordSchema,
  refundQuerySchema,
} from '@/lib/validations/refund';

/**
 * 应退货款API
 * GET /api/finance/refunds - 获取退款记录列表
 * POST /api/finance/refunds - 创建退款记录
 */

/**
 * GET /api/finance/refunds - 获取退款记录列表
 * 权限：需要 finance:view 权限
 */
export const GET = withAuth(
  async (request: NextRequest) => {
    // 解析并验证查询参数
    const searchParams = request.nextUrl.searchParams;
    const normalized = new URLSearchParams(searchParams);
    if (!normalized.get('limit') && normalized.get('pageSize')) {
      normalized.set('limit', normalized.get('pageSize') as string);
    }

    let normalizedPage: number;
    let normalizedLimit: number;
    try {
      ({ page: normalizedPage, limit: normalizedLimit } = parseOffsetPagination(
        normalized,
        {
          defaultLimit: 20,
          maxLimit: paginationConfig.maxPageSize,
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
    const queryParams = sanitizeRefundSearchParams(
      Object.fromEntries(searchParams.entries())
    );
    queryParams.page = normalizedPage;
    queryParams.limit = normalizedLimit;

    // 使用 Zod schema 验证
    const validationResult = refundQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return errorResponse(
        `查询条件有误： ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const normalizedQuery = buildRefundQueryParams(validationResult.data);
    const response = await fetchRefundsList({
      page: normalizedQuery.page,
      limit: normalizedQuery.limit,
      search: normalizedQuery.search ?? '',
      status: normalizedQuery.status,
      customerId: normalizedQuery.customerId,
      returnOrderId: normalizedQuery.returnOrderId,
      salesOrderId: normalizedQuery.salesOrderId,
      refundType: normalizedQuery.refundType,
      refundMethod: normalizedQuery.refundMethod,
      sortBy: normalizedQuery.sortBy ?? 'refundDate',
      sortOrder: normalizedQuery.sortOrder === 'asc' ? 'asc' : 'desc',
      startDate: normalizedQuery.startDate,
      endDate: normalizedQuery.endDate,
      includeTest: normalizedQuery.includeTest,
      includeVoided: normalizedQuery.includeVoided,
    });

    return successResponse({
      ...response,
      pagination: buildOffsetPaginationMeta({
        page: response.pagination.page,
        limit: response.pagination.limit,
        total: response.pagination.total,
        hasMore:
          response.pagination.page * response.pagination.limit <
          response.pagination.total,
      }),
    });
  },
  { permissions: ['finance:view'] }
);

/**
 * POST /api/finance/refunds - 创建退款记录
 * 权限：需要 finance:manage 权限
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validatedData = createRefundRecordSchema.parse(body);

    // 使用事务创建退款记录，确保数据一致性
    const newRefund = await prisma.$transaction(async tx => {
      // 1. 验证退货订单信息（如果提供）
      if (validatedData.returnOrderId) {
        // 修复：验证退货订单号必须同时提供
        if (!validatedData.returnOrderNumber) {
          throw new Error('退货订单编号和退货订单号必须同时提供');
        }

        // 修复：检查是否已存在相同退货单的退款记录，防止重复退款
        const existingRefundForReturn = await tx.refundRecord.findFirst({
          where: {
            returnOrderId: validatedData.returnOrderId,
            returnOrderNumber: validatedData.returnOrderNumber,
            status: 'completed', // 只检查已完成的退款
          },
        });

        if (existingRefundForReturn) {
          throw new Error(
            `退货单 ${validatedData.returnOrderNumber} 已存在退款记录，不能重复退款`
          );
        }
      }

      // 2. 验证销售订单是否存在
      const salesOrder = await tx.salesOrder.findUnique({
        where: { id: validatedData.salesOrderId },
        select: { id: true, totalAmount: true, customerId: true },
      });
      if (!salesOrder) {
        throw new Error('指定的销售订单不存在');
      }

      // 3. 验证客户是否存在
      const customer = await tx.customer.findUnique({
        where: { id: validatedData.customerId },
        select: { id: true },
      });
      if (!customer) {
        throw new Error('指定的客户不存在');
      }

      // 4. 检查是否已经有相同的退款记录（防止重复退款）
      if (validatedData.returnOrderId) {
        const existingRefund = await tx.refundRecord.findFirst({
          where: {
            returnOrderId: validatedData.returnOrderId,
            status: 'completed', // 只检查已完成的退款
          },
        });
        if (existingRefund) {
          throw new Error('该退货单已存在退款记录');
        }
      }

      // 5. 验证退款总额不能超过订单金额
      const salesOrderWithRefunds = await tx.salesOrder.findUnique({
        where: { id: validatedData.salesOrderId },
        select: { totalAmount: true },
      });
      if (!salesOrderWithRefunds) {
        throw new Error('销售订单不存在');
      }

      // 查询已有退款总额
      const existingRefunds = await tx.refundRecord.aggregate({
        where: {
          salesOrderId: validatedData.salesOrderId,
          status: 'completed', // 只统计已完成的退款
        },
        _sum: { refundAmount: true },
      });

      const orderTotalAmount = toNumber(salesOrderWithRefunds.totalAmount, 0);
      const existingRefundAmount = toNumber(
        existingRefunds._sum.refundAmount,
        0
      );
      const totalRefundAmount =
        existingRefundAmount + validatedData.refundAmount;

      if (totalRefundAmount > orderTotalAmount) {
        throw new Error(
          `退款总额(￥${totalRefundAmount.toFixed(2)})不能超过订单金额(￥${orderTotalAmount.toFixed(2)})`
        );
      }

      // 6. 生成退款单号
      const refundNumber = `RT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // 7. 创建退款记录（进销存系统：退款是记录已发生的事实，直接标记为已完成）
      const refund = await tx.refundRecord.create({
        data: {
          refundNumber,
          returnOrderId: validatedData.returnOrderId || null,
          returnOrderNumber: validatedData.returnOrderNumber || null,
          salesOrderId: validatedData.salesOrderId,
          customerId: validatedData.customerId,
          refundType: validatedData.refundType,
          refundMethod: validatedData.refundMethod,
          refundAmount: validatedData.refundAmount,
          processedAmount: validatedData.refundAmount, // 进销存：创建时即已完成
          remainingAmount: 0, // 进销存：无剩余金额
          status: 'completed', // 进销存：直接完成
          refundDate: new Date(validatedData.refundDate),
          processedDate: new Date(validatedData.refundDate), // 处理日期=退款日期
          reason: validatedData.reason,
          remarks: validatedData.remarks,
          bankInfo: validatedData.bankInfo,
          userId: user.id,
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

      // ✅ 退款完成即入账：同步一笔「退款」流水到往来账
      if (refund.customerId && toNumber(refund.processedAmount, 0) > 0) {
        await recordPartnerTransaction(
          {
            partnerId: refund.customerId,
            partnerName: refund.customer.name,
            partnerRole: 'customer',
            entityType: 'customer',
            transactionType: 'refund',
            amount: toNumber(refund.processedAmount, 0),
            referenceId: refund.id,
            referenceNumber: refund.refundNumber,
            description: `退款 ${refund.refundNumber} 入账`,
            userId: user.id,
            occurredAt: refund.processedDate ?? refund.refundDate,
            metadata: {
              source: 'refund_record',
              salesOrderId: refund.salesOrderId,
              returnOrderId: refund.returnOrderId ?? undefined,
              refundMethod: refund.refundMethod,
              refundType: refund.refundType,
              status: refund.status,
              triggeredBy: 'finance_refund:create',
            },
          },
          tx
        );
      }

      return refund;
    });

    // 发布财务事件
    await publishFinanceEvent({
      action: 'created',
      recordType: 'refund',
      recordId: newRefund.id,
      recordNumber: newRefund.refundNumber,
      amount: toNumber(newRefund.refundAmount),
      customerId: newRefund.customerId,
      customerName: newRefund.customer.name,
      userId: user.id,
    });

    return successResponse(newRefund, 201, '退款记录创建成功');
  },
  { permissions: ['finance:manage'] }
);

