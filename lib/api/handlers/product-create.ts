import { Prisma } from '@prisma/client';
import type { z } from 'zod';

import { ApiError, handlePrismaError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { dedupeProductImages } from '@/lib/utils/product-image-dedupe';
import { toProductResponse } from '@/lib/utils/product-transforms';
import type { productCreateSchema } from '@/lib/validations/product';

const PRODUCT_CREATE_RESULT_SELECT = {
  id: true,
  code: true,
  name: true,
  specification: true,
  description: true,
  unit: true,
  piecesPerUnit: true,
  weight: true,
  thickness: true,
  status: true,
  categoryId: true,
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
} satisfies Prisma.ProductSelect;

export type ProductCreateRecord = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_CREATE_RESULT_SELECT;
}>;

export type ProductCreateData = z.infer<typeof productCreateSchema> & {
  categoryId?: string | null;
};

export function normalizeProductCategoryId(
  categoryId: string | null | undefined
): string | null {
  if (!categoryId) {
    return null;
  }

  const trimmed = categoryId.trim();
  if (!trimmed || trimmed === 'uncategorized') {
    return null;
  }

  return trimmed;
}

async function validateCategoryForCreate(
  tx: Prisma.TransactionClient,
  categoryId: string | null
) {
  if (!categoryId) {
    return;
  }

  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { id: true, status: true },
  });

  if (!category) {
    throw ApiError.badRequest('指定的产品分类不存在');
  }

  if (category.status.toLowerCase() !== 'active') {
    throw ApiError.badRequest('指定的产品分类已被禁用');
  }
}

function isProductCodeUniqueError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== 'P2002') {
    return false;
  }

  const target = Array.isArray(error.meta?.target)
    ? error.meta.target
    : error.meta?.target
      ? [error.meta.target]
      : [];

  return target.some(value => String(value).toLowerCase().includes('code'));
}

export async function createProductRecordInTransaction(
  tx: Prisma.TransactionClient,
  data: ProductCreateData
): Promise<ProductCreateRecord> {
  const processedCategoryId = normalizeProductCategoryId(data.categoryId);
  const thumbnailUrl = data.thumbnailUrl?.trim() || null;
  const images = dedupeProductImages(
    data.images ?? [],
    thumbnailUrl ? [thumbnailUrl] : []
  );

  await validateCategoryForCreate(tx, processedCategoryId);

  try {
    return await tx.product.create({
      data: {
        code: data.code,
        name: data.name,
        specification: data.specification,
        description: data.description || null,
        unit: 'sheet',
        thickness: data.thickness ?? null,
        categoryId: processedCategoryId,
        thumbnailUrl,
        images: images.length ? JSON.stringify(images) : null,
        status: data.status ?? 'active',
      },
      select: PRODUCT_CREATE_RESULT_SELECT,
    });
  } catch (error) {
    if (isProductCodeUniqueError(error)) {
      throw ApiError.badRequest('产品编码已存在');
    }

    throw handlePrismaError(error);
  }
}

export async function createProductRecord(
  data: ProductCreateData
): Promise<ProductCreateRecord> {
  return prisma.$transaction(tx => createProductRecordInTransaction(tx, data));
}

export function formatCreatedProduct(product: ProductCreateRecord) {
  return toProductResponse(product);
}

export function mapCreatedProductsSummary(products: ProductCreateRecord[]) {
  return products.map(product => ({
    id: product.id,
    code: product.code,
    name: product.name,
    specification: product.specification ?? undefined,
    status: product.status as 'active' | 'inactive',
  }));
}
