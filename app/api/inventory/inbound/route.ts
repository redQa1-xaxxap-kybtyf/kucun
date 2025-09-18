// 产品入库API路由
// 提供入库记录的CRUD操作接口

import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { InboundListResponse } from '@/lib/types/inbound';
import {
  cleanRemarks,
  createInboundSchema,
  formatQuantity,
  inboundQuerySchema,
} from '@/lib/validations/inbound';

// 生成入库记录编号
function generateRecordNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `IN${dateStr}${timeStr}${random}`;
}

// GET /api/inventory/inbound - 获取入库记录列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryData = inboundQuerySchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search'),
      productId: searchParams.get('productId'),
      reason: searchParams.get('reason'),
      userId: searchParams.get('userId'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
    });

    const {
      page,
      limit,
      search,
      productId,
      reason,
      userId,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = queryData;

    // 构建查询条件
    const where: Record<string, any> = {};

    if (productId) {
      where.productId = productId;
    }

    if (reason) {
      where.reason = reason;
    }

    if (userId) {
      where.userId = userId;
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

    if (search) {
      where.OR = [
        { recordNumber: { contains: search } },
        { remarks: { contains: search } },
        { product: { name: { contains: search } } },
        { product: { code: { contains: search } } },
      ];
    }

    // 查询入库记录列表
    const [records, total] = await Promise.all([
      prisma.inboundRecord.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              specification: true,
              unit: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inboundRecord.count({ where }),
    ]);

    const response: InboundListResponse = {
      data: records.map(record => ({
        id: record.id,
        recordNumber: record.recordNumber,
        productId: record.productId,
        quantity: record.quantity,
        reason: record.reason as any,
        remarks: record.remarks || undefined,
        userId: record.userId,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        product: record.product,
        user: record.user,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    return NextResponse.json({
      success: true,
      data: response.data,
      pagination: response.pagination,
    });
  } catch (error) {
    console.error('获取入库记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取入库记录失败' },
      { status: 500 }
    );
  }
}

// POST /api/inventory/inbound - 创建入库记录
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求数据
    const body = await request.json();
    const validatedData = createInboundSchema.parse(body);

    const { productId, quantity, reason, remarks } = validatedData;

    // 验证产品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, status: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: '产品不存在' },
        { status: 404 }
      );
    }

    if (product.status !== 'active') {
      return NextResponse.json(
        { success: false, error: '产品已停用，无法入库' },
        { status: 400 }
      );
    }

    // 生成记录编号
    const recordNumber = generateRecordNumber();

    // 创建入库记录
    const record = await prisma.inboundRecord.create({
      data: {
        recordNumber,
        productId,
        quantity: formatQuantity(quantity),
        reason,
        remarks: cleanRemarks(remarks),
        userId: session.user.id,
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            specification: true,
            unit: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    // 更新库存（这里需要根据实际业务逻辑调整）
    // 暂时简化处理，实际应该考虑批次、变体等
    await prisma.inventory.upsert({
      where: {
        productId_variantId_colorCode_productionDate: {
          productId,
          variantId: null,
          colorCode: null,
          productionDate: null,
        },
      },
      update: {
        quantity: {
          increment: formatQuantity(quantity),
        },
      },
      create: {
        productId,
        quantity: formatQuantity(quantity),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: record.id,
        recordNumber: record.recordNumber,
        productId: record.productId,
        quantity: record.quantity,
        reason: record.reason,
        remarks: record.remarks || undefined,
        userId: record.userId,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        product: record.product,
        user: record.user,
      },
      message: '入库成功',
    });
  } catch (error) {
    console.error('创建入库记录失败:', error);

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { success: false, error: '记录编号重复，请重试' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: '创建入库记录失败' },
      { status: 500 }
    );
  }
}
