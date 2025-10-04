/**
 * 应收账款 API 路由
 * 职责:
 * - 身份认证和授权检查（使用新的声明式权限系统）
 * - 请求参数验证
 * - 调用服务层业务逻辑
 * - 数据序列化和 HTTP 响应格式化
 * - 错误处理和统一响应格式
 */

import { type NextRequest } from 'next/server';

import { successResponse, withAuth } from '@/lib/auth/api-helpers';
import { buildCacheKey, getOrSetJSON, CACHE_STRATEGY } from '@/lib/cache';
import { getReceivables } from '@/lib/services/receivables-service';
import { accountsReceivableQuerySchema } from '@/lib/validations/payment';

// ==================== API 路由 ====================

/**
 * GET /api/finance/receivables - 获取应收账款列表
 * 权限：需要 finance:view 权限
 */
export const GET = withAuth(
  async (request: NextRequest, { user }) => {
    // 参数验证
    const searchParams = new URL(request.url).searchParams;
    const validationResult = accountsReceivableQuerySchema.safeParse({
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '20'),
      search: searchParams.get('search') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      paymentStatus: searchParams.get('paymentStatus') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    });

    if (!validationResult.success) {
      return successResponse(
        null,
        '参数验证失败: ' + validationResult.error.issues[0]?.message
      );
    }

    // 构建缓存键
    const cacheKey = buildCacheKey(
      'finance:receivables:list',
      validationResult.data
    );

    // 使用缓存包装查询
    const result = await getOrSetJSON(
      cacheKey,
      async () => {
        // 调用服务层
        return await getReceivables(validationResult.data);
      },
      CACHE_STRATEGY.aggregateData.redisTTL, // 财务数据变化较慢，使用10分钟缓存
      {
        enableRandomTTL: true, // 防止缓存雪崩
        enableNullCache: true, // 防止缓存穿透
      }
    );

    // 返回响应
    return successResponse(result);
  },
  { permissions: ['finance:view'] }
);

/**
 * POST /api/finance/receivables/export - 导出应收账款
 * 权限：需要 finance:export 权限
 */
export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    // 参数验证
    const body = await request.json();
    const validationResult = accountsReceivableQuerySchema.safeParse({
      ...body,
      page: 1,
      pageSize: 999999, // 导出所有数据
    });

    if (!validationResult.success) {
      return successResponse(
        null,
        '参数验证失败: ' + validationResult.error.issues[0]?.message
      );
    }

    // 调用服务层获取所有数据
    const result = await getReceivables(validationResult.data);

    // TODO: 实现导出逻辑(Excel/CSV)
    // 这里可以使用 xlsx 库将 result.receivables 导出为 Excel 文件

    return successResponse(
      {
        totalRecords: result.receivables.length,
      },
      '导出功能开发中'
    );
  },
  { permissions: ['finance:export'] }
);
