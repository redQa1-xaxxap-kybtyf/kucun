import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentISOString, getStartOfDay } from '@/lib/utils/datetime';

/**
 * 生成销售订单号
 * 格式：SO + YYYYMMDD + 4位序号
 * 例如：SO202501190001
 */
function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // 生成随机4位序号作为基础
  const randomNum = Math.floor(Math.random() * 9999) + 1;
  const sequence = String(randomNum).padStart(4, '0');

  return `SO${dateStr}${sequence}`;
}

/**
 * 检查订单号是否已存在
 */
async function isOrderNumberExists(orderNumber: string): Promise<boolean> {
  const existingOrder = await prisma.salesOrder.findFirst({
    where: { orderNumber },
    select: { id: true },
  });

  return !!existingOrder;
}

/**
 * 生成唯一的订单号
 */
async function generateUniqueOrderNumber(): Promise<string> {
  let orderNumber: string;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    orderNumber = generateOrderNumber();
    attempts++;

    if (attempts >= maxAttempts) {
      throw new Error('无法生成唯一的订单号，请稍后重试');
    }
  } while (await isOrderNumberExists(orderNumber));

  return orderNumber;
}

/**
 * 获取今日订单统计
 */
async function getTodayOrderStats() {
  const today = getStartOfDay(new Date());
  if (!today) {
    throw new Error('无法获取今日开始时间');
  }
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayCount = await prisma.salesOrder.count({
    where: {
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  return {
    todayCount,
    suggestedPrefix: `SO${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`,
  };
}

// 生成订单号API
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'generate';

    if (action === 'generate') {
      // 生成新的订单号
      const orderNumber = await generateUniqueOrderNumber();
      const stats = await getTodayOrderStats();

      return NextResponse.json({
        success: true,
        data: {
          orderNumber,
          stats,
          generatedAt: getCurrentISOString(),
        },
      });
    }

    if (action === 'check') {
      // 检查订单号是否可用
      const orderNumber = searchParams.get('orderNumber');

      if (!orderNumber) {
        return NextResponse.json(
          { success: false, error: '订单号不能为空' },
          { status: 400 }
        );
      }

      const exists = await isOrderNumberExists(orderNumber);

      return NextResponse.json({
        success: true,
        data: {
          orderNumber,
          available: !exists,
          message: exists ? '订单号已存在' : '订单号可用',
        },
      });
    }

    if (action === 'stats') {
      // 获取订单统计信息
      const stats = await getTodayOrderStats();

      // 获取最近的订单号
      const recentOrders = await prisma.salesOrder.findMany({
        select: {
          orderNumber: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
      });

      return NextResponse.json({
        success: true,
        data: {
          stats,
          recentOrders,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: '不支持的操作' },
      { status: 400 }
    );
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

// 验证订单号格式
export async function POST(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orderNumber } = body;

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: '订单号不能为空' },
        { status: 400 }
      );
    }

    // 验证订单号格式
    const orderNumberRegex = /^SO\d{8}\d{4}$/;
    const isValidFormat = orderNumberRegex.test(orderNumber);

    if (!isValidFormat) {
      return NextResponse.json({
        success: false,
        error: '订单号格式不正确，应为：SO + 8位日期 + 4位序号',
        data: {
          orderNumber,
          valid: false,
          format: 'SO + YYYYMMDD + 0000',
          example: 'SO202501190001',
        },
      });
    }

    // 检查是否已存在
    const exists = await isOrderNumberExists(orderNumber);

    return NextResponse.json({
      success: true,
      data: {
        orderNumber,
        valid: true,
        available: !exists,
        message: exists
          ? '订单号已存在，请使用其他订单号'
          : '订单号格式正确且可用',
      },
    });
  } catch (error) {
    console.error('验证订单号失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '验证订单号失败',
      },
      { status: 500 }
    );
  }
}
