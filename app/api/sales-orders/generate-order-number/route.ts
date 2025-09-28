import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { generateSalesOrderNumber } from '@/lib/services/simple-order-number-generator';

/**
 * 生成销售订单号API
 * 使用新的安全订单号生成服务，保证并发安全
 */

// 生成订单号API
export async function GET(_request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 使用新的安全订单号生成服务
    const orderNumber = await generateSalesOrderNumber();

    return NextResponse.json({
      success: true,
      data: {
        orderNumber,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('生成订单号失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '生成订单号失败',
      },
      { status: 500 }
    );
  }
}
