import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import {
  getFinanceStatisticsCache,
  setFinanceStatisticsCache,
} from '@/lib/cache/finance-cache';
import { env } from '@/lib/env';
import {
  getFinanceOverview,
  getFinanceStatistics,
} from '@/lib/services/finance-statistics';
import { logger } from '@/lib/utils/console-logger';

/**
 * 财务管理概览API
 * GET /api/finance - 获取财务管理概览数据
 */
export async function GET(_request: NextRequest) {
  try {
    // 验证用户身份 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    // 尝试从缓存获取数据
    const cached = await getFinanceStatisticsCache();
    if (cached) {
      return NextResponse.json({
        success: true,
        data: cached,
        cached: true,
      });
    }

    // 获取财务概览数据(使用服务层函数)
    const financeOverview = await getFinanceOverview();

    // 设置缓存
    await setFinanceStatisticsCache(financeOverview);

    return NextResponse.json({
      success: true,
      data: financeOverview,
    });
  } catch (error) {
    logger.error('finance-api', '获取财务概览失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取财务概览失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 财务数据统计API
 * POST /api/finance - 获取指定条件的财务统计数据
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份 (开发模式下绕过)
    if (env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json(
          { success: false, error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    // 解析请求参数
    const body = await request.json();
    const params = {
      startDate: body.startDate,
      endDate: body.endDate,
      customerId: body.customerId,
      includeRefunds: body.includeRefunds ?? true,
      includeStatements: body.includeStatements ?? true,
    };

    // 获取财务统计数据(使用服务层函数)
    const statisticsData = await getFinanceStatistics(params);

    // 设置缓存
    await setFinanceStatisticsCache(statisticsData);

    return NextResponse.json({
      success: true,
      data: statisticsData,
      cached: false,
    });
  } catch (error) {
    logger.error('finance-api', '获取财务统计失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取财务统计失败',
      },
      { status: 500 }
    );
  }
}
