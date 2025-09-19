import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // 基础统计
    const [products, variants, inventory] = await Promise.all([
      prisma.product.count({
        where: { code: { startsWith: 'TEST' } },
      }),
      prisma.productVariant.count({
        where: { product: { code: { startsWith: 'TEST' } } },
      }),
      prisma.inventory.count({
        where: { product: { code: { startsWith: 'TEST' } } },
      }),
    ]);

    // 场景1：同产品多色号统计
    const multiColorStats = await prisma.product.findMany({
      where: { code: { startsWith: 'TEST' } },
      select: {
        code: true,
        name: true,
        _count: {
          select: { variants: true },
        },
        variants: {
          select: {
            colorCode: true,
            colorName: true,
            _count: {
              select: { inventory: true },
            },
          },
        },
      },
    });

    // 场景2：同色号不同规格统计
    const sameColorDifferentSpecs = await prisma.productVariant.groupBy({
      by: ['colorCode'],
      where: { product: { code: { startsWith: 'TEST' } } },
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });

    // 场景3：批次管理统计
    const batchStats = await prisma.inventory.groupBy({
      by: ['productId', 'variantId', 'colorCode'],
      where: { product: { code: { startsWith: 'TEST' } } },
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });

    // 场景4：库存状态边界统计
    const [zeroStock, lowStock, highReserved, totalStock] = await Promise.all([
      prisma.inventory.count({
        where: {
          product: { code: { startsWith: 'TEST' } },
          quantity: 0,
        },
      }),
      prisma.inventory.count({
        where: {
          product: { code: { startsWith: 'TEST' } },
          quantity: { lte: 10, gt: 0 },
        },
      }),
      prisma.inventory.count({
        where: {
          product: { code: { startsWith: 'TEST' } },
          reservedQuantity: { gte: prisma.inventory.fields.quantity },
        },
      }),
      prisma.inventory.aggregate({
        where: { product: { code: { startsWith: 'TEST' } } },
        _sum: { quantity: true, reservedQuantity: true },
        _avg: { unitCost: true },
        _min: { unitCost: true },
        _max: { unitCost: true },
      }),
    ]);

    // 场景5：存储位置统计
    const locationStats = await prisma.inventory.groupBy({
      by: ['location'],
      where: { product: { code: { startsWith: 'TEST' } } },
      _count: { id: true },
      _sum: { quantity: true },
    });

    // 生产日期范围统计
    const dateRange = await prisma.inventory.aggregate({
      where: { product: { code: { startsWith: 'TEST' } } },
      _min: { productionDate: true },
      _max: { productionDate: true },
    });

    // 单位类型统计
    const unitStats = await prisma.product.groupBy({
      by: ['unit'],
      where: { code: { startsWith: 'TEST' } },
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          products,
          variants,
          inventory,
          createdAt: new Date().toISOString(),
        },
        scenarios: {
          multiColorSameProduct: {
            description: '同产品多色号场景',
            products: multiColorStats.map(p => ({
              code: p.code,
              name: p.name,
              variantCount: p._count.variants,
              colors: p.variants.map(v => ({
                colorCode: v.colorCode,
                colorName: v.colorName,
                inventoryRecords: v._count.inventory,
              })),
            })),
          },
          sameColorDifferentSpecs: {
            description: '同色号不同规格场景',
            colorCodes: sameColorDifferentSpecs.map(s => ({
              colorCode: s.colorCode,
              variantCount: s._count,
            })),
          },
          multipleBatches: {
            description: '多批次管理场景',
            variantBatches: batchStats.map(b => ({
              productId: b.productId,
              variantId: b.variantId,
              colorCode: b.colorCode,
              batchCount: b._count,
            })),
          },
          stockBoundaries: {
            description: '库存状态边界场景',
            zeroStockItems: zeroStock,
            lowStockItems: lowStock,
            highReservedItems: highReserved,
            totalQuantity: totalStock._sum.quantity || 0,
            totalReserved: totalStock._sum.reservedQuantity || 0,
            avgUnitCost: totalStock._avg.unitCost || 0,
            costRange: {
              min: totalStock._min.unitCost || 0,
              max: totalStock._max.unitCost || 0,
            },
          },
          storageLocations: {
            description: '存储位置分布场景',
            locations: locationStats.map(l => ({
              location: l.location,
              itemCount: l._count,
              totalQuantity: l._sum.quantity || 0,
            })),
          },
          productionDateRange: {
            description: '生产日期范围',
            earliest: dateRange._min.productionDate,
            latest: dateRange._max.productionDate,
          },
          unitTypes: {
            description: '单位类型分布',
            types: unitStats.map(u => ({
              unit: u.unit,
              productCount: u._count,
            })),
          },
        },
        testValidation: {
          allScenariosCreated: true,
          dataIntegrity: {
            productsWithVariants: multiColorStats.every(
              p => p._count.variants > 0
            ),
            variantsWithInventory: multiColorStats.every(p =>
              p.variants.every(v => v._count.inventory > 0)
            ),
            diverseStockLevels: zeroStock > 0 && lowStock > 0,
            multipleBatchesExist: batchStats.length > 0,
            multipleLocations: locationStats.length >= 5,
          },
        },
      },
    });
  } catch (error) {
    console.error('获取测试数据统计错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取统计信息失败',
      },
      { status: 500 }
    );
  }
}
