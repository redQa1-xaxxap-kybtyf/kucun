// 产品搜索API路由
// 为入库表单提供产品搜索功能

import { getServerSession } from 'next-auth';
import { type NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { withErrorHandling } from '@/lib/api/middleware';
import { successResponse } from '@/lib/api/response';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { ProductOption } from '@/lib/types/inbound';
import { productSearchSchema } from '@/lib/validations/inbound';

// 智能排序函数：优先显示更相关的结果
function sortSearchResults(
  options: ProductOption[],
  search: string
): ProductOption[] {
  return options.sort((a, b) => {
    const searchLower = search.toLowerCase();
    const aCodeLower = a.code.toLowerCase();
    const bCodeLower = b.code.toLowerCase();
    const aNameLower = a.label.toLowerCase();
    const bNameLower = b.label.toLowerCase();

    // 1. 编码完全匹配优先
    if (aCodeLower === searchLower && bCodeLower !== searchLower) return -1;
    if (bCodeLower === searchLower && aCodeLower !== searchLower) return 1;

    // 2. 编码开头匹配优先
    const aCodeStartsWith = aCodeLower.startsWith(searchLower);
    const bCodeStartsWith = bCodeLower.startsWith(searchLower);
    if (aCodeStartsWith && !bCodeStartsWith) return -1;
    if (bCodeStartsWith && !aCodeStartsWith) return 1;

    // 3. 名称完全匹配优先
    if (aNameLower === searchLower && bNameLower !== searchLower) return -1;
    if (bNameLower === searchLower && aNameLower !== searchLower) return 1;

    // 4. 名称开头匹配优先
    const aNameStartsWith = aNameLower.startsWith(searchLower);
    const bNameStartsWith = bNameLower.startsWith(searchLower);
    if (aNameStartsWith && !bNameStartsWith) return -1;
    if (bNameStartsWith && !aNameStartsWith) return 1;

    // 5. 编码长度排序（短的优先，更可能是精确匹配）
    if (a.code.length !== b.code.length) {
      return a.code.length - b.code.length;
    }

    // 6. 最终按编码字母顺序排列
    return a.code.localeCompare(b.code);
  });
}

// 搜索产品数据库查询
async function searchProducts(search: string, limit: number) {
  const where = {
    status: 'active' as const,
    OR: [
      { name: { contains: search } },
      { code: { contains: search } },
      { specification: { contains: search } },
    ],
  };

  // 使用聚合查询优化库存统计
  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      code: true,
      name: true,
      specification: true,
      unit: true,
      piecesPerUnit: true,
    },
    take: limit,
    orderBy: [{ name: 'asc' }, { code: 'asc' }],
  });

  // 批量获取库存汇总，避免 N+1 查询
  const productIds = products.map(p => p.id);
  const inventorySummary = await prisma.inventory.groupBy({
    by: ['productId'],
    where: {
      productId: { in: productIds },
    },
    _sum: {
      quantity: true,
    },
  });

  // 创建库存映射
  const inventoryMap = new Map<string, number>();
  inventorySummary.forEach(item => {
    inventoryMap.set(item.productId, item._sum.quantity || 0);
  });

  // 返回带库存信息的产品数据
  return products.map(product => ({
    ...product,
    currentStock: inventoryMap.get(product.id) || 0,
  }));
}

// 转换产品数据为选项格式
function transformToOptions(
  products: Array<{
    id: string;
    code: string;
    name: string;
    specification: string | null;
    unit: string;
    piecesPerUnit: number;
    currentStock: number;
  }>
): ProductOption[] {
  return products.map(product => ({
    value: product.id,
    label: product.name,
    code: product.code,
    specification: product.specification ?? undefined,
    unit: product.unit,
    piecesPerUnit: product.piecesPerUnit,
    currentStock: product.currentStock,
  }));
}

// GET /api/products/search - 搜索产品
export const GET = withErrorHandling(async (request: NextRequest) => {
  // 1. 验证用户身份
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw ApiError.unauthorized();
  }

  // 2. 解析查询参数
  const { searchParams } = new URL(request.url);
  const { search, limit } = productSearchSchema.parse({
    search: searchParams.get('search'),
    limit: searchParams.get('limit')
      ? parseInt(searchParams.get('limit') || '20')
      : 20,
  });

  // 3. 搜索产品并转换格式
  const products = await searchProducts(search, limit);
  const options = transformToOptions(products);
  const sortedOptions = sortSearchResults(options, search);

  // 4. 返回成功响应
  return successResponse(sortedOptions);
});
