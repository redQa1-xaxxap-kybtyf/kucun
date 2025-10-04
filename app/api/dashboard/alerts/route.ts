import { NextResponse, type NextRequest } from 'next/server';

import { verifyApiAuth, errorResponse } from '@/lib/api-helpers';
import { prisma } from '@/lib/db';
import { inventoryConfig } from '@/lib/env';

// 获取库存预警数据
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const auth = await verifyApiAuth(request);
    if (!auth.authenticated) {
      return errorResponse(auth.error || '未授权访问', 401);
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
        const safetyStock = inventoryConfig.defaultMinQuantity; // 使用环境配置的安全库存
        const currentStock = inventory.quantity;

        let alertLevel: 'warning' | 'danger' | 'critical';
        let alertType: 'low_stock' | 'out_of_stock' | 'overstock' | 'expired';
        let suggestedAction: string;

        if (currentStock === 0) {
          alertLevel = 'critical';
          alertType = 'out_of_stock';
          suggestedAction = '立即补货';
        } else if (currentStock <= inventoryConfig.criticalMinQuantity) {
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

        // 计算预计缺货天数（使用环境配置的平均日销量）
        const averageDailySales = inventoryConfig.averageDailySales;
        const daysUntilStockout =
          currentStock > 0 ? Math.floor(currentStock / averageDailySales) : 0;

        return {
          id: `alert-${inventory.id}`,
          productId: inventory.productId,
          productName: inventory.product.name,
          productCode: inventory.product.code,

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
      .slice(0, inventoryConfig.alertLimit); // 使用环境配置的限制数量

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
