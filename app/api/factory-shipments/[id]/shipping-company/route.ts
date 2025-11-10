/**
 * 厂家发货订单船公司名称更新 API 路由
 * 遵循 Next.js 15.4 App Router 架构和 TypeScript 严格模式
 */

import { NextResponse, type NextRequest } from 'next/server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * PATCH /api/factory-shipments/[id]/shipping-company
 * 更新厂家发货订单的船公司名称
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
    const { shippingCompany } = body;

    // 验证输入
    if (!shippingCompany || typeof shippingCompany !== 'string') {
      return NextResponse.json(
        { success: false, message: '船公司名称不能为空' },
        { status: 400 }
      );
    }

    if (shippingCompany.length > 100) {
      return NextResponse.json(
        { success: false, message: '船公司名称不能超过100个字符' },
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
        shippingCompany: true,
        status: true,
        lastShippingQueryAt: true,
      },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, message: '订单不存在或无权限访问' },
        { status: 404 }
      );
    }

    // 业务规则：如果订单已经进行过物流查询，不允许修改船运公司
    // 原因：物流查询是基于船运公司名称进行的，修改后会导致查询结果与实际物流信息不匹配
    if (existingOrder.lastShippingQueryAt) {
      return NextResponse.json(
        {
          success: false,
          message: '订单已进行物流查询，不允许修改船运公司',
          details: '如需修改，请联系管理员重置查询状态，或创建新的发货订单',
        },
        { status: 400 }
      );
    }

    // 更新船公司名称
    const updatedOrder = await prisma.factoryShipmentOrder.update({
      where: { id },
      data: {
        shippingCompany: shippingCompany.trim(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        orderNumber: true,
        shippingCompany: true,
        status: true,
        updatedAt: true,
      },
    });

    logger.info('factory-shipments', '船公司名称更新成功', {
      orderId: id,
      orderNumber: updatedOrder.orderNumber,
      oldShippingCompany: existingOrder.shippingCompany,
      newShippingCompany: updatedOrder.shippingCompany,
      userId,
    });

    return NextResponse.json({
      success: true,
      message: '船公司名称更新成功',
      data: updatedOrder,
    });
  } catch (error) {
    logger.error('factory-shipments', '更新船公司名称失败', error, {
      orderId: (await params).id,
    });

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '更新船公司名称失败',
        debug:
          process.env.NODE_ENV === 'development'
            ? {
                error: error instanceof Error ? error.stack : String(error),
              }
            : undefined,
      },
      { status: 500 }
    );
  }
}
