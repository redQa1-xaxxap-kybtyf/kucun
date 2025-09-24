import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  CreateSupplierSchema,
  SupplierQuerySchema,
} from '@/lib/schemas/supplier';
import type { Supplier } from '@/lib/types/supplier';

/**
 * GET /api/suppliers - 获取供应商列表
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const { page, limit, search, status, sortBy, sortOrder } =
      SupplierQuerySchema.parse(queryParams);

    // 构建查询条件
    const where: Prisma.SupplierWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // 计算分页
    const skip = (page - 1) * limit;

    // 执行查询
    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    // 转换数据格式（snake_case -> camelCase）
    const transformedSuppliers: Supplier[] = suppliers.map(supplier => ({
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address,
      status: supplier.status as 'active' | 'inactive',
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: transformedSuppliers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取供应商列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取供应商列表失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/suppliers - 创建新供应商
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const validatedData = CreateSupplierSchema.parse(body);

    // 检查供应商名称是否已存在
    const existingSupplier = await prisma.supplier.findFirst({
      where: { name: validatedData.name },
    });

    if (existingSupplier) {
      return NextResponse.json(
        { success: false, error: '供应商名称已存在' },
        { status: 400 }
      );
    }

    // 创建供应商
    const supplier = await prisma.supplier.create({
      data: {
        name: validatedData.name,
        phone: validatedData.phone || null,
        address: validatedData.address || null,
        status: 'active',
      },
    });

    // 转换数据格式
    const transformedSupplier: Supplier = {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      address: supplier.address,
      status: supplier.status as 'active' | 'inactive',
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: transformedSupplier,
      message: '供应商创建成功',
    });
  } catch (error) {
    console.error('创建供应商失败:', error);

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { success: false, error: '供应商名称已存在' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建供应商失败',
      },
      { status: 500 }
    );
  }
}
