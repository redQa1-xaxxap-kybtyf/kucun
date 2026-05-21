import type { Category, Prisma, Product } from '@prisma/client';
import type { z } from 'zod';

import { ApiError } from '@/lib/api/errors';
import {
  invalidateProductCache,
  invalidateProductCaches,
} from '@/lib/cache/product-cache';
import type { ProductStatus, ProductUnit } from '@/lib/config/product';
import { prisma } from '@/lib/db';
import { invalidateMiniProgramCatalogCache } from '@/lib/services/miniprogram-catalog-service';
import {
  deleteFromQiniu,
  extractQiniuKeysFromUrls,
} from '@/lib/services/qiniu-upload';
import type { ProductImage } from '@/lib/types/product';
import { dedupeProductImages } from '@/lib/utils/product-image-dedupe';
import { parseProductImages } from '@/lib/utils/product-transforms';
import {
  productImageImportSaveSchema,
  productMediaUpdateSchema,
  productUpdateSchema,
  type ProductImageImportKind,
} from '@/lib/validations/product';

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
      parentId: true,
      parent: {
        select: {
          id: true,
          name: true,
          code: true,
          parentId: true,
          parent: {
            select: {
              id: true,
              name: true,
              code: true,
              parentId: true,
            },
          },
        },
      },
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

  const updateData = buildProductUpdateData(
    validatedData,
    existingProduct.thumbnailUrl
  );

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: updateData,
    select: PRODUCT_WITH_RELATIONS_SELECT,
  });

  // ✅ Next.js 15最佳实践：使用revalidatePath确保服务端缓存失效
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/products', 'page'); // 失效产品列表页面缓存
  revalidatePath(`/products/${id}`, 'page'); // 失效产品详情页面缓存

  await invalidateProductCache(id);
  invalidateMiniProgramCatalogCache();

  return formatProduct(updatedProduct);
}

/**
 * 快速更新产品缩略图
 */
export async function updateProductThumbnail(
  id: string,
  thumbnailUrl: string | null | undefined
) {
  const existingProduct = await prisma.product.findUnique({
    where: { id },
    select: { id: true, images: true },
  });

  if (!existingProduct) {
    throw ApiError.notFound('产品');
  }

  const normalizedThumbnailUrl = normalizeNullableString(thumbnailUrl);
  const nextImages = dedupeProductImages(
    parseProductImages(existingProduct.images, id),
    normalizedThumbnailUrl ? [normalizedThumbnailUrl] : []
  );

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: {
      thumbnailUrl: normalizedThumbnailUrl,
      images: serializeProductImages(nextImages),
    },
    select: PRODUCT_WITH_RELATIONS_SELECT,
  });

  const { revalidatePath } = await import('next/cache');
  revalidatePath('/products', 'page');
  revalidatePath(`/products/${id}`, 'page');

  await invalidateProductCache(id);
  invalidateMiniProgramCatalogCache();

  return formatProduct(updatedProduct);
}

export async function matchProductImageImportItems(
  items: Array<{
    clientId: string;
    fileName: string;
    inferredCode: string;
    kind: ProductImageImportKind;
  }>
) {
  const codes = Array.from(
    new Set(
      items
        .map(item => item.inferredCode.trim())
        .filter(code => code.length > 0)
    )
  );

  const products = await prisma.product.findMany({
    where: {
      code: { in: codes },
    },
    select: {
      id: true,
      code: true,
      name: true,
      specification: true,
      thumbnailUrl: true,
    },
  });

  const productByCode = new Map(
    products.map(product => [normalizeMatchCode(product.code), product])
  );

  const matchedItems = items.map(item => {
    const product = productByCode.get(normalizeMatchCode(item.inferredCode));

    return {
      ...item,
      status: product ? ('matched' as const) : ('not_found' as const),
      product: product
        ? {
            id: product.id,
            code: product.code,
            name: product.name,
            specification: product.specification,
            thumbnailUrl: product.thumbnailUrl,
          }
        : null,
    };
  });

  return {
    totalCount: items.length,
    matchedCount: matchedItems.filter(item => item.status === 'matched').length,
    unmatchedCount: matchedItems.filter(item => item.status === 'not_found')
      .length,
    items: matchedItems,
  };
}

