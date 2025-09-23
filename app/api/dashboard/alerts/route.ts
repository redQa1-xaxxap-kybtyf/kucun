import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// 获取库存预警数据
export async function GET(_request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 获取库存数据，包含产品信息
    const inventoryData = await prisma.inventory.findMany({
      include: {
        product: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
      },
      where: {
        product: {
          status: 'active',
        },
      },
      orderBy: {
        quantity: 'asc',
      },
    });

    // 生成库存预警
    const alerts = inventoryData
      .map(inventory => {
        const safetyStock = 10; // 假设安全库存为10
        const currentStock = inventory.quantity;

        let alertLevel: 'warning' | 'danger' | 'critical';
        let alertType: 'low_stock' | 'out_of_stock' | 'overstock' | 'expired';
        let suggestedAction: string;

        if (currentStock === 0) {
          alertLevel = 'critical';
          alertType = 'out_of_stock';
          suggestedAction = '立即补货';
        } else if (currentStock <= safetyStock * 0.5) {
          alertLevel = 'danger';
          alertType = 'low_stock';
          suggestedAction = '紧急补货';
        } else if (currentStock <= safetyStock) {
          alertLevel = 'warning';
          alertType = 'low_stock';
          suggestedAction = '计划补货';
        } else {
          return null; // 库存正常，不需要预警
        }

        // 计算预计缺货天数（简化计算）
        const averageDailySales = 2; // 假设平均每日销售2件
        const daysUntilStockout =
          currentStock > 0 ? Math.floor(currentStock / averageDailySales) : 0;

        return {
          id: `alert-${inventory.id}`,
          productId: inventory.productId,
          productName: inventory.product.name,
          productCode: inventory.product.code,
          colorCode: inventory.colorCode || undefined,
          currentStock,
          safetyStock,
          alertLevel,
          alertType,
          lastUpdated: inventory.updatedAt.toISOString(),
          daysUntilStockout:
            daysUntilStockout > 0 ? daysUntilStockout : undefined,
          suggestedAction,
        };
      })
      .filter(Boolean) // 过滤掉null值
      .slice(0, 20); // 限制返回数量

    return NextResponse.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    console.error('获取库存预警失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取库存预警失败',
      },
      { status: 500 }
    );
  }
}
