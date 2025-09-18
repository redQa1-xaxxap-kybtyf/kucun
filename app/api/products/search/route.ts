// 产品搜索API路由
// 为入库表单提供产品搜索功能

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { productSearchSchema } from '@/lib/validations/inbound';
import type { ProductOption } from '@/lib/types/inbound';

// GET /api/products/search - 搜索产品
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: API_ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const { search, limit } = productSearchSchema.parse({
      search: searchParams.get('search'),
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
    });

    // 构建搜索条件
    const where = {
      status: 'active' as const,
      OR: [
        { name: { contains: search } },
        { code: { contains: search } },
        { specification: { contains: search } },
      ],
    };

    // 搜索产品
    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        code: true,
        name: true,
        specification: true,
        unit: true,
        // 获取当前库存
        inventory: {
          select: {
            quantity: true,
          },
        },
      },
      take: limit,
      orderBy: [
        { name: 'asc' },
        { code: 'asc' },
      ],
    });

    // 转换为选项格式
    const options: ProductOption[] = products.map(product => {
      // 计算总库存
      const currentStock = product.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
      
      return {
        value: product.id,
        label: `${product.name}${product.specification ? ` (${product.specification})` : ''}`,
        code: product.code,
        unit: product.unit,
        currentStock,
      };
    });

    return NextResponse.json({
      success: true,
      data: options,
    });

  } catch (error) {
    console.error('搜索产品失败:', error);
    return NextResponse.json(
      { success: false, error: '搜索产品失败' },
      { status: 500 }
    );
  }
}
