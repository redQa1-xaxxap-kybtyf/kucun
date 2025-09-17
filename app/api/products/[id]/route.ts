import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { productValidations } from '@/lib/validations/database';

// 获取单个产品信息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析动态路由参数 (Next.js 15.4 要求)
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        specification: true,
        specifications: true,
        unit: true,
        piecesPerUnit: true,
        weight: true,
        status: true,
        categoryId: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: '产品不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error('获取产品信息错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取产品信息失败',
      },
      { status: 500 }
    );
  }
}

// 更新产品信息
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析动态路由参数 (Next.js 15.4 要求)
    const { id } = await params;

    const body = await request.json();

    // 验证输入数据
    const validationResult = productValidations.update.safeParse({
      id,
      ...body,
    });
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

    const {
      code,
      name,
      specification,
      specifications,
      unit,
      piecesPerUnit,
      weight,
      status,
    } = validationResult.data;

    // 检查产品是否存在
    const existingProduct = await prisma.product.findUnique({
      where: { id: params.id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '产品不存在' },
        { status: 404 }
      );
    }

    // 如果更新产品编码，检查是否与其他产品冲突
    if (code && code !== existingProduct.code) {
      const codeConflict = await prisma.product.findUnique({
        where: { code },
      });

      if (codeConflict) {
        return NextResponse.json(
          { success: false, error: '产品编码已存在' },
          { status: 400 }
        );
      }
    }

    // 更新产品信息
    const updatedProduct = await prisma.product.update({
      where: { id: params.id },
      data: {
        ...(code && { code }),
        ...(name && { name }),
        ...(specification !== undefined && { specification }),
        ...(specifications !== undefined && {
          specifications: specifications
            ? JSON.stringify(specifications)
            : null,
        }),
        ...(unit && { unit }),
        ...(piecesPerUnit !== undefined && { piecesPerUnit }),
        ...(weight !== undefined && { weight }),
        ...(status && { status }),
      },
      select: {
        id: true,
        code: true,
        name: true,
        specification: true,
        specifications: true,
        unit: true,
        piecesPerUnit: true,
        weight: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 转换数据格式
    const formattedProduct = {
      id: updatedProduct.id,
      code: updatedProduct.code,
      name: updatedProduct.name,
      specification: updatedProduct.specification,
      specifications: updatedProduct.specifications
        ? JSON.parse(updatedProduct.specifications as string)
        : null,
      unit: updatedProduct.unit,
      piecesPerUnit: updatedProduct.piecesPerUnit,
      weight: updatedProduct.weight,
      status: updatedProduct.status,
      createdAt: updatedProduct.createdAt,
      updatedAt: updatedProduct.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: formattedProduct,
      message: '产品信息更新成功',
    });
  } catch (error) {
    console.error('更新产品信息错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新产品信息失败',
      },
      { status: 500 }
    );
  }
}

// 删除产品（检查关联后禁止删除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析动态路由参数 (Next.js 15.4 要求)
    const { id } = await params;

    // 检查产品是否存在
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        inventory: true,
        salesOrderItems: true,
        inboundRecords: true,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { success: false, error: '产品不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联数据
    if (existingProduct.inventory.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `该产品有 ${existingProduct.inventory.length} 条库存记录，无法删除`,
        },
        { status: 400 }
      );
    }

    if (existingProduct.salesOrderItems.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `该产品有 ${existingProduct.salesOrderItems.length} 条销售记录，无法删除`,
        },
        { status: 400 }
      );
    }

    if (existingProduct.inboundRecords.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `该产品有 ${existingProduct.inboundRecords.length} 条入库记录，无法删除`,
        },
        { status: 400 }
      );
    }

    // 删除产品
    await prisma.product.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: '产品删除成功',
    });
  } catch (error) {
    console.error('删除产品错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除产品失败',
      },
      { status: 500 }
    );
  }
}
