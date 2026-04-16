import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

import {
  buildOffsetPaginationMeta,
  parseOffsetPagination,
} from '@/lib/api/pagination';
import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { paginationConfig, returnRefundConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  createRefundRecordSchema,
  refundQuerySchema,
} from '@/lib/validations/refund';

/**
 * GET /api/refunds - 获取退款记录列表
 * 支持分页、搜索、筛选等查询参数
 */
export const GET = withAuth(async (request: NextRequest) => {
  try {
    // 解析查询参数
    const { searchParams } = request.nextUrl;
    const { page: parsedPage, limit: parsedLimit } =
      parseOffsetPagination(searchParams);
    const queryResult = refundQuerySchema.safeParse({
      page: parsedPage,
      limit: parsedLimit,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      refundType: searchParams.get('refundType') || undefined,
      refundMethod: searchParams.get('refundMethod') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      salesOrderId: searchParams.get('salesOrderId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询条件有误，请检查后重试',
          details: queryResult.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      page = 1,
      limit = paginationConfig.defaultPageSize,
      search,
      status,
      refundType,
      refundMethod,
      customerId,
      salesOrderId,
      startDate,
      endDate,
    } = queryResult.data;

    // 构建查询条件
    const where: Prisma.RefundRecordWhereInput = {};

    if (search) {
      where.OR = [
        { refundNumber: { contains: search } },
        { receiptNumber: { contains: search } },
        { reason: { contains: search } },
        { remarks: { contains: search } },
        { customer: { name: { contains: search } } },
        { salesOrder: { orderNumber: { contains: search } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (refundType) {
      where.refundType = refundType;
    }

    if (refundMethod) {
      where.refundMethod = refundMethod;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (salesOrderId) {
      where.salesOrderId = salesOrderId;
    }

    if (startDate || endDate) {
      where.refundDate = {};
      if (startDate) {
        where.refundDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.refundDate.lte = new Date(endDate);
      }
    }

    // 查询数据
    const skip = (page - 1) * limit;
    const [refunds, total] = await Promise.all([
      prisma.refundRecord.findMany({
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
        orderBy: [{ refundDate: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.refundRecord.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        refunds,
        pagination: buildOffsetPaginationMeta({ page, limit, total }),
      },
    });
  } catch (error) {
    logger.error('refunds', '获取退款记录失败', error, {
      url: request.url,
    });
    return NextResponse.json(
      { success: false, error: '获取退款记录失败' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/refunds - 创建退款记录
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  try {
    // 解析请求体
    const body = await request.json();
    const validationResult = createRefundRecordSchema.safeParse(body);

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

    // 验证销售订单是否存在
    const salesOrder = await prisma.salesOrder.findUnique({
      where: { id: data.salesOrderId },
      select: { id: true, customerId: true, totalAmount: true, status: true },
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

    // 生成退款单号
    const refundNumber = `${returnRefundConfig.refundOrderPrefix}${Date.now()}`;

    // 计算剩余金额
    const remainingAmount = data.refundAmount;

    // 创建退款记录
    const refund = await prisma.refundRecord.create({
      data: {
        ...data,
        refundNumber,
        userId: user.id,
        refundDate: new Date(data.refundDate),
        remainingAmount,
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

    return NextResponse.json({
      success: true,
      data: refund,
      message: '退款记录创建成功',
    });
  } catch (error) {
    logger.error('refunds', '创建退款记录失败', error, {
      userId: user.id,
    });
    return NextResponse.json(
      { success: false, error: '创建退款记录失败' },
      { status: 500 }
    );
  }
});

