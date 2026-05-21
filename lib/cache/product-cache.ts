import { getOrSetJSON, invalidateNamespace } from '@/lib/cache/cache';
import { prisma } from '@/lib/db';
import { cacheConfig } from '@/lib/env';
import type { PaginatedResponse } from '@/lib/types/api';
import type { Product, ProductQueryParams } from '@/lib/types/product';

/**
 * 获取缓存的产品列表
 *
 * @deprecated 已废弃 - 产品列表不应该使用长期缓存
 * 产品数据会频繁变更（价格、库存、状态等），列表缓存会导致数据不一致
 *
 * 推荐做法：
 * - 在 API 路由中直接使用 getOrSetJSON，设置极短 TTL（如10-30秒）
 * - 或完全不缓存，依靠数据库查询优化（索引、分页）
 */
export async function getCachedProducts(
  _params: ProductQueryParams
): Promise<PaginatedResponse<Product> | null> {
  // 返回 null，强制调用方直接查询数据库或使用极短 TTL 缓存
  return null;
}

/**
 * 设置产品列表缓存
 *
 * @deprecated 已废弃 - 产品列表不应该缓存
 * 该函数已停用，不会设置任何缓存
 */
export async function setCachedProducts(
  _params: ProductQueryParams,
  _data: PaginatedResponse<Product>
): Promise<void> {
  // 空实现 - 不再缓存列表数据
  // 如果确实需要短期缓存，请在 API 路由中直接使用 getOrSetJSON
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

      if (!product) {
        return null;
      }

      return {
        ...product,
        statistics: {
          inventory: product._count.inventory,
          salesOrderItems: product._count.salesOrderItems,
          inboundRecords: product._count.inboundRecords,
        },
      } as unknown as Product;
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
  await invalidateProductCaches(productId ? [productId] : []);
}

/**
 * 批量清除产品缓存
 */
export async function invalidateProductCaches(
  productIds: string[] = []
): Promise<void> {
  const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));
  await Promise.all([
    ...uniqueProductIds.map(id => invalidateNamespace(`products:detail:${id}`)),
    invalidateNamespace('products:list:*'),
  ]);
}

/**
 * 清除所有产品缓存
 */
export async function clearAllProductCache(): Promise<void> {
  await invalidateNamespace('products:*');
}
