import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // 测试数据库连接
    const productCount = await prisma.product.count();
    const inventoryCount = await prisma.inventory.count();
    const variantCount = await prisma.productVariant.count();

    return NextResponse.json({
      success: true,
      data: {
        message: '数据库连接正常',
        counts: {
          products: productCount,
          inventory: inventoryCount,
          variants: variantCount,
        },
      },
    });
  } catch (error) {
    console.error('数据库连接测试失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '数据库连接失败',
        details: error,
      },
      { status: 500 }
    );
  }
}
