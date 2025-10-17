import type { Category, Prisma, Product } from '@prisma/client';
import type { z } from 'zod';

import { ApiError } from '@/lib/api/errors';
import { invalidateProductCache } from '@/lib/cache/product-cache';
import type { ProductStatus, ProductUnit } from '@/lib/config/product';
import { prisma } from '@/lib/db';
import { parseProductImages } from '@/lib/utils/product-transforms';
import { productUpdateSchema } from '@/lib/validations/product';

const PRODUCT_WITH_RELATIONS_SELECT = {
  id: true,
  code: true,
  name: true,
  specification: true,
  unit: true,
  piecesPerUnit: true,
  weight: true,
  thickness: true,
  status: true,
  categoryId: true,
  description: true,
  thumbnailUrl: true,
  images: true,
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
      colorName: true,
      colorValue: true,
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
} satisfies Prisma.ProductSelect;

type ProductWithRelations = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_WITH_RELATIONS_SELECT;
}>;

type ProductVariantWithRelations =
  ProductWithRelations['variants'] extends Array<infer Variant>
    ? Variant
    : never;

/**
 * 根据ID获取产品详情
 */
export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    select: PRODUCT_WITH_RELATIONS_SELECT,
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
  data: z.infer<typeof productUpdateSchema>
) {
  const validatedData = productUpdateSchema.parse(data);
  const context = await loadProductUpdateContext(id, validatedData);
  const existingProduct = ensureProductExists(context.existingProduct);

  validateCategoryChange(validatedData, existingProduct, context.category);
  validateCodeChange(validatedData, existingProduct, context.codeOwner);

  const updateData = buildProductUpdateData(validatedData);

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: updateData,
    select: PRODUCT_WITH_RELATIONS_SELECT,
  });

  await invalidateProductCache(id);

  return formatProduct(updatedProduct);
}

type ProductUpdateContext = {
  existingProduct: Product | null;
  category: Category | null;
  codeOwner: Product | null;
};

async function loadProductUpdateContext(
  id: string,
  data: z.infer<typeof productUpdateSchema>
): Promise<ProductUpdateContext> {
  const normalizedCategoryId = normalizeCategoryIdInput(data.categoryId);

  const [existingProduct, category, codeOwner] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    normalizedCategoryId
      ? prisma.category.findUnique({ where: { id: normalizedCategoryId } })
      : Promise.resolve(null),
    data.code
      ? prisma.product.findUnique({ where: { code: data.code } })
      : Promise.resolve(null),
  ]);

  return {
    existingProduct,
    category,
    codeOwner,
  };
}

function ensureProductExists(product: Product | null): Product {
  if (!product) {
    throw ApiError.notFound('产品');
  }

  return product;
}

function validateCategoryChange(
  data: z.infer<typeof productUpdateSchema>,
  existingProduct: Product,
  category: Category | null
): void {
  if (data.categoryId === undefined) {
    return;
  }

  const normalizedCategoryId = normalizeCategoryIdInput(data.categoryId);
  const currentCategoryId = existingProduct.categoryId ?? null;

  if (
    normalizedCategoryId &&
    normalizedCategoryId !== currentCategoryId &&
    !category
  ) {
    throw ApiError.badRequest('指定的分类不存在');
  }
}

function validateCodeChange(
  data: z.infer<typeof productUpdateSchema>,
  existingProduct: Product,
  codeOwner: Product | null
): void {
  if (
    data.code !== undefined &&
    data.code !== existingProduct.code &&
    codeOwner
  ) {
    throw ApiError.badRequest('产品编码已被其他产品使用');
  }
}

function buildProductUpdateData(
  data: z.infer<typeof productUpdateSchema>
): Prisma.ProductUpdateInput {
  const updateData: Prisma.ProductUpdateInput = {};

  if (data.code !== undefined) {
    updateData.code = data.code;
  }
  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.specification !== undefined) {
    updateData.specification = data.specification;
  }
  if (data.piecesPerUnit !== undefined) {
    updateData.piecesPerUnit = data.piecesPerUnit;
  }
  if (data.weight !== undefined) {
    updateData.weight = data.weight;
  }
  if (data.thickness !== undefined) {
    updateData.thickness = data.thickness;
  }
  if (data.description !== undefined) {
    updateData.description = normalizeNullableString(data.description);
  }
  if (data.thumbnailUrl !== undefined) {
    updateData.thumbnailUrl = normalizeNullableString(data.thumbnailUrl);
  }
  if (data.images !== undefined) {
    updateData.images =
      Array.isArray(data.images) && data.images.length > 0
        ? JSON.stringify(data.images)
        : null;
  }
  if (data.categoryId !== undefined) {
    const normalizedCategoryId = normalizeCategoryIdInput(data.categoryId);
    updateData.category = normalizedCategoryId
      ? { connect: { id: normalizedCategoryId } }
      : { disconnect: true };
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }

  return updateData;
}

function normalizeNullableString(
  value: string | null | undefined
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCategoryIdInput(
  categoryId: string | null | undefined
): string | null {
  if (categoryId === undefined || categoryId === null) {
    return null;
  }

  const trimmed =
    typeof categoryId === 'string' ? categoryId.trim() : categoryId;

  if (!trimmed || trimmed === 'uncategorized') {
    return null;
  }

  return trimmed;
}

/**
 * 删除产品
 */
export async function deleteProduct(id: string) {
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
    throw ApiError.notFound('产品');
  }

  // 检查是否有关联数据
  const hasRelatedData =
    product._count.inventory > 0 ||
    product._count.salesOrderItems > 0 ||
    product._count.inboundRecords > 0;

  if (hasRelatedData) {
    throw ApiError.badRequest(
      '该产品存在关联的库存、销售订单或入库记录，无法删除',
      {
        counts: {
          inventory: product._count.inventory,
          salesOrderItems: product._count.salesOrderItems,
          inboundRecords: product._count.inboundRecords,
        },
      }
    );
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

  await invalidateProductCache(id);

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
    specification: product.specification ?? undefined,
    unit: product.unit as ProductUnit,
    piecesPerUnit: product.piecesPerUnit,
    weight: product.weight ?? undefined,
    thickness: product.thickness ?? undefined,
    status: product.status as ProductStatus,
    categoryId: product.categoryId ?? null,
    description: product.description ?? undefined,
    thumbnailUrl: product.thumbnailUrl ?? undefined,
    images: parseProductImages(product.images ?? null, product.id),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          code: product.category.code,
        }
      : null,
    variants:
      product.variants?.map((variant: ProductVariantWithRelations) => ({
        id: variant.id,
        productId: product.id,
        sku: variant.sku,
        colorCode: variant.colorCode,
        colorName: variant.colorName ?? undefined,
        colorValue: variant.colorValue ?? undefined,
        status: variant.status as 'active' | 'inactive',
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
