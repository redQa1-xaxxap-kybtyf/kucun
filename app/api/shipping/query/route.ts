import type { NextRequest } from 'next/server';

import { withErrorHandling } from '@/lib/api/middleware';
import { withAuth, successResponse, errorResponse } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { PuppeteerService } from '@/lib/services/puppeteer-service';
import type {
  ExtractSelectors,
  ShippingQueryInput,
} from '@/lib/types/shipping';
import { parseDate } from '@/lib/utils/datetime';
import { chineseToPinyinUppercase } from '@/lib/utils/pinyin';
import {
  normalizeSelector,
  normalizeSelectorGroup,
} from '@/lib/utils/selector-normalizer';

/**
 * GET /api/shipping/query - 获取查询历史
 * SOLID-S: 单一职责 - 只负责查询历史列表
 */
export const GET = withErrorHandling(
  withAuth(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const queryStatus = searchParams.get('queryStatus');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

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
      include: {
        site: true,
      },
      orderBy: { queriedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return successResponse({
      data: queries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
      const parsedSelectors = JSON.parse(
        site.extractSelectors
      ) as Partial<ExtractSelectors>;
      const extractSelectors = normalizeSelectorGroup({
        status: parsedSelectors.status ?? '',
        destination: parsedSelectors.destination ?? '',
        estimatedArrival: parsedSelectors.estimatedArrival ?? '',
        updateTime: parsedSelectors.updateTime ?? '',
      });

      // 执行查询
      const result = await PuppeteerService.queryShipping(
        site.url,
        trackingNumber,
        {
          searchInput: normalizeSelector(site.searchInputSelector),
          searchButton: normalizeSelector(site.searchButtonSelector),
          resultContainer: normalizeSelector(site.resultContainerSelector),
        },
        extractSelectors
      );

      const parsedEstimatedArrival = result.estimatedArrival
        ? (parseDate(result.estimatedArrival) ?? null)
        : null;
      const parsedLastUpdateTime = result.lastUpdateTime
        ? (parseDate(result.lastUpdateTime) ?? null)
        : null;

      // 保存成功查询记录
      const query = await prisma.shippingQuery.create({
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
        include: {
          site: true,
        },
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
        include: {
          site: true,
        },
      });

      return successResponse(query, 200, '查询执行失败，已记录错误');
    }
  })
);
