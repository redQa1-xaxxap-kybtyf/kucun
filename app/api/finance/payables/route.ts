// 应付款记录 API 路由
// 遵循 Next.js 15.4 App Router 架构和全局约定规范

import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
// import { paginationConfig } from '@/lib/env'; // 未使用
import type {
  PayableRecordDetail,
  PayableRecordListResponse,
} from '@/lib/types/payable';
import {
  createPayableRecordSchema,
  payableRecordQuerySchema,
} from '@/lib/validations/payable';

/**
 * GET /api/finance/payables - 获取应付款记录列表
 */
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const searchParams = new URL(request.url).searchParams;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validationResult = payableRecordQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数验证失败',
          details: validationResult.error.errors,
        },
        { status: 400 }
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
    const where: any = {};

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

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('获取应付款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取应付款记录失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/finance/payables - 创建应付款记录
 */
export async function POST(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const validationResult = createPayableRecordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '数据验证失败',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // 验证供应商是否存在
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
      select: { id: true, name: true, status: true },
    });

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: '供应商不存在' },
        { status: 404 }
      );
    }

    if (supplier.status !== 'active') {
      return NextResponse.json(
        { success: false, error: '供应商状态异常，无法创建应付款' },
        { status: 400 }
      );
    }

    // 生成应付款单号(使用数据库序列表确保并发安全)
    const payableNumber = await generatePayableNumber();

    // 创建应付款记录
    const payable = await prisma.payableRecord.create({
      data: {
        ...data,
        payableNumber,
        userId: session.user.id,
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

    return NextResponse.json({
      success: true,
      data: payable,
      message: '应付款记录创建成功',
    });
  } catch (error) {
    console.error('创建应付款记录失败:', error);
    return NextResponse.json(
      { success: false, error: '创建应付款记录失败' },
      { status: 500 }
    );
  }
}
