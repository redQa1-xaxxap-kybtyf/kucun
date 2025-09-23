import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { statementQuerySchema } from '@/lib/validations/statement';

/**
 * GET /api/statements - 获取往来账单列表
 * 支持分页、搜索、筛选等查询参数
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
    const queryResult = statementQuerySchema.safeParse({
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
      search: searchParams.get('search') || undefined,
      entityType: searchParams.get('entityType') || undefined,
      status: searchParams.get('status') || undefined,
      overdueOnly: searchParams.get('overdueOnly') === 'true',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    if (!queryResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数验证失败',
          details: queryResult.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      page,
      pageSize,
      search,
      entityType,
      status,
      overdueOnly,
      startDate,
      endDate,
    } = queryResult.data;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { entityName: { contains: search } },
        { paymentTerms: { contains: search } },
      ];
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (status) {
      where.status = status;
    }

    if (overdueOnly) {
      where.overdueAmount = { gt: 0 };
    }

    if (startDate || endDate) {
      where.lastTransactionDate = {};
      if (startDate) {
        where.lastTransactionDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.lastTransactionDate.lte = new Date(endDate);
      }
    }

    // 查询数据
    const [statements, total] = await Promise.all([
      prisma.accountStatement.findMany({
        where,
        include: {
          transactions: {
            orderBy: {
              transactionDate: 'desc',
            },
            take: 5, // 只返回最近5条交易记录
          },
        },
        orderBy: {
          lastTransactionDate: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.accountStatement.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        statements,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('获取往来账单失败:', error);
    return NextResponse.json(
      { success: false, error: '获取往来账单失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/statements - 创建往来账单
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
    const { entityId, entityName, entityType, creditLimit, paymentTerms } =
      body;

    // 基本验证
    if (!entityId || !entityName || !entityType) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 检查是否已存在账单
    const existingStatement = await prisma.accountStatement.findFirst({
      where: {
        entityId,
        entityType,
      },
    });

    if (existingStatement) {
      return NextResponse.json(
        { success: false, error: '该实体的账单已存在' },
        { status: 400 }
      );
    }

    // 创建往来账单
    const statement = await prisma.accountStatement.create({
      data: {
        entityId,
        entityName,
        entityType,
        creditLimit: creditLimit || 0,
        paymentTerms: paymentTerms || '30天',
      },
      include: {
        transactions: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: statement,
      message: '往来账单创建成功',
    });
  } catch (error) {
    console.error('创建往来账单失败:', error);
    return NextResponse.json(
      { success: false, error: '创建往来账单失败' },
      { status: 500 }
    );
  }
}