export async function updateProductMedia(
  id: string,
  data: z.infer<typeof productMediaUpdateSchema>
) {
  const validatedData = productMediaUpdateSchema.parse(data);
  const existingProduct = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      images: true,
      thumbnailUrl: true,
    },
  });

  if (!existingProduct) {
    throw ApiError.notFound('产品');
  }

  const updateData = buildProductMediaUpdateData(
    id,
    existingProduct.images,
    validatedData,
    existingProduct.thumbnailUrl
  );

  const updatedProduct = await prisma.product.update({
    where: { id },
    data: updateData,
    select: PRODUCT_WITH_RELATIONS_SELECT,
  });

  const { revalidatePath } = await import('next/cache');
  revalidatePath('/products', 'page');
  revalidatePath(`/products/${id}`, 'page');

  await invalidateProductCache(id);
  invalidateMiniProgramCatalogCache();

  return formatProduct(updatedProduct);
}

type ProductImageImportSaveItem = z.infer<
  typeof productImageImportSaveSchema
>['items'][number];

/**
 * 批量保存图片导入结果，减少大量产品图片导入时的 HTTP 往返和重复缓存失效。
 */
export async function saveProductImageImportItems(
  items: ProductImageImportSaveItem[]
) {
  const validatedData = productImageImportSaveSchema.parse({ items });
  const mergedItems = mergeProductImageImportSaveItems(validatedData.items);
  const productIds = mergedItems.map(item => item.productId);

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      images: true,
      thumbnailUrl: true,
    },
  });
  const productById = new Map(products.map(product => [product.id, product]));

  const results = await runWithConcurrency(mergedItems, 6, async item => {
    const product = productById.get(item.productId);
    if (!product) {
      return {
        productId: item.productId,
        status: 'error' as const,
        error: '产品不存在',
      };
    }

    try {
      const updateData = buildProductMediaUpdateData(
        item.productId,
        product.images,
        {
          thumbnailUrl: item.thumbnailUrl,
          appendImages: item.appendImages,
        },
        product.thumbnailUrl
      );

      if (Object.keys(updateData).length > 0) {
        await prisma.product.update({
          where: { id: item.productId },
          data: updateData,
          select: { id: true },
        });
      }

      return {
        productId: item.productId,
        status: 'success' as const,
      };
    } catch (error) {
      return {
        productId: item.productId,
        status: 'error' as const,
        error: getProductImageImportErrorMessage(error),
      };
    }
  });

  const successIds = results
    .filter(result => result.status === 'success')
    .map(result => result.productId);

  if (successIds.length > 0) {
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/products', 'page');
    successIds.forEach(id => revalidatePath(`/products/${id}`, 'page'));
    await invalidateProductCaches(successIds);
    invalidateMiniProgramCatalogCache();
  }

  return {
    totalCount: results.length,
    successCount: results.filter(result => result.status === 'success').length,
    failedCount: results.filter(result => result.status === 'error').length,
    results,
  };
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
  data: z.infer<typeof productUpdateSchema>,
  currentThumbnailUrl?: string | null
): Prisma.ProductUpdateInput {
  const updateData: Prisma.ProductUpdateInput = {};
  const normalizedThumbnailUrl =
    data.thumbnailUrl !== undefined
      ? normalizeNullableString(data.thumbnailUrl)
      : normalizeNullableString(currentThumbnailUrl);

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
    updateData.thumbnailUrl = normalizedThumbnailUrl;
  }
  if (data.images !== undefined) {
    updateData.images = serializeProductImages(
      normalizeProductImagesForStorage(
        data.images,
        normalizedThumbnailUrl ? [normalizedThumbnailUrl] : []
      )
    );
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

function buildProductMediaUpdateData(
  productId: string,
  currentImagesJson: string | null,
  data: z.infer<typeof productMediaUpdateSchema>,
  currentThumbnailUrl?: string | null
): Prisma.ProductUpdateInput {
  const updateData: Prisma.ProductUpdateInput = {};
  const normalizedThumbnailUrl =
    data.thumbnailUrl !== undefined
      ? normalizeNullableString(data.thumbnailUrl)
      : normalizeNullableString(currentThumbnailUrl);

  if (data.thumbnailUrl !== undefined) {
    updateData.thumbnailUrl = normalizedThumbnailUrl;
  }

  if (data.appendImages !== undefined) {
    const currentImages = parseProductImages(currentImagesJson, productId);
    const nextImages = normalizeProductImagesForStorage(
      [
        ...currentImages,
        ...data.appendImages.map((image, index) => ({
          ...image,
          alt: image.alt?.trim() || undefined,
          order: currentImages.length + index,
        })),
      ],
      normalizedThumbnailUrl ? [normalizedThumbnailUrl] : []
    );

    if (nextImages.length > 10) {
      throw ApiError.badRequest('单个产品最多保留 10 张主图/效果图');
    }

    updateData.images = serializeProductImages(nextImages);
  }

  return updateData;
}

function normalizeProductImagesForStorage(
  images: ProductImage[] | undefined,
  excludedUrls: Array<string | null | undefined> = []
) {
  return dedupeProductImages(Array.isArray(images) ? images : [], excludedUrls);
}

function serializeProductImages(images: ProductImage[]) {
  return images.length > 0 ? JSON.stringify(images) : null;
}

function mergeProductImageImportSaveItems(items: ProductImageImportSaveItem[]) {
  const itemByProductId = new Map<string, ProductImageImportSaveItem>();

  items.forEach(item => {
    const existing = itemByProductId.get(item.productId);
    if (!existing) {
      itemByProductId.set(item.productId, {
        ...item,
        appendImages: item.appendImages ? [...item.appendImages] : undefined,
      });
      return;
    }

    const appendImages = [
      ...(existing.appendImages ?? []),
      ...(item.appendImages ?? []),
    ];

    itemByProductId.set(item.productId, {
      productId: item.productId,
      thumbnailUrl:
        item.thumbnailUrl !== undefined
          ? item.thumbnailUrl
          : existing.thumbnailUrl,
      appendImages: appendImages.length > 0 ? appendImages : undefined,
    });
  });

  return Array.from(itemByProductId.values());
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    }
  );

  await Promise.all(runners);
  return results;
}

function getProductImageImportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return '图片资料保存失败';
}

function normalizeMatchCode(value: string): string {
  return value.trim().toLowerCase();
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
    select: {
      id: true,
      thumbnailUrl: true,
      images: true,
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

  const imageUrls: string[] = [];
  if (product.thumbnailUrl) {
    imageUrls.push(product.thumbnailUrl);
  }
  if (product.images) {
    const parsedImages = parseProductImages(product.images, product.id);
    parsedImages.forEach(image => {
      if (image.url) {
        imageUrls.push(image.url);
      }
    });
  }

  const qiniuKeys = imageUrls.length
    ? await extractQiniuKeysFromUrls(imageUrls)
    : [];

  // 删除产品
  await prisma.product.delete({
    where: { id },
  });

  // ✅ Next.js 15最佳实践：使用revalidatePath确保服务端缓存失效
  const { revalidatePath } = await import('next/cache');
  revalidatePath('/products', 'page'); // 失效产品列表页面缓存
  revalidatePath(`/products/${id}`, 'page'); // 失效产品详情页面缓存

  await invalidateProductCache(id);
  invalidateMiniProgramCatalogCache();

  if (qiniuKeys.length > 0) {
    await Promise.all(qiniuKeys.map(key => deleteFromQiniu(key)));
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
    specification: product.specification ?? undefined,
    unit: product.unit as ProductUnit,
    piecesPerUnit: product.piecesPerUnit ?? undefined,
    weight: product.weight === null ? undefined : Number(product.weight),
    thickness:
      product.thickness === null ? undefined : Number(product.thickness),
    status: product.status as ProductStatus,
    categoryId: product.categoryId ?? null,
    description: product.description ?? undefined,
    thumbnailUrl: product.thumbnailUrl ?? undefined,
    images: parseProductImages(product.images ?? null, product.id),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    category: formatProductCategory(product.category),
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

function formatProductCategory(category: ProductWithRelations['category']) {
  if (!category) return null;

  const parent = category.parent;
  const grandparent = parent?.parent;
  const fullPath = [grandparent?.name, parent?.name, category.name]
    .filter(Boolean)
    .join(' / ');

  return {
    id: category.id,
    name: category.name,
    code: category.code,
    parentId: category.parentId,
    fullPath,
    parent: parent
      ? {
          id: parent.id,
          name: parent.name,
          code: parent.code,
          parentId: parent.parentId,
          parent: grandparent
            ? {
                id: grandparent.id,
                name: grandparent.name,
                code: grandparent.code,
                parentId: grandparent.parentId,
              }
            : null,
        }
      : null,
  };
}
