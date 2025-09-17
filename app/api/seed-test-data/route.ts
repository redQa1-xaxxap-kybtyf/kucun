import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // 清理现有测试数据
    await prisma.inventory.deleteMany({
      where: {
        product: {
          code: {
            startsWith: 'TEST'
          }
        }
      }
    });
    await prisma.productVariant.deleteMany({
      where: {
        product: {
          code: {
            startsWith: 'TEST'
          }
        }
      }
    });
    await prisma.product.deleteMany({
      where: {
        code: {
          startsWith: 'TEST'
        }
      }
    });

    // 场景1：同产品多色号场景 - 高端瓷砖系列
    const luxuryTile = await prisma.product.create({
      data: {
        code: 'TEST001',
        name: '豪华大理石纹瓷砖',
        specification: '600x600mm',
        unit: 'piece',
        piecesPerUnit: 1,
        status: 'active',
      },
    });

    // 场景2：同产品不同规格场景 - 经典系列
    const classicTile600 = await prisma.product.create({
      data: {
        code: 'TEST002',
        name: '经典仿古砖',
        specification: '600x600mm',
        unit: 'piece',
        piecesPerUnit: 1,
        status: 'active',
      },
    });

    const classicTile800 = await prisma.product.create({
      data: {
        code: 'TEST003',
        name: '经典仿古砖',
        specification: '800x800mm',
        unit: 'piece',
        piecesPerUnit: 1,
        status: 'active',
      },
    });

    // 场景3：现代简约系列
    const modernTile = await prisma.product.create({
      data: {
        code: 'TEST004',
        name: '现代简约瓷砖',
        specification: '300x600mm',
        unit: 'piece',
        piecesPerUnit: 1,
        status: 'active',
      },
    });

    // 场景4：工业风系列
    const industrialTile = await prisma.product.create({
      data: {
        code: 'TEST005',
        name: '工业风水泥砖',
        specification: '200x200mm',
        unit: 'box',
        piecesPerUnit: 25,
        status: 'active',
      },
    });

    // ===== 创建产品变体 =====

    // 豪华大理石纹瓷砖的多色号变体（场景1：同产品多色号）
    const luxuryVariants = await Promise.all([
      prisma.productVariant.create({
        data: {
          productId: luxuryTile.id,
          colorCode: 'W001',
          colorName: '雪花白',
          colorValue: '#FFFFFF',
          sku: 'TEST001-W001',
          status: 'active',
        },
      }),
      prisma.productVariant.create({
        data: {
          productId: luxuryTile.id,
          colorCode: 'G001',
          colorName: '卡拉拉灰',
          colorValue: '#E5E5E5',
          sku: 'TEST001-G001',
          status: 'active',
        },
      }),
      prisma.productVariant.create({
        data: {
          productId: luxuryTile.id,
          colorCode: 'B001',
          colorName: '爵士黑',
          colorValue: '#2D2D2D',
          sku: 'TEST001-B001',
          status: 'active',
        },
      }),
      prisma.productVariant.create({
        data: {
          productId: luxuryTile.id,
          colorCode: 'Y001',
          colorName: '香槟金',
          colorValue: '#F7E7CE',
          sku: 'TEST001-Y001',
          status: 'active',
        },
      }),
      prisma.productVariant.create({
        data: {
          productId: luxuryTile.id,
          colorCode: 'R001',
          colorName: '玫瑰红',
          colorValue: '#D4A574',
          sku: 'TEST001-R001',
          status: 'active',
        },
      }),
    ]);

    // 经典仿古砖600x600的变体（场景2：同产品不同规格）
    const classic600Variants = await Promise.all([
      prisma.productVariant.create({
        data: {
          productId: classicTile600.id,
          colorCode: 'A001',
          colorName: '古铜色',
          colorValue: '#8B4513',
          sku: 'TEST002-A001',
          status: 'active',
        },
      }),
      prisma.productVariant.create({
        data: {
          productId: classicTile600.id,
          colorCode: 'A002',
          colorName: '复古棕',
          colorValue: '#A0522D',
          sku: 'TEST002-A002',
          status: 'active',
        },
      }),
      prisma.productVariant.create({
        data: {
          productId: classicTile600.id,
          colorCode: 'A003',
          colorName: '暖米色',
          colorValue: '#F5DEB3',
          sku: 'TEST002-A003',
          status: 'active',
        },
      }),
    ]);

    // 经典仿古砖800x800的变体（场景2：同产品不同规格）
    const classic800Variants = await Promise.all([
      prisma.productVariant.create({
        data: {
          productId: classicTile800.id,
          colorCode: 'A001',
          colorName: '古铜色',
          colorValue: '#8B4513',
          sku: 'TEST003-A001',
          status: 'active',
        },
      }),
      prisma.productVariant.create({
        data: {
          productId: classicTile800.id,
          colorCode: 'A002',
          colorName: '复古棕',
          colorValue: '#A0522D',
          sku: 'TEST003-A002',
          status: 'active',
        },
      }),
    ]);

    // 现代简约瓷砖的变体
    const modernVariants = await Promise.all([
      prisma.productVariant.create({
        data: {
          productId: modernTile.id,
          colorCode: 'M001',
          colorName: '极简白',
          colorValue: '#FAFAFA',
          sku: 'TEST004-M001',
          status: 'active',
        },
      }),
      prisma.productVariant.create({
        data: {
          productId: modernTile.id,
          colorCode: 'M002',
          colorName: '现代灰',
          colorValue: '#9E9E9E',
          sku: 'TEST004-M002',
          status: 'active',
        },
      }),
    ]);

    // 工业风水泥砖的变体
    const industrialVariants = await Promise.all([
      prisma.productVariant.create({
        data: {
          productId: industrialTile.id,
          colorCode: 'I001',
          colorName: '原始水泥',
          colorValue: '#808080',
          sku: 'TEST005-I001',
          status: 'active',
        },
      }),
      prisma.productVariant.create({
        data: {
          productId: industrialTile.id,
          colorCode: 'I002',
          colorName: '深度水泥',
          colorValue: '#696969',
          sku: 'TEST005-I002',
          status: 'active',
        },
      }),
    ]);

    // ===== 创建复杂的库存记录 =====

    const inventoryRecords = [];

    // 场景1：豪华大理石纹瓷砖 - 同产品多色号，相同生产日期
    const luxuryProductionDate = new Date('2024-01-15');

    // 雪花白 - 多批次场景
    inventoryRecords.push(
      // 第一批次 - 正常库存
      {
        productId: luxuryTile.id,
        variantId: luxuryVariants[0].id,
        colorCode: 'W001',
        productionDate: luxuryProductionDate,
        batchNumber: 'LUX-W001-001',
        quantity: 150,
        reservedQuantity: 20,
        unitCost: 45.50,
        location: '仓库A-01-A',
      },
      // 第二批次 - 同色号不同批次
      {
        productId: luxuryTile.id,
        variantId: luxuryVariants[0].id,
        colorCode: 'W001',
        productionDate: new Date('2024-01-20'),
        batchNumber: 'LUX-W001-002',
        quantity: 80,
        reservedQuantity: 5,
        unitCost: 46.00,
        location: '仓库A-01-B',
      }
    );

    // 卡拉拉灰 - 高预留库存场景
    inventoryRecords.push({
      productId: luxuryTile.id,
      variantId: luxuryVariants[1].id,
      colorCode: 'G001',
      productionDate: luxuryProductionDate,
      batchNumber: 'LUX-G001-001',
      quantity: 100,
      reservedQuantity: 85, // 高预留库存
      unitCost: 47.00,
      location: '仓库A-02-A',
    });

    // 爵士黑 - 低库存预警场景
    inventoryRecords.push({
      productId: luxuryTile.id,
      variantId: luxuryVariants[2].id,
      colorCode: 'B001',
      productionDate: luxuryProductionDate,
      batchNumber: 'LUX-B001-001',
      quantity: 8, // 低库存
      reservedQuantity: 2,
      unitCost: 48.50,
      location: '仓库A-03-A',
    });

    // 香槟金 - 零库存场景
    inventoryRecords.push({
      productId: luxuryTile.id,
      variantId: luxuryVariants[3].id,
      colorCode: 'Y001',
      productionDate: luxuryProductionDate,
      batchNumber: 'LUX-Y001-001',
      quantity: 0, // 零库存
      reservedQuantity: 0,
      unitCost: 52.00,
      location: '仓库A-04-A',
    });

    // 玫瑰红 - 正常库存，不同位置
    inventoryRecords.push({
      productId: luxuryTile.id,
      variantId: luxuryVariants[4].id,
      colorCode: 'R001',
      productionDate: luxuryProductionDate,
      batchNumber: 'LUX-R001-001',
      quantity: 60,
      reservedQuantity: 10,
      unitCost: 50.00,
      location: '仓库B-01-A',
    });

    // 场景2：经典仿古砖 - 同产品不同规格，相同色号
    const classicProductionDate = new Date('2024-02-01');

    // 600x600 古铜色
    inventoryRecords.push({
      productId: classicTile600.id,
      variantId: classic600Variants[0].id,
      colorCode: 'A001',
      productionDate: classicProductionDate,
      batchNumber: 'CLS-600-A001-001',
      quantity: 200,
      reservedQuantity: 30,
      unitCost: 28.50,
      location: '仓库B-02-A',
    });

    // 800x800 古铜色 - 相同色号不同规格
    inventoryRecords.push({
      productId: classicTile800.id,
      variantId: classic800Variants[0].id,
      colorCode: 'A001',
      productionDate: classicProductionDate,
      batchNumber: 'CLS-800-A001-001',
      quantity: 120,
      reservedQuantity: 15,
      unitCost: 35.00,
      location: '仓库B-02-B',
    });

    // 600x600 复古棕 - 多个生产日期
    inventoryRecords.push(
      {
        productId: classicTile600.id,
        variantId: classic600Variants[1].id,
        colorCode: 'A002',
        productionDate: classicProductionDate,
        batchNumber: 'CLS-600-A002-001',
        quantity: 90,
        reservedQuantity: 12,
        unitCost: 29.00,
        location: '仓库B-03-A',
      },
      {
        productId: classicTile600.id,
        variantId: classic600Variants[1].id,
        colorCode: 'A002',
        productionDate: new Date('2024-02-15'), // 不同生产日期
        batchNumber: 'CLS-600-A002-002',
        quantity: 110,
        reservedQuantity: 8,
        unitCost: 29.50,
        location: '仓库B-03-B',
      }
    );

    // 600x600 暖米色 - 边界库存场景
    inventoryRecords.push({
      productId: classicTile600.id,
      variantId: classic600Variants[2].id,
      colorCode: 'A003',
      productionDate: classicProductionDate,
      batchNumber: 'CLS-600-A003-001',
      quantity: 10, // 刚好库存预警线
      reservedQuantity: 0,
      unitCost: 27.50,
      location: '仓库B-04-A',
    });

    // 场景3：现代简约瓷砖 - 不同存储位置
    const modernProductionDate = new Date('2024-03-01');

    inventoryRecords.push(
      {
        productId: modernTile.id,
        variantId: modernVariants[0].id,
        colorCode: 'M001',
        productionDate: modernProductionDate,
        batchNumber: 'MOD-M001-001',
        quantity: 75,
        reservedQuantity: 5,
        unitCost: 32.00,
        location: '仓库C-01-A',
      },
      {
        productId: modernTile.id,
        variantId: modernVariants[1].id,
        colorCode: 'M002',
        productionDate: modernProductionDate,
        batchNumber: 'MOD-M002-001',
        quantity: 65,
        reservedQuantity: 10,
        unitCost: 33.50,
        location: '仓库C-02-A',
      }
    );

    // 场景4：工业风水泥砖 - 箱装单位，大批量
    const industrialProductionDate = new Date('2024-03-15');

    inventoryRecords.push(
      {
        productId: industrialTile.id,
        variantId: industrialVariants[0].id,
        colorCode: 'I001',
        productionDate: industrialProductionDate,
        batchNumber: 'IND-I001-001',
        quantity: 500, // 大批量
        reservedQuantity: 50,
        unitCost: 15.00,
        location: '仓库D-01-A',
      },
      {
        productId: industrialTile.id,
        variantId: industrialVariants[1].id,
        colorCode: 'I002',
        productionDate: industrialProductionDate,
        batchNumber: 'IND-I002-001',
        quantity: 300,
        reservedQuantity: 25,
        unitCost: 16.50,
        location: '仓库D-02-A',
      }
    );

    // 场景5：边界测试 - 极端情况
    inventoryRecords.push(
      // 超高库存
      {
        productId: classicTile800.id,
        variantId: classic800Variants[1].id,
        colorCode: 'A002',
        productionDate: new Date('2024-03-20'),
        batchNumber: 'CLS-800-A002-HIGH',
        quantity: 1000, // 超高库存
        reservedQuantity: 100,
        unitCost: 36.00,
        location: '仓库E-01-A',
      },
      // 库存等于预留（边界情况）
      {
        productId: modernTile.id,
        variantId: modernVariants[0].id,
        colorCode: 'M001',
        productionDate: new Date('2024-03-25'),
        batchNumber: 'MOD-M001-EDGE',
        quantity: 25,
        reservedQuantity: 25, // 库存等于预留
        unitCost: 32.50,
        location: '仓库E-02-A',
      }
    );

    // 批量创建库存记录
    const createdInventory = await Promise.all(
      inventoryRecords.map(record => prisma.inventory.create({ data: record }))
    );

    // 统计创建的数据
    const stats = {
      products: 5,
      variants: luxuryVariants.length + classic600Variants.length + classic800Variants.length + modernVariants.length + industrialVariants.length,
      inventory: createdInventory.length,
      scenarios: {
        multiColorSameProduct: luxuryVariants.length,
        sameColorDifferentSpecs: 2, // 古铜色在600和800规格中
        multipleBatches: 3, // 雪花白、复古棕有多批次
        lowStockItems: 2, // 爵士黑、暖米色
        zeroStockItems: 1, // 香槟金
        highReservedItems: 2, // 卡拉拉灰、库存等于预留
        locations: ['仓库A', '仓库B', '仓库C', '仓库D', '仓库E'],
        productionDateRange: '2024-01-15 到 2024-03-25',
      }
    };

    return NextResponse.json({
      success: true,
      data: {
        message: '丰富的测试数据创建成功',
        created: stats,
        testScenarios: [
          '✅ 同产品多色号场景：豪华大理石纹瓷砖包含5种色号',
          '✅ 同产品不同规格场景：经典仿古砖有600x600和800x800两种规格',
          '✅ 批次管理场景：雪花白和复古棕有多个生产批次',
          '✅ 库存状态边界场景：包含零库存、低库存、高预留库存',
          '✅ 存储位置场景：分布在5个不同仓库位置',
          '✅ 单位类型场景：包含片装和箱装两种单位',
          '✅ 成本范围场景：单位成本从15.00到52.00',
          '✅ 数量范围场景：库存从0到1000的各种情况',
        ],
      },
    });
  } catch (error) {
    console.error('创建测试数据错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建测试数据失败',
        details: error,
      },
      { status: 500 }
    );
  }
}
