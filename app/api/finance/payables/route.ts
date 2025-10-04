// 应付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest } from 'next/server';

import { successResponse, withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import type {
  PayableRecordDetail,
  PayableRecordListResponse,
} from '@/lib/types/payable';
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
    const validationResult = payableRecordQuerySchema.safeParse(queryParams);

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
      supplierId,
      status,
      sourceType,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = validationResult.data;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { payableNumber: { contains: search } },
        { supplier: { name: { contains: search } } },
        { sourceNumber: { contains: search } },
      ];
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (status) {
      where.status = status;
    }

    if (sourceType) {
      where.sourceType = sourceType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // 计算分页
    const skip = (page - 1) * limit;

    // 查询应付款记录
    const [payables, total] = await Promise.all([
      prisma.payableRecord.findMany({
        where,
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
          paymentOutRecords: {
            where: {
              status: 'confirmed',
            },
            select: {
              id: true,
              paymentNumber: true,
              paymentAmount: true,
              paymentDate: true,
              paymentMethod: true,
            },
            orderBy: {
              paymentDate: 'desc',
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),
      prisma.payableRecord.count({ where }),
    ]);

    const response: PayableRecordListResponse = {
      data: payables as PayableRecordDetail[],
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
 * POST /api/finance/payables - 创建应付款记录
 * 权限：需要 finance:manage 权限
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    // 解析请求体
    const body = await request.json();
    const validationResult = createPayableRecordSchema.safeParse(body);

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
      return successResponse(null, '供应商状态异常，无法创建应付款');
    }

    // 生成应付款单号(使用数据库序列表确保并发安全)
    const payableNumber = await generatePayableNumber();

    // 创建应付款记录
    const payable = await prisma.payableRecord.create({
      data: {
        ...data,
        payableNumber,
        userId: user.id,
        remainingAmount: data.payableAmount,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
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

    return successResponse(payable, '应付款记录创建成功');
  },
  { permissions: ['finance:manage'] }
);
