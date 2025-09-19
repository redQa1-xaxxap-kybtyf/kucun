import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma, withTransaction } from '@/lib/db';
import {
  inboundRecordValidations,
  paginationValidations,
} from '@/lib/validations/base';

// 生成入库单号
function generateRecordNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const timestamp = now.getTime().toString().slice(-6);
  return `IN${year}${month}${day}${timestamp}`;
}

// 获取入库记录列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
      type: searchParams.get('type') || undefined,
      productId: searchParams.get('productId') || undefined,
      userId: searchParams.get('userId') || undefined,
    };

    // 验证查询参数
    const validationResult = paginationValidations.query.safeParse(queryParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { page, limit, search, sortBy, sortOrder } = validationResult.data;
    const { type, productId, userId } = queryParams;

    // 构建查询条件
    const where: any = {};

    if (search) {
      where.OR = [
        { recordNumber: { contains: search } },
        { product: { code: { contains: search } } },
        { product: { name: { contains: search } } },
        { colorCode: { contains: search } },
        { remarks: { contains: search } },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (productId) {
      where.productId = productId;
    }

    if (userId) {
      where.userId = userId;
    }

    // 查询入库记录列表
    const [inboundRecords, total] = await Promise.all([
      prisma.inboundRecord.findMany({
        where,
        select: {
          id: true,
          recordNumber: true,
          productId: true,
          userId: true,
          type: true,
          colorCode: true,
          productionDate: true,
          quantity: true,
          remarks: true,
          createdAt: true,
          product: {
            select: {
              id: true,
              code: true,
              name: true,
              specification: true,
              unit: true,
              piecesPerUnit: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { [sortBy as string]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inboundRecord.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // 转换数据格式（snake_case -> camelCase）
    const formattedRecords = inboundRecords.map(record => ({
      id: record.id,
      recordNumber: record.recordNumber,
      productId: record.productId,
      userId: record.userId,
      type: record.type,
      colorCode: record.colorCode,
      productionDate: record.productionDate,
      quantity: record.quantity,
      remarks: record.remarks,
      product: record.product,
      user: record.user,
      createdAt: record.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedRecords,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('获取入库记录列表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取入库记录列表失败',
      },
      { status: 500 }
    );
  }
}

// 创建入库记录
export async function POST(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = inboundRecordValidations.create.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { productId, type, colorCode, productionDate, quantity, remarks } =
      validationResult.data;

    // 验证产品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: '指定的产品不存在' },
        { status: 400 }
      );
    }

    if (product.status !== 'active') {
      return NextResponse.json(
        { success: false, error: '产品已停用，无法入库' },
        { status: 400 }
      );
    }

    // 生成入库单号
    const recordNumber = generateRecordNumber();

    // 使用事务创建入库记录并更新库存
    const result = await withTransaction(async tx => {
      // 创建入库记录
      const inboundRecord = await tx.inboundRecord.create({
        data: {
          recordNumber,
          productId,
          userId: session.user.id,
          type,
          colorCode,
          productionDate: productionDate ? new Date(productionDate) : null,
          quantity,
          remarks,
        },
      });

      // 查找或创建对应的库存记录
      let inventory = await tx.inventory.findFirst({
        where: {
          productId,
          colorCode,
          productionDate: productionDate ? new Date(productionDate) : null,
        },
      });

      if (inventory) {
        // 更新现有库存
        inventory = await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: inventory.quantity + quantity,
          },
        });
      } else {
        // 创建新的库存记录
        inventory = await tx.inventory.create({
          data: {
            productId,
            colorCode,
            productionDate: productionDate ? new Date(productionDate) : null,
            quantity,
            reservedQuantity: 0,
          },
        });
      }

      return { inboundRecord, inventory };
    });

    // 获取完整的入库记录信息
    const fullRecord = await prisma.inboundRecord.findUnique({
      where: { id: result.inboundRecord.id },
      select: {
        id: true,
        recordNumber: true,
        productId: true,
        userId: true,
        type: true,
        colorCode: true,
        productionDate: true,
        quantity: true,
        remarks: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            specification: true,
            unit: true,
            piecesPerUnit: true,
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

    // 转换数据格式
    const formattedRecord = {
      id: fullRecord!.id,
      recordNumber: fullRecord!.recordNumber,
      productId: fullRecord!.productId,
      userId: fullRecord!.userId,
      type: fullRecord!.type,
      colorCode: fullRecord!.colorCode,
      productionDate: fullRecord!.productionDate,
      quantity: fullRecord!.quantity,
      remarks: fullRecord!.remarks,
      product: fullRecord!.product,
      user: fullRecord!.user,
      createdAt: fullRecord!.createdAt,
    };

    return NextResponse.json({
      success: true,
      data: formattedRecord,
      message: '入库记录创建成功，库存已更新',
    });
  } catch (error) {
    console.error('创建入库记录错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建入库记录失败',
      },
      { status: 500 }
    );
  }
}
