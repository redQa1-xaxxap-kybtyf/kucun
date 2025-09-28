import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface DateSummary {
  productionDate: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  batches: number;
}

// 获取产品变体的库存汇总
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { id } = params;

    // 验证ID格式
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: '变体ID格式不正确' },
        { status: 400 }
      );
    }

    // 检查变体是否存在
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      select: {
        id: true,
        colorCode: true,
        sku: true,
        product: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!variant) {
      return NextResponse.json(
        { success: false, error: '产品变体不存在' },
        { status: 404 }
      );
    }

    // 查询变体的所有库存记录
    const inventoryRecords = await prisma.inventory.findMany({
      where: { variantId: id },
      select: {
        id: true,
        quantity: true,
        reservedQuantity: true,
        location: true,
        productionDate: true,
        batchNumber: true,
        unitCost: true,
        updatedAt: true,
      },
      orderBy: [
        { location: 'asc' },
        { productionDate: 'desc' },
        { batchNumber: 'asc' },
      ],
    });

    // 计算汇总数据
    const totalQuantity = inventoryRecords.reduce(
      (sum, record) => sum + record.quantity,
      0
    );
    const reservedQuantity = inventoryRecords.reduce(
      (sum, record) => sum + record.reservedQuantity,
      0
    );
    const availableQuantity = totalQuantity - reservedQuantity;

    // 按位置分组统计
    const locationSummary = inventoryRecords.reduce(
      (acc, record) => {
        const location = record.location || '未指定位置';
        if (!acc[location]) {
          acc[location] = {
            location,
            quantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
            batches: 0,
          };
        }
        acc[location].quantity += record.quantity;
        acc[location].reservedQuantity += record.reservedQuantity;
        acc[location].availableQuantity +=
          record.quantity - record.reservedQuantity;
        acc[location].batches += 1;
        return acc;
      },
      {} as Record<string, DateSummary>
    );

    const locations = Object.values(locationSummary);

    // 按生产日期分组统计
    const dateSummary = inventoryRecords.reduce(
      (acc, record) => {
        const dateKey = record.productionDate
          ? record.productionDate.toString()
          : '未指定日期';
        if (!acc[dateKey]) {
          acc[dateKey] = {
            productionDate: dateKey,
            quantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
            batches: 0,
          };
        }
        acc[dateKey].quantity += record.quantity;
        acc[dateKey].reservedQuantity += record.reservedQuantity;
        acc[dateKey].availableQuantity +=
          record.quantity - record.reservedQuantity;
        acc[dateKey].batches += 1;
        return acc;
      },
      {} as Record<string, DateSummary>
    );

    const productionDates = Object.values(dateSummary).sort(
      (a: DateSummary, b: DateSummary) => {
        if (a.productionDate === '未指定日期') return 1;
        if (b.productionDate === '未指定日期') return -1;
        return (
          new Date(b.productionDate).getTime() -
          new Date(a.productionDate).getTime()
        );
      }
    );

    // 计算平均成本
    const totalCost = inventoryRecords.reduce(
      (sum, record) => sum + (record.unitCost || 0) * record.quantity,
      0
    );
    const averageUnitCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

    // 最新更新时间
    const lastUpdated =
      inventoryRecords.length > 0
        ? inventoryRecords.reduce(
            (latest, record) =>
              record.updatedAt > latest ? record.updatedAt : latest,
            inventoryRecords[0].updatedAt
          )
        : null;

    // 库存预警状态
    const lowStockThreshold = 10; // 可以从配置中获取
    const stockStatus =
      totalQuantity <= 0
        ? 'out_of_stock'
        : totalQuantity <= lowStockThreshold
          ? 'low_stock'
          : 'in_stock';

    // 构建响应数据
    const summary = {
      variant: {
        id: variant.id,
        colorCode: variant.colorCode,
        sku: variant.sku,
        product: variant.product,
      },
      inventory: {
        totalQuantity,
        reservedQuantity,
        availableQuantity,
        averageUnitCost,
        stockStatus,
        lastUpdated,
      },
      breakdown: {
        locations,
        productionDates,
        totalBatches: inventoryRecords.length,
        totalLocations: locations.length,
      },
      details: inventoryRecords.map(record => ({
        id: record.id,
        quantity: record.quantity,
        reservedQuantity: record.reservedQuantity,
        availableQuantity: record.quantity - record.reservedQuantity,
        location: record.location,
        productionDate: record.productionDate,
        batchNumber: record.batchNumber,
        unitCost: record.unitCost,
        updatedAt: record.updatedAt,
      })),
    };

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('获取变体库存汇总错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取变体库存汇总失败',
      },
      { status: 500 }
    );
  }
}
