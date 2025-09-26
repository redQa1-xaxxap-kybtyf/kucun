import {
  buildCacheKey,
  getOrSetJSON,
  invalidateNamespace,
} from '@/lib/cache/cache';
import { prisma } from '@/lib/db';
import { cacheConfig } from '@/lib/env';
import type { PaginatedResponse } from '@/lib/types/api';
import type { Product, ProductQueryParams } from '@/lib/types/product';

/**
 * 获取缓存的产品列表
 */
export async function getCachedProducts(
  params: ProductQueryParams
): Promise<PaginatedResponse<Product> | null> {
  const cacheKey = buildCacheKey('products:list', params);
  // 注意：这里只是获取缓存，不设置新值，所以 fetcher 为 null 是正确的
  return getOrSetJSON(cacheKey, null);
}

/**
 * 设置产品列表缓存
 */
export async function setCachedProducts(
  params: ProductQueryParams,
  data: PaginatedResponse<Product>
): Promise<void> {
  const cacheKey = buildCacheKey('products:list', params);
  await getOrSetJSON(
    cacheKey,
    () => Promise.resolve(data),
    cacheConfig.productTtl
  );
}

/**
 * 获取单个产品缓存
 */
export async function getCachedProduct(
  productId: string
): Promise<Product | null> {
  const cacheKey = `products:detail:${productId}`;
  return getOrSetJSON(
    cacheKey,
    async () => {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          _count: {
            select: {
              inventory: true,
              salesOrderItems: true,
              inboundRecords: true,
            },
          },
        },
      });

      if (!product) return null;

      return {
        ...product,
        statistics: {
          inventory: product._count.inventory,
          salesOrderItems: product._count.salesOrderItems,
          inboundRecords: product._count.inboundRecords,
        },
      } as Product;
    },
    cacheConfig.productTtl
  );
}

/**
 * 清除产品相关缓存
 */
export async function invalidateProductCache(
  productId?: string
): Promise<void> {
  if (productId) {
    // 清除特定产品缓存
    await invalidateNamespace(`products:detail:${productId}`);
  }
  // 清除产品列表缓存
  await invalidateNamespace('products:list:*');
}

/**
 * 清除所有产品缓存
 */
export async function clearAllProductCache(): Promise<void> {
  await invalidateNamespace('products:*');
}
