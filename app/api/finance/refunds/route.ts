import { type NextRequest } from 'next/server';

import { successResponse, withAuth } from '@/lib/auth/api-helpers';
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
    const queryParams = {
      page: searchParams.get('page')
        ? parseInt(searchParams.get('page')!, 10)
        : undefined,
      pageSize: searchParams.get('pageSize')
        ? parseInt(searchParams.get('pageSize')!, 10)
        : undefined,
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
      return successResponse(
        null,
        '查询参数验证失败: ' + validationResult.error.issues[0]?.message
      );
    }

    const {
      page = 1,
      pageSize = 20,
      search,
      status,
      customerId,
      returnOrderId,
      salesOrderId,
      refundType,
      startDate,
      endDate,
      sortBy = 'createdAt',
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

    if (refundType) {
      where.refundType = refundType;
    }

    if (startDate || endDate) {
      where.refundDate = {};
      if (startDate) {
        (where.refundDate as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.refundDate as Record<string, unknown>).lte = new Date(endDate);
      }
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
    const skip = (page - 1) * pageSize;

    // 使用真实数据库查询退款记录
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
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.refundRecord.count({ where }),
    ]);

    // 格式化退款记录数据
    const formattedRefunds = refunds.map(refund => ({
      id: refund.id,
      refundNumber: refund.refundNumber,
      returnOrderId: refund.returnOrderId,
      returnOrderNumber: refund.returnOrderNumber,
      salesOrderId: refund.salesOrderId,
      salesOrderNumber: refund.salesOrder?.orderNumber || '',
      customerId: refund.customerId,
      customerName: refund.customer?.name || '',
      refundType: refund.refundType,
      refundMethod: refund.refundMethod,
      refundAmount: refund.refundAmount,
      processedAmount: refund.processedAmount,
      remainingAmount: refund.remainingAmount,
      status: refund.status,
      refundDate: refund.refundDate.toISOString().split('T')[0],
      processedDate: refund.processedDate?.toISOString().split('T')[0] || null,
      reason: refund.reason,
      remarks: refund.remarks,
      bankInfo: refund.bankInfo,
      receiptNumber: refund.receiptNumber,
      createdAt: refund.createdAt.toISOString(),
      updatedAt: refund.updatedAt.toISOString(),
      customer: refund.customer,
      salesOrder: refund.salesOrder,
      user: refund.user,
    }));

    return successResponse({
      refunds: formattedRefunds,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
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
            status: { in: ['pending', 'processing', 'completed'] },
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

      // 4. 检查是否已经有相同的退款记录
      const existingRefund = await tx.refundRecord.findFirst({
        where: {
          salesOrderId: validatedData.salesOrderId,
          returnOrderId: validatedData.returnOrderId,
          status: { in: ['pending', 'processing', 'completed'] },
        },
      });
      if (existingRefund) {
        throw new Error('该订单已存在退款记录');
      }

      // 5. 生成退款单号
      const refundNumber = `RT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // 6. 创建退款记录
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
          processedAmount: 0,
          remainingAmount: validatedData.refundAmount,
          status: 'pending',
          refundDate: new Date(validatedData.refundDate),
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

    return successResponse(newRefund, '退款记录创建成功');
  },
  { permissions: ['finance:manage'] }
);
