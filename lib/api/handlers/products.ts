import type { Prisma } from '@prisma/client';
import type { z } from 'zod';

import { prisma } from '@/lib/db';
import { productUpdateSchema } from '@/lib/validations/product';

// 定义产品查询结果类型
type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    variants: true;
  };
}>;

type ProductVariantWithRelations = Prisma.ProductVariantGetPayload<{
  include: {
    product: true;
  };
}>;

/**
 * 根据ID获取产品详情
 */
export async function getProductById(id: string) {
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
      thickness: true,
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
      variants: {
        select: {
          id: true,
          sku: true,
          colorCode: true,
          productionDate: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      _count: {
        select: {
          variants: true,
          inventory: true,
          salesOrderItems: true,
          inboundRecords: true,
        },
      },
    },
  });

  if (!product) {
    return null;
  }

  return formatProduct(product);
}

/**
 * 更新产品信息
 */
export async function updateProduct(
  id: string,
  data: z.infer<typeof productUpdateSchema>,
  userId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null
) {
  // 验证数据
  const validatedData = productUpdateSchema.parse(data);

  // 检查产品是否存在
  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    throw new Error('产品不存在');
  }

  // 如果更新了分类，验证分类是否存在
  if (
    validatedData.categoryId &&
    validatedData.categoryId !== existingProduct.categoryId
  ) {
    const category = await prisma.category.findUnique({
      where: { id: validatedData.categoryId },
    });

    if (!category) {
      throw new Error('指定的分类不存在');
    }
  }

  // 更新产品
  const updatedProduct = await prisma.product.update({
    where: { id },
    data: {
      name: validatedData.name,
      specification: validatedData.specification,
      specifications: validatedData.specifications,
      unit: validatedData.unit,
      piecesPerUnit: validatedData.piecesPerUnit,
      weight: validatedData.weight,
      thickness: validatedData.thickness,
      categoryId: validatedData.categoryId,
      status: validatedData.status,
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
      thickness: true,
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
      variants: {
        select: {
          id: true,
          sku: true,
          colorCode: true,
          productionDate: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      _count: {
        select: {
          variants: true,
          inventory: true,
          salesOrderItems: true,
          inboundRecords: true,
        },
      },
    },
  });

  // 记录产品更新日志
  try {
    // 构建变更描述
    const changes: string[] = [];
    if (validatedData.name !== existingProduct.name) {
      changes.push(`名称: ${existingProduct.name} → ${validatedData.name}`);
    }
    if (validatedData.status !== existingProduct.status) {
      changes.push(`状态: ${existingProduct.status} → ${validatedData.status}`);
    }
    if (validatedData.categoryId !== existingProduct.categoryId) {
      changes.push(
        `分类ID: ${existingProduct.categoryId || '无'} → ${validatedData.categoryId || '无'}`
      );
    }

    const changeDescription =
      changes.length > 0
        ? `修改产品信息：${updatedProduct.name} (编码: ${updatedProduct.code}) - ${changes.join(', ')}`
        : `更新产品信息：${updatedProduct.name} (编码: ${updatedProduct.code})`;

    await logBusinessOperation(
      'update_product',
      changeDescription,
      userId,
      ipAddress,
      userAgent,
      {
        productId: updatedProduct.id,
        productCode: updatedProduct.code,
        productName: updatedProduct.name,
        changes,
        oldStatus: existingProduct.status,
        newStatus: validatedData.status,
      }
    );
  } catch (logError) {
    console.error('记录产品更新日志失败:', logError);
    // 不影响主要业务流程
  }

  return formatProduct(updatedProduct);
}

/**
 * 删除产品
 */
export async function deleteProduct(
  id: string,
  userId?: string | null,
  ipAddress?: string | null,
  userAgent?: string | null
) {
  // 检查产品是否存在
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          variants: true,
          inventory: true,
          salesOrderItems: true,
          inboundRecords: true,
        },
      },
    },
  });

  if (!product) {
    throw new Error('产品不存在');
  }

  // 检查是否有关联数据
  const hasRelatedData =
    product._count.inventory > 0 ||
    product._count.salesOrderItems > 0 ||
    product._count.inboundRecords > 0;

  if (hasRelatedData) {
    throw new Error('该产品存在关联的库存、销售订单或入库记录，无法删除');
  }

  // 删除产品变体
  if (product._count.variants > 0) {
    await prisma.productVariant.deleteMany({
      where: { productId: id },
    });
  }

  // 删除产品
  await prisma.product.delete({
    where: { id },
  });

  // 记录产品删除日志
  try {
    await logBusinessOperation(
      'delete_product',
      `删除产品：${product.name} (编码: ${product.code})`,
      userId,
      ipAddress,
      userAgent,
      {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        categoryId: product.categoryId,
        status: product.status,
      }
    );
  } catch (logError) {
    console.error('记录产品删除日志失败:', logError);
    // 不影响主要业务流程
  }

  return { success: true, message: '产品删除成功' };
}

/**
 * 格式化产品数据
 */
function formatProduct(product: ProductWithRelations) {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    specification: product.specification,
    specifications: product.specifications,
    unit: product.unit,
    piecesPerUnit: product.piecesPerUnit,
    weight: product.weight,
    thickness: product.thickness,
    status: product.status,
    categoryId: product.categoryId,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          code: product.category.code,
        }
      : undefined,
    variants:
      product.variants?.map((variant: ProductVariantWithRelations) => ({
        id: variant.id,
        sku: variant.sku,
        colorCode: variant.colorCode,
        productionDate: variant.productionDate?.toISOString(),
        status: variant.status,
        createdAt: variant.createdAt.toISOString(),
        updatedAt: variant.updatedAt.toISOString(),
      })) || [],
    counts: {
      variants: product._count?.variants || 0,
      inventory: product._count?.inventory || 0,
      salesOrderItems: product._count?.salesOrderItems || 0,
      inboundRecords: product._count?.inboundRecords || 0,
    },
  };
}
