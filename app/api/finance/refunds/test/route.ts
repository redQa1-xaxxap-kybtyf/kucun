import { getServerSession } from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * 测试退款API
 * GET /api/finance/refunds/test - 简化版退款记录获取
 */
export async function GET(_request: NextRequest) {
  try {
    console.log('🧪 测试退款API被调用');

    // 验证用户身份
    const session = await getServerSession(authOptions);
    console.log('🔐 用户会话:', session?.user?.id ? '已登录' : '未登录');

    if (!session?.user) {
      console.log('❌ 未授权访问');
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    console.log('✅ 用户身份验证通过');

    // 简单查询退款记录
    console.log('📊 开始查询退款记录...');
    const refunds = await prisma.refundRecord.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        refundNumber: true,
        refundAmount: true,
        status: true,
        createdAt: true,
        refundType: true,
        refundMethod: true,
        processedAmount: true,
        remainingAmount: true,
      },
    });

    console.log(`✅ 查询成功，找到 ${refunds.length} 条记录`);

    return NextResponse.json({
      success: true,
      data: {
        refunds: refunds.map(refund => ({
          id: refund.id,
          refundNumber: refund.refundNumber,
          refundAmount: refund.refundAmount,
          status: refund.status,
          createdAt: refund.createdAt.toISOString(),
        })),
        total: refunds.length,
      },
    });
  } catch (error) {
    console.error('❌ 测试退款API错误:', error);
    return NextResponse.json(
      { success: false, error: `服务器错误: ${error.message}` },
      { status: 500 }
    );
  }
}
