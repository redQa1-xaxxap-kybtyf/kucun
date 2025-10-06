/**
 * 内存监控API端点
 * GET /api/monitoring/memory - 获取内存使用情况
 */

import { NextRequest, NextResponse } from 'next/server';

import { generateMemoryReport, getMemoryStats } from '@/lib/monitoring/memory-monitor';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 简单的身份验证（生产环境应使用更安全的方式）
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.MONITORING_TOKEN || 'dev-token';

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 检查查询参数
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    if (detailed) {
      // 返回详细报告
      const report = generateMemoryReport();
      return NextResponse.json({
        success: true,
        data: report,
      });
    } else {
      // 返回简单统计
      const stats = getMemoryStats();
      return NextResponse.json({
        success: true,
        data: stats,
      });
    }
  } catch (error) {
    console.error('[Memory Monitoring API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
