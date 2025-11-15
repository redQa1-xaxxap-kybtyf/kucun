import { type NextRequest } from 'next/server';

import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { publishFinanceEvent } from '@/lib/events';
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
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const limitParam =
      searchParams.get('limit') ?? searchParams.get('pageSize');
    const queryParams = {
      page: pageParam ? Number.parseInt(pageParam, 10) : undefined,
      limit: limitParam ? Number.parseInt(limitParam, 10) : undefined,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      returnOrderId: searchParams.get('returnOrderId') || undefined,
      salesOrderId: searchParams.get('salesOrderId') || undefined,
      refundType: searchParams.get('refundType') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
    };

    // 使用 Zod schema 验证
    const validationResult = refundQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return errorResponse(
        `查询参数验证失败: ${validationResult.error.issues[0]?.message}`,
        400
      );
    }

    const {
      page = 1,
      limit = 20,
      search,
      status,
      customerId,
      returnOrderId,
      salesOrderId,
      refundType,
      startDate,
      endDate,
      sortBy = 'refundDate',
      sortOrder = 'desc',
    } = validationResult.data;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { refundNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { reason: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (returnOrderId) {
      where.returnOrderId = returnOrderId;
    }

    if (salesOrderId) {
      where.salesOrderId = salesOrderId;
    }

    if (refundType) {
      where.refundType = refundType;
    }

    if (startDate || endDate) {
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        const endDateValue = new Date(endDate);
        endDateValue.setHours(23, 59, 59, 999);
        dateFilter.lte = endDateValue;
      }
      where.refundDate = dateFilter;
    }

    // 构建排序条件
    type OrderByType =
      | Record<string, 'asc' | 'desc'>
      | { customer: { name: 'asc' | 'desc' } };
    let orderBy: OrderByType;

    // customerName is not in the enum, but we handle it separately
    if (sortBy === ('customerName' as typeof sortBy)) {
      orderBy = { customer: { name: sortOrder } };
    } else {
      orderBy = { [sortBy]: sortOrder };
    }

    // 计算分页
    const skip = (page - 1) * limit;

    // ✅ P0修复: 使用聚合查询替代全表扫描
    const [refunds, total, aggregateResult] = await Promise.all([
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
          returnOrder: {
            select: {
              id: true,
              returnNumber: true,
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
        orderBy,
        skip,
        take: limit,
      }),
      prisma.refundRecord.count({ where }),
      // ✅ P0修复: 使用聚合查询替代全表扫描
      prisma.refundRecord.aggregate({
        where,
        _sum: {
          refundAmount: true,
          processedAmount: true,
          remainingAmount: true,
        },
      }),
    ]);

    // ✅ P0修复: 使用 groupBy 按状态统计数量
    const statusCounts = await prisma.refundRecord.groupBy({
      by: ['status'],
      where,
      _count: {
        _all: true,
      },
    });

    // 格式化退款记录数据
    const formattedRefunds = refunds.map(refund => ({
      id: refund.id,
      refundNumber: refund.refundNumber,
      returnOrderId: refund.returnOrderId,
      returnOrderNumber:
        refund.returnOrder?.returnNumber || refund.returnOrderNumber,
      salesOrderId: refund.salesOrderId,
      salesOrderNumber: refund.salesOrder?.orderNumber || '',
      customerId: refund.customerId,
      customerName: refund.customer?.name || '',
      refundType: refund.refundType,
      refundMethod: refund.refundMethod,
      refundAmount: Number(refund.refundAmount),
      processedAmount: Number(refund.processedAmount),
      remainingAmount: Number(refund.remainingAmount),
      status: refund.status,
      refundDate: refund.refundDate.toISOString().split('T')[0],
      processedDate: refund.processedDate?.toISOString().split('T')[0] || null,
      reason: refund.reason,
      remarks: refund.remarks,
      bankInfo: refund.bankInfo,
      receiptNumber: refund.receiptNumber,
      createdAt: refund.createdAt.toISOString(),
      updatedAt: refund.updatedAt.toISOString(),
      customer: refund.customer
        ? {
            ...refund.customer,
          }
        : null,
      salesOrder: refund.salesOrder
        ? {
            ...refund.salesOrder,
            totalAmount: Number(refund.salesOrder.totalAmount),
          }
        : null,
      returnOrder: refund.returnOrder
        ? {
            id: refund.returnOrder.id,
            returnOrderNumber: refund.returnOrder.returnNumber,
            totalAmount: Number(refund.returnOrder.totalAmount ?? 0),
            status: refund.returnOrder.status ?? undefined,
          }
        : null,
      user: refund.user,
    }));

    // ✅ P0修复: 从聚合结果构建统计数据
    const totalRefundable = Number(aggregateResult._sum.refundAmount ?? 0);
    const totalProcessed = Number(aggregateResult._sum.processedAmount ?? 0);
    const totalRemaining = Number(aggregateResult._sum.remainingAmount ?? 0);
    const pendingCount =
      statusCounts.find(s => s.status === 'pending')?._count._all ?? 0;
    const processingCount =
      statusCounts.find(s => s.status === 'processing')?._count._all ?? 0;
    const completedCount =
      statusCounts.find(s => s.status === 'completed')?._count._all ?? 0;

    return successResponse({
      refunds: formattedRefunds,
      statistics: {
        totalRefundable,
        totalProcessed,
        totalRemaining,
        pendingCount,
        processingCount,
        completedCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
          throw new Error('退货订单ID和退货订单号必须同时提供');
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

      const totalRefundAmount =
        (existingRefunds._sum.refundAmount || 0) + validatedData.refundAmount;

      if (totalRefundAmount > salesOrderWithRefunds.totalAmount) {
        throw new Error(
          `退款总额(￥${totalRefundAmount.toFixed(2)})不能超过订单金额(￥${salesOrderWithRefunds.totalAmount.toFixed(2)})`
        );
      }

      // 6. 生成退款单号
      const refundNumber = `RT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // 7. 创建退款记录（进销存系统：退款是记录已发生的事实，直接标记为已完成）
      return await tx.refundRecord.create({
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
    });

    // 发布财务事件
    await publishFinanceEvent({
      action: 'created',
      recordType: 'refund',
      recordId: newRefund.id,
      recordNumber: newRefund.refundNumber,
      amount: newRefund.refundAmount,
      customerId: newRefund.customerId,
      customerName: newRefund.customer.name,
      userId: user.id,
    });

    return successResponse(newRefund, 201, '退款记录创建成功');
  },
  { permissions: ['finance:manage'] }
);
