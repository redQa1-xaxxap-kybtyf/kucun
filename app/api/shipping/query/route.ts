import type { NextRequest } from 'next/server';

import { buildOffsetPaginationMeta, parseOffsetPagination } from '@/lib/api/pagination';
import { withErrorHandling } from '@/lib/api/middleware';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { PuppeteerService } from '@/lib/services/puppeteer-service';
import type {
  ExtractSelectors,
  ShippingQueryInput,
} from '@/lib/types/shipping';
import { parseShippingDate } from '@/lib/utils/datetime';
import { chineseToPinyinUppercase } from '@/lib/utils/pinyin';
import { safeJSONParse } from '@/lib/utils/safe-json';
import {
  normalizeSelector,
  normalizeShippingExtractSelectors,
} from '@/lib/utils/selector-normalizer';

/**
 * GET /api/shipping/query - 获取查询历史
 * SOLID-S: 单一职责 - 只负责查询历史列表
 */
export const GET = withErrorHandling(
  withAuth(async (request: NextRequest) => {
    const { searchParams } = request.nextUrl;
    const siteId = searchParams.get('siteId');
    const queryStatus = searchParams.get('queryStatus');
    const { page, limit, skip } = parseOffsetPagination(searchParams);

    const where: Record<string, unknown> = {};
    if (siteId) {
      where.siteId = siteId;
    }
    if (queryStatus) {
      where.queryStatus = queryStatus;
    }

    // 查询总数
    const total = await prisma.shippingQuery.count({ where });

    // 查询数据
    const queries = await prisma.shippingQuery.findMany({
      where,
      orderBy: [{ queriedAt: 'desc' }, { id: 'desc' }],
      skip,
      take: limit,
    });

    return successResponse({
      data: queries,
      pagination: buildOffsetPaginationMeta({
        page,
        limit,
        total,
        hasMore: skip + queries.length < total,
      }),
    });
  })
);

/**
 * POST /api/shipping/query - 执行查询
 * SOLID-S: 单一职责 - 只负责执行运输查询
 * DRY: 统一的错误处理和数据保存逻辑
 */
export const POST = withErrorHandling(
  withAuth(async (request: NextRequest) => {
    const body: ShippingQueryInput = await request.json();
    const { siteId, keyword } = body;

    // 验证必填字段
    if (!siteId || !keyword) {
      return errorResponse('缺少必填字段：siteId 或 keyword', 400);
    }

    // 获取站点配置
    const site = await prisma.shippingSite.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return errorResponse('站点不存在', 404);
    }

    if (site.status !== 'active') {
      return errorResponse('站点未启用', 400);
    }

    // 转换关键词为大写拼音
    const trackingNumber = chineseToPinyinUppercase(keyword);

    try {
      // 解析选择器配置
      const parsedSelectors = safeJSONParse<Partial<ExtractSelectors>>(
        site.extractSelectors,
        {},
        {
          logError: true,
          context: 'shipping-query-selectors-parse',
        }
      );
      const canonicalSelectors =
        normalizeShippingExtractSelectors(parsedSelectors);
      const extractSelectors = {
        status: canonicalSelectors.status ?? '',
        destination: canonicalSelectors.destination ?? '',
        estimatedArrival: canonicalSelectors.estimatedArrival ?? '',
        updateTime: canonicalSelectors.updateTime ?? '',
      };

      // 执行查询（集成 Rate Limiting 和缓存）
      const result = await PuppeteerService.queryShipping(
        siteId, // 站点ID（用于 Rate Limiting 和缓存）
        site.url,
        trackingNumber,
        {
          searchInput: normalizeSelector(site.searchInputSelector),
          searchButton: normalizeSelector(site.searchButtonSelector),
          resultContainer: normalizeSelector(site.resultContainerSelector),
        },
        extractSelectors
      );

      // 使用专门的运输日期解析函数，支持年份推断
      const parsedEstimatedArrival = result.estimatedArrival
        ? (parseShippingDate(result.estimatedArrival) ?? null)
        : null;
      const parsedLastUpdateTime = result.lastUpdateTime
        ? (parseShippingDate(result.lastUpdateTime) ?? null)
        : null;

      // 使用事务保存查询记录和物流轨迹历史
      const query = await prisma.$transaction(async tx => {
        // 保存成功查询记录
        const createdQuery = await tx.shippingQuery.create({
          data: {
            siteId,
            trackingNumber,
            inputKeyword: keyword,
            status: result.status,
            destination: result.destination,
            estimatedArrival: parsedEstimatedArrival,
            lastUpdateTime: parsedLastUpdateTime,
            queryStatus: 'success',
          },
        });

        return createdQuery;
      });

      return successResponse(query);
    } catch (error) {
      // 保存失败记录
      const query = await prisma.shippingQuery.create({
        data: {
          siteId,
          trackingNumber,
          inputKeyword: keyword,
          queryStatus: 'failed',
          errorMessage: error instanceof Error ? error.message : '查询失败',
        },
      });

      return successResponse(query, 200, '查询执行失败，已记录错误');
    }
  })
);
