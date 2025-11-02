import type { NextRequest } from 'next/server';

import { resolveParams, withErrorHandling } from '@/lib/api/middleware';
import {
  errorResponse,
  successResponse,
  withAuth,
} from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import type { ShippingSiteUpdateInput } from '@/lib/types/shipping';
import {
  normalizeSelector,
  normalizeShippingExtractSelectors,
} from '@/lib/utils/selector-normalizer';

/**
 * GET /api/shipping/sites/[id] - 获取单个站点详情
 * 🔒 安全增强: 根据用户角色过滤敏感数据（URL）
 */
export const GET = withErrorHandling(
  withAuth(async (request: NextRequest, { user, params }) => {
    const { id } = await resolveParams(params);

    const site = await prisma.shippingSite.findUnique({
      where: { id },
    });

    if (!site) {
      return errorResponse('站点不存在', 404);
    }

    // 🔒 根据用户角色过滤 URL 字段
    if (user.role === 'admin') {
      // 管理员：返回完整数据（包含 URL）
      return successResponse(site);
    }

    // 普通用户：移除 URL 字段
    const { url: _url, ...siteWithoutUrl } = site;
    return successResponse({
      ...siteWithoutUrl,
      urlMasked: true, // 标记 URL 已被隐藏
    });
  })
);

/**
 * PUT /api/shipping/sites/[id] - 更新站点
 */
export const PUT = withErrorHandling(
  withAuth(async (request: NextRequest, { user, params }) => {
    if (user.role !== 'admin') {
      return errorResponse('权限不足', 403);
    }

    const { id } = await resolveParams(params);
    const body: ShippingSiteUpdateInput = await request.json();

    // 检查站点是否存在
    const existingSite = await prisma.shippingSite.findUnique({
      where: { id },
    });

    if (!existingSite) {
      return errorResponse('站点不存在', 404);
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {};
    if (body.name) {
      updateData.name = body.name;
    }
    if (body.url) {
      updateData.url = body.url;
    }
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    if (body.searchInputSelector) {
      updateData.searchInputSelector = normalizeSelector(
        body.searchInputSelector
      );
    }
    if (body.searchButtonSelector) {
      updateData.searchButtonSelector = normalizeSelector(
        body.searchButtonSelector
      );
    }
    if (body.resultContainerSelector) {
      updateData.resultContainerSelector = normalizeSelector(
        body.resultContainerSelector
      );
    }
    if (body.extractSelectors) {
      updateData.extractSelectors = JSON.stringify(
        normalizeShippingExtractSelectors(body.extractSelectors)
      );
    }
    if (body.status) {
      updateData.status = body.status;
    }

    const site = await prisma.shippingSite.update({
      where: { id },
      data: updateData,
    });

    return successResponse(site);
  })
);

/**
 * DELETE /api/shipping/sites/[id] - 删除站点
 */
export const DELETE = withErrorHandling(
  withAuth(async (request: NextRequest, { user, params }) => {
    if (user.role !== 'admin') {
      return errorResponse('权限不足', 403);
    }

    const { id } = await resolveParams(params);

    // 检查站点是否存在
    const existingSite = await prisma.shippingSite.findUnique({
      where: { id },
    });

    if (!existingSite) {
      return errorResponse('站点不存在', 404);
    }

    // 删除站点（会级联删除关联的查询记录）
    await prisma.shippingSite.delete({
      where: { id },
    });

    return successResponse({ deleted: true });
  })
);
