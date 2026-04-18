/**
 * 产品列表服务器端数据获取函数
 * 用于 Server Component，直接调用数据库，避免 HTTP 跳转
 * 遵循 Next.js 15 官方最佳实践：使用 React.cache() 避免重复查询
 */

import { cache } from 'react';

import {
  buildPagination,
  buildProductSelect,
  buildProductWhereClause,
  formatProductList,
  getProductsBatchSpecifications,
  getProductsInventory,
  queryProducts,
} from '@/lib/api/handlers/products-list';
import type { ProductListQueryParams } from '@/lib/api/products';
import { buildCacheKey, CACHE_STRATEGY, getOrSetJSON } from '@/lib/cache';
import { PRODUCT_DEFAULT_SORT } from '@/lib/config/product';
import { paginationConfig, productConfig } from '@/lib/env';
import { logger } from '@/lib/logger';
import type { PaginatedResponse } from '@/lib/types/api';
import type { Product } from '@/lib/types/product';

type ServerProduct = Omit<Product, 'createdAt' | 'updatedAt'> & {
  createdAt: Date | string;
  updatedAt: Date | string;
};

/**
 * 服务器端获取产品列表
 * 直接从数据库获取，带缓存优化
 * 使用 React.cache() 包装确保同一渲染周期内不会重复查询
 */
export const getProductsForServer = cache(
  async (
    params: ProductListQueryParams & { includeBatchSpecs?: boolean }
  ): Promise<PaginatedResponse<ServerProduct> | undefined> => {
    // 直接解析参数，移除不必要的 URLSearchParams 序列化
    const includeInventory =
      params.includeInventory ?? productConfig.defaultIncludeInventory;
    const includeStatistics =
      params.includeStatistics ?? productConfig.defaultIncludeStatistics;
    const includeBatchSpecs = params.includeBatchSpecs ?? false;
    const requestLimit = params.limit ?? paginationConfig.defaultPageSize;

    // 性能优化：超过20条记录时限制聚合查询
    const shouldLimitAggregation = requestLimit > 20;
    const finalIncludeStatistics = includeStatistics && !shouldLimitAggregation;

    const filterUncategorized = params.categoryId === 'none';

    // 直接从参数获取值,无需 Zod 验证(Server Component 调用已保证类型安全)
    const page = params.page ?? 1;
    const limit = params.limit ?? paginationConfig.defaultPageSize;
    const search = params.search;
    const sortBy = params.sortBy ?? PRODUCT_DEFAULT_SORT.sortBy;
    const sortOrder = params.sortOrder ?? PRODUCT_DEFAULT_SORT.sortOrder;
    const status =
      params.status && (params.status as string) !== 'all'
        ? params.status
        : undefined;
    const categoryId = filterUncategorized ? undefined : params.categoryId;

    // 构建查询条件
    const where = buildProductWhereClause({
      search,
      status,
      categoryId,
      filterUncategorized,
    });

    // Redis 缓存键
    const cacheKey = buildCacheKey('products:list', {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      status,
      categoryId,
      includeInventory,
      includeStatistics: finalIncludeStatistics,
      includeBatchSpecs,
      uncategorized: filterUncategorized,
    });

    // 性能监控：记录查询开始时间
    const queryStartTime = Date.now();

    // 命中缓存则直接返回
    const cached = await getOrSetJSON(
      cacheKey,
      async () => {
        const productSelect = buildProductSelect(finalIncludeStatistics);

        const [products, total] = await queryProducts({
          where,
          select: productSelect,
          sortBy,
          sortOrder,
          page,
          limit,
        });

        const inventoryMap = await getProductsInventory(
          products,
          includeInventory
        );

        // 如果需要批次数据，批量获取
        const batchSpecsMap = includeBatchSpecs
          ? await getProductsBatchSpecifications(products.map(p => p.id))
          : undefined;

        const formattedProducts = formatProductList({
          products: products as Parameters<
            typeof formatProductList
          >[0]['products'],
          inventoryMap,
          includeInventory,
          includeStatistics: finalIncludeStatistics,
          batchSpecsMap,
        });

        const pagination = buildPagination({ page, limit, total });

        return {
          data: formattedProducts,
          pagination,
        } as const;
      },
      CACHE_STRATEGY.dynamicData.redisTTL, // 使用统一的动态数据缓存策略 (5分钟)
      {
        enableRandomTTL: true, // 防止缓存雪崩
        enableNullCache: true, // 防止缓存穿透
      }
    );

    // 性能监控：记录慢查询
    const queryDuration = Date.now() - queryStartTime;
    if (queryDuration > 1000) {
      logger.warn('api:products-server', '产品列表查询性能慢', {
        operation: 'getProductsServer',
        duration: queryDuration,
        cacheKey,
        includeInventory,
        includeStatistics: finalIncludeStatistics,
        includeBatchSpecs,
        search,
        page,
        limit,
      });
    }

    // 返回类型转换，确保类型安全
    if (!cached) {
      return undefined;
    }

    return {
      data: cached.data,
      pagination: cached.pagination,
    };
  }
);
