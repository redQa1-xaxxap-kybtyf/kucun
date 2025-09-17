import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    // 创建测试产品
    const product1 = await prisma.product.create({
      data: {
        code: 'TEST001',
        name: '测试瓷砖A',
        specification: '600x600mm',
        unit: 'piece',
        piecesPerUnit: 1,
        status: 'active',
      },
    });

    const product2 = await prisma.product.create({
      data: {
        code: 'TEST002',
        name: '测试瓷砖B',
        specification: '800x800mm',
        unit: 'piece',
        piecesPerUnit: 1,
        status: 'active',
      },
    });

    // 创建产品变体
    const variant1 = await prisma.productVariant.create({
      data: {
        productId: product1.id,
        colorCode: 'W001',
        colorName: '纯白色',
        colorValue: '#FFFFFF',
        sku: 'TEST001-W001',
        status: 'active',
      },
    });

    const variant2 = await prisma.productVariant.create({
      data: {
        productId: product1.id,
        colorCode: 'G001',
        colorName: '浅灰色',
        colorValue: '#E5E5E5',
        sku: 'TEST001-G001',
        status: 'active',
      },
    });

    const variant3 = await prisma.productVariant.create({
      data: {
        productId: product2.id,
        colorCode: 'B001',
        colorName: '深蓝色',
        colorValue: '#1E3A8A',
        sku: 'TEST002-B001',
        status: 'active',
      },
    });

    // 创建库存记录
    await prisma.inventory.create({
      data: {
        productId: product1.id,
        variantId: variant1.id,
        colorCode: 'W001',
        productionDate: new Date('2024-01-15'),
        batchNumber: 'BATCH001',
        quantity: 100,
        reservedQuantity: 10,
        unitCost: 25.50,
        location: '仓库A-01',
      },
    });

    await prisma.inventory.create({
      data: {
        productId: product1.id,
        variantId: variant2.id,
        colorCode: 'G001',
        productionDate: new Date('2024-01-20'),
        batchNumber: 'BATCH002',
        quantity: 50,
        reservedQuantity: 5,
        unitCost: 26.00,
        location: '仓库A-02',
      },
    });

    await prisma.inventory.create({
      data: {
        productId: product2.id,
        variantId: variant3.id,
        colorCode: 'B001',
        productionDate: new Date('2024-02-01'),
        batchNumber: 'BATCH003',
        quantity: 75,
        reservedQuantity: 0,
        unitCost: 30.00,
        location: '仓库B-01',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: '测试数据创建成功',
        created: {
          products: 2,
          variants: 3,
          inventory: 3,
        },
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
