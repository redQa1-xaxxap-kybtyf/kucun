/**
 * 厂家发货订单集装箱号更新 API 路由
 * 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式
 */

import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * PATCH /api/factory-shipments/[id]/container-number
 * 更新厂家发货订单的集装箱号
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: '请先登录' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userId = session.user.id;

    // 解析请求体
    const body = await request.json();
    const { containerNumber } = body;

    // 验证输入
    if (!containerNumber || typeof containerNumber !== 'string') {
      return NextResponse.json(
        { success: false, message: '集装箱号码不能为空' },
        { status: 400 }
      );
    }

    if (containerNumber.length > 50) {
      return NextResponse.json(
        { success: false, message: '集装箱号码不能超过50个字符' },
        { status: 400 }
      );
    }

    // 检查订单是否存在
    const existingOrder = await prisma.factoryShipmentOrder.findFirst({
      where: {
        id,
        userId,
      },
      select: {
        id: true,
        orderNumber: true,
        containerNumber: true,
        status: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, message: '订单不存在或无权限访问' },
        { status: 404 }
      );
    }

    // 更新集装箱号
    const updatedOrder = await prisma.factoryShipmentOrder.update({
      where: { id },
      data: {
        containerNumber: containerNumber.trim(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        orderNumber: true,
        containerNumber: true,
        status: true,
        updatedAt: true,
      },
    });

    // TODO: 添加日志记录功能

    return NextResponse.json({
      success: true,
      message: '集装箱号更新成功',
      data: updatedOrder,
    });
  } catch (error) {
    console.error('更新集装箱号失败:', error);
    console.error('错误详情:', JSON.stringify(error, null, 2));

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '更新集装箱号失败',
        debug: process.env.NODE_ENV === 'development' ? {
          error: error instanceof Error ? error.stack : String(error)
        } : undefined
      },
      { status: 500 }
    );
  }
}
