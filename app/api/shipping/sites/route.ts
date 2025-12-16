import type { NextRequest } from 'next/server';

import {
  buildOffsetPaginationMeta,
  parseOffsetPagination,
} from '@/lib/api/pagination';
import { withErrorHandling } from '@/lib/api/middleware';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import type { ShippingSiteCreateInput } from '@/lib/types/shipping';
import {
  normalizeSelector,
  normalizeShippingExtractSelectors,
} from '@/lib/utils/selector-normalizer';

/**
 * GET /api/shipping/sites - 获取站点列表
 * SOLID-S: 单一职责 - 只负责站点列表查询
 * 🔒 安全增强: 根据用户角色过滤敏感数据（URL）
 */
export const GET = withErrorHandling(
  withAuth(async (request: NextRequest, { user }) => {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const { page, limit, skip } = parseOffsetPagination(searchParams);

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    // 查询总数
    const total = await prisma.shippingSite.count({ where });

    // 查询数据
    const sites = await prisma.shippingSite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    // 🔒 根据用户角色过滤 URL 字段
    const sitesData = sites.map(site => {
      if (user.role === 'admin') {
        // 管理员：返回完整数据（包含 URL）
        return site;
      }
      // 普通用户：移除 URL 字段
      const { url: _url, ...siteWithoutUrl } = site;
      return {
        ...siteWithoutUrl,
        urlMasked: true, // 标记 URL 已被隐藏
      };
    });

    return successResponse({
      data: sitesData,
      pagination: buildOffsetPaginationMeta({ page, limit, total }),
    });
  })
);

/**
 * POST /api/shipping/sites - 创建站点
 * SOLID-S: 单一职责 - 只负责站点创建
 */
export const POST = withErrorHandling(
  withAuth(async (request: NextRequest, { user }) => {
    // 只有管理员可以创建站点
    if (user.role !== 'admin') {
      return errorResponse('权限不足', 403);
    }

    const body: ShippingSiteCreateInput = await request.json();

    // 验证必填字段
    if (
      !body.name ||
      !body.url ||
      !body.searchInputSelector ||
      !body.searchButtonSelector ||
      !body.resultContainerSelector ||
      !body.extractSelectors
    ) {
      return errorResponse('缺少必填字段', 400);
    }

    const sanitizedSelectors = {
      searchInputSelector: normalizeSelector(body.searchInputSelector),
      searchButtonSelector: normalizeSelector(body.searchButtonSelector),
      resultContainerSelector: normalizeSelector(body.resultContainerSelector),
    };
    const sanitizedExtractSelectors = normalizeShippingExtractSelectors(
      body.extractSelectors
    );

    const site = await prisma.shippingSite.create({
      data: {
        name: body.name,
        url: body.url,
        description: body.description,
        searchInputSelector: sanitizedSelectors.searchInputSelector,
        searchButtonSelector: sanitizedSelectors.searchButtonSelector,
        resultContainerSelector: sanitizedSelectors.resultContainerSelector,
        extractSelectors: JSON.stringify(sanitizedExtractSelectors),
      },
    });

    return successResponse(site, 201);
  })
);

/**
 * PATCH /api/shipping/sites - 批量更新站点状态
 */
export const PATCH = withErrorHandling(
  withAuth(async (request: NextRequest, { user }) => {
    if (user.role !== 'admin') {
      return errorResponse('权限不足', 403);
    }

    const body: { ids: string[]; status: 'active' | 'inactive' } =
      await request.json();

    if (!body.ids || !body.status) {
      return errorResponse('缺少必填字段', 400);
    }

    await prisma.shippingSite.updateMany({
      where: {
        id: { in: body.ids },
      },
      data: {
        status: body.status,
      },
    });

    return successResponse({ updated: body.ids.length });
  })
);
