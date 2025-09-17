import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// 批量创建产品变体输入验证
const BatchCreateVariantsSchema = z.object({
  productId: z.string().uuid('产品ID格式不正确'),
  variants: z.array(
    z.object({
      colorCode: z.string().min(1, '色号不能为空').max(20, '色号不能超过20个字符'),
      colorName: z.string().max(50, '色号名称不能超过50个字符').optional(),
      colorValue: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '颜色值格式不正确').optional(),
      sku: z.string().max(50, 'SKU不能超过50个字符').optional(),
    })
  ).min(1, '至少需要一个变体').max(50, '批量创建最多支持50个变体'),
});

// 批量操作输入验证
const BatchOperationSchema = z.object({
  operation: z.enum(['delete', 'activate', 'deactivate']),
  variantIds: z.array(z.string().uuid('变体ID格式不正确')).min(1, '至少需要选择一个变体').max(100, '批量操作最多支持100个变体'),
});

// 批量创建产品变体
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

    // 检查是否为批量操作
    if (body.operation) {
      return handleBatchOperation(body);
    }

    // 验证批量创建输入数据
    const validationResult = BatchCreateVariantsSchema.safeParse(body);
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

    const { productId, variants } = validationResult.data;

    // 验证产品是否存在
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, code: true, name: true, status: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: '产品不存在' },
        { status: 404 }
      );
    }

    if (product.status !== 'active') {
      return NextResponse.json(
        { success: false, error: '产品已停用，无法创建变体' },
        { status: 400 }
      );
    }

    // 检查色号重复
    const colorCodes = variants.map(v => v.colorCode);
    const uniqueColorCodes = new Set(colorCodes);
    if (colorCodes.length !== uniqueColorCodes.size) {
      return NextResponse.json(
        { success: false, error: '批量创建中存在重复的色号' },
        { status: 400 }
      );
    }

    // 检查数据库中是否已存在相同色号的变体
    const existingVariants = await prisma.productVariant.findMany({
      where: {
        productId,
        colorCode: { in: colorCodes },
      },
      select: { colorCode: true },
    });

    if (existingVariants.length > 0) {
      const existingColorCodes = existingVariants.map(v => v.colorCode);
      return NextResponse.json(
        {
          success: false,
          error: `以下色号已存在变体: ${existingColorCodes.join(', ')}`,
        },
        { status: 409 }
      );
    }

    // 生成SKU并检查重复
    const variantsWithSku = variants.map(variant => ({
      ...variant,
      sku: variant.sku || `${product.code}-${variant.colorCode}`,
    }));

    const skus = variantsWithSku.map(v => v.sku);
    const uniqueSkus = new Set(skus);
    if (skus.length !== uniqueSkus.size) {
      return NextResponse.json(
        { success: false, error: '批量创建中存在重复的SKU' },
        { status: 400 }
      );
    }

    // 检查数据库中是否已存在相同SKU
    const existingSkus = await prisma.productVariant.findMany({
      where: {
        sku: { in: skus },
      },
      select: { sku: true },
    });

    if (existingSkus.length > 0) {
      const existingSkuList = existingSkus.map(v => v.sku);
      return NextResponse.json(
        {
          success: false,
          error: `以下SKU已存在: ${existingSkuList.join(', ')}`,
        },
        { status: 409 }
      );
    }

    // 使用事务批量创建变体
    const createdVariants = await prisma.$transaction(async (tx) => {
      const results = [];
      
      for (const variant of variantsWithSku) {
        const created = await tx.productVariant.create({
          data: {
            productId,
            colorCode: variant.colorCode,
            colorName: variant.colorName,
            colorValue: variant.colorValue,
            sku: variant.sku,
            status: 'active',
          },
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                status: true,
              },
            },
          },
        });
        
        results.push(created);
      }
      
      return results;
    });

    // 转换数据格式
    const formattedVariants = createdVariants.map(variant => ({
      id: variant.id,
      productId: variant.productId,
      colorCode: variant.colorCode,
      colorName: variant.colorName,
      colorValue: variant.colorValue,
      sku: variant.sku,
      status: variant.status,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
      product: variant.product,
      totalInventory: 0,
      reservedInventory: 0,
      availableInventory: 0,
    }));

    return NextResponse.json({
      success: true,
      data: formattedVariants,
      message: `成功创建 ${formattedVariants.length} 个产品变体`,
    });
  } catch (error) {
    console.error('批量创建产品变体错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '批量创建产品变体失败',
      },
      { status: 500 }
    );
  }
}

// 处理批量操作
async function handleBatchOperation(body: any) {
  try {
    // 验证批量操作输入数据
    const validationResult = BatchOperationSchema.safeParse(body);
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

    const { operation, variantIds } = validationResult.data;

    // 检查变体是否存在
    const existingVariants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, colorCode: true, status: true },
    });

    if (existingVariants.length !== variantIds.length) {
      return NextResponse.json(
        { success: false, error: '部分变体不存在' },
        { status: 404 }
      );
    }

    let results: any[] = [];

    switch (operation) {
      case 'delete':
        // 检查是否有库存
        const variantsWithInventory = await prisma.inventory.findMany({
          where: {
            variantId: { in: variantIds },
            quantity: { gt: 0 },
          },
          select: { variantId: true },
        });

        if (variantsWithInventory.length > 0) {
          return NextResponse.json(
            { success: false, error: '部分变体仍有库存，无法删除' },
            { status: 400 }
          );
        }

        // 使用事务删除
        await prisma.$transaction(async (tx) => {
          // 删除库存记录
          await tx.inventory.deleteMany({
            where: { variantId: { in: variantIds } },
          });

          // 删除变体
          await tx.productVariant.deleteMany({
            where: { id: { in: variantIds } },
          });
        });

        results = variantIds.map(id => ({ id, operation: 'deleted' }));
        break;

      case 'activate':
        await prisma.productVariant.updateMany({
          where: { id: { in: variantIds } },
          data: { status: 'active' },
        });

        results = variantIds.map(id => ({ id, operation: 'activated' }));
        break;

      case 'deactivate':
        await prisma.productVariant.updateMany({
          where: { id: { in: variantIds } },
          data: { status: 'inactive' },
        });

        results = variantIds.map(id => ({ id, operation: 'deactivated' }));
        break;

      default:
        return NextResponse.json(
          { success: false, error: '不支持的操作类型' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: `成功${operation === 'delete' ? '删除' : operation === 'activate' ? '激活' : '停用'} ${results.length} 个产品变体`,
    });
  } catch (error) {
    console.error('批量操作产品变体错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '批量操作产品变体失败',
      },
      { status: 500 }
    );
  }
}
