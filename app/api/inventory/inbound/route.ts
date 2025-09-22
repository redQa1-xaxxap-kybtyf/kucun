// 产品入库API路由
// 提供入库记录的CRUD操作接口

import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

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
    const where: Record<string, string | number | boolean | object> = {};

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
        reason: record.reason as string,
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

    // 详细错误日志
    if (error instanceof Error) {
      console.error('错误详情:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: '获取入库记录失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
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
      console.error('入库API: 未授权访问');
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求数据
    const body = await request.json();
    console.log('入库API: 接收到请求数据', body);

    const validatedData = createInboundSchema.parse(body);
    console.log('入库API: 数据验证通过', validatedData);

    const {
      productId,
      variantId,
      quantity,
      reason,
      remarks,
      productionDate,
      batchNumber,
      colorCode,
      unitCost,
      location,
    } = validatedData;

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

    // 验证产品变体（如果提供了variantId）
    if (variantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, productId: true, colorCode: true, status: true },
      });

      if (!variant) {
        return NextResponse.json(
          { success: false, error: '产品变体不存在' },
          { status: 404 }
        );
      }

      if (variant.productId !== productId) {
        return NextResponse.json(
          { success: false, error: '产品变体与产品不匹配' },
          { status: 400 }
        );
      }

      if (variant.status !== 'active') {
        return NextResponse.json(
          { success: false, error: '产品变体已停用，无法入库' },
          { status: 400 }
        );
      }
    }

    // 创建入库记录
    const record = await prisma.inboundRecord.create({
      data: {
        recordNumber,
        productId,
        variantId,
        quantity: formatQuantity(quantity),
        reason,
        remarks: cleanRemarks(remarks),
        userId: session.user.id,
        // 批次管理字段
        productionDate: productionDate ? new Date(productionDate) : null,
        batchNumber: batchNumber?.trim() || null,
        colorCode: colorCode?.trim() || null,
        unitCost,
        location: location?.trim() || null,
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

    // 更新库存 - 支持批次管理
    try {
      // 构建库存查询条件
      const inventoryWhere = {
        productId,
        variantId: variantId || null,
        productionDate: productionDate ? new Date(productionDate) : null,
        batchNumber: batchNumber?.trim() || null,
      };

      // 查找现有库存记录
      const existingInventory = await prisma.inventory.findFirst({
        where: inventoryWhere,
      });

      if (existingInventory) {
        // 更新现有库存
        await prisma.inventory.update({
          where: { id: existingInventory.id },
          data: {
            quantity: {
              increment: formatQuantity(quantity),
            },
            // 更新单位成本（如果提供）
            ...(unitCost !== undefined && { unitCost }),
            // 更新存储位置（如果提供）
            ...(location && { location: location.trim() }),
          },
        });
      } else {
        // 创建新库存记录
        await prisma.inventory.create({
          data: {
            productId,
            variantId: variantId || null,
            quantity: formatQuantity(quantity),
            reservedQuantity: 0,
            productionDate: productionDate ? new Date(productionDate) : null,
            batchNumber: batchNumber?.trim() || null,
            colorCode: colorCode?.trim() || null,
            unitCost,
            location: location?.trim() || null,
          },
        });
      }
    } catch (inventoryError) {
      console.error('库存更新失败:', inventoryError);
      // 即使库存更新失败，入库记录已创建，返回警告而不是错误
    }

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

    // 详细错误日志
    if (error instanceof Error) {
      console.error('错误详情:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        {
          success: false,
          error: '记录编号重复，请重试',
          details: '系统生成的记录编号已存在',
        },
        { status: 409 }
      );
    }

    if (
      error instanceof Error &&
      error.message.includes('Foreign key constraint')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: '产品信息无效',
          details: '指定的产品不存在或已被删除',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建入库记录失败',
        details: '请检查输入数据或联系系统管理员',
      },
      { status: 500 }
    );
  }
}
