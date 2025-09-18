/**
 * 测试瓷砖产品厚度字段功能
 * 验证厚度字段在创建和更新产品时的正确性
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testThicknessField() {
  console.log('🧪 开始测试瓷砖产品厚度字段功能...\n');

  try {
    // 1. 测试创建带厚度的产品
    console.log('1. 测试创建带厚度的产品');
    const productWithThickness = await prisma.product.create({
      data: {
        code: 'TEST-THICKNESS-001',
        name: '测试厚度瓷砖',
        specification: '测试用瓷砖产品',
        unit: 'piece',
        piecesPerUnit: 1,
        weight: 25.5,
        thickness: 8.5, // 厚度 8.5mm
        status: 'active',
        specifications: JSON.stringify({
          color: '米白色',
          surface: '抛光',
          size: '800×800mm',
          thickness: 8.5,
          pattern: '石纹',
          grade: '优等品',
          origin: '广东佛山',
          series: '现代简约系列'
        })
      }
    });

    console.log('✅ 创建成功:', {
      id: productWithThickness.id,
      code: productWithThickness.code,
      name: productWithThickness.name,
      thickness: productWithThickness.thickness,
      weight: productWithThickness.weight
    });

    // 2. 测试创建不带厚度的产品（可选字段）
    console.log('\n2. 测试创建不带厚度的产品（可选字段）');
    const productWithoutThickness = await prisma.product.create({
      data: {
        code: 'TEST-NO-THICKNESS-001',
        name: '测试无厚度瓷砖',
        specification: '测试用瓷砖产品（无厚度）',
        unit: 'piece',
        piecesPerUnit: 1,
        weight: 20.0,
        // thickness 字段省略，应该为 null
        status: 'active'
      }
    });

    console.log('✅ 创建成功:', {
      id: productWithoutThickness.id,
      code: productWithoutThickness.code,
      name: productWithoutThickness.name,
      thickness: productWithoutThickness.thickness, // 应该是 null
      weight: productWithoutThickness.weight
    });

    // 3. 测试更新产品厚度
    console.log('\n3. 测试更新产品厚度');
    const updatedProduct = await prisma.product.update({
      where: { id: productWithoutThickness.id },
      data: {
        thickness: 10.0 // 添加厚度
      }
    });

    console.log('✅ 更新成功:', {
      id: updatedProduct.id,
      code: updatedProduct.code,
      thickness: updatedProduct.thickness // 应该是 10.0
    });

    // 4. 测试查询产品列表（包含厚度字段）
    console.log('\n4. 测试查询产品列表（包含厚度字段）');
    const products = await prisma.product.findMany({
      where: {
        code: {
          startsWith: 'TEST-'
        }
      },
      select: {
        id: true,
        code: true,
        name: true,
        thickness: true,
        weight: true,
        specifications: true
      }
    });

    console.log('✅ 查询成功，找到产品数量:', products.length);
    products.forEach(product => {
      console.log(`  - ${product.code}: 厚度=${product.thickness}mm, 重量=${product.weight}kg`);
    });

    // 5. 测试厚度字段的边界值
    console.log('\n5. 测试厚度字段的边界值');
    
    // 测试最小值 0
    const productMinThickness = await prisma.product.create({
      data: {
        code: 'TEST-MIN-THICKNESS',
        name: '最小厚度测试',
        thickness: 0,
        unit: 'piece',
        piecesPerUnit: 1,
        status: 'active'
      }
    });
    console.log('✅ 最小厚度测试成功:', productMinThickness.thickness);

    // 测试最大值 100
    const productMaxThickness = await prisma.product.create({
      data: {
        code: 'TEST-MAX-THICKNESS',
        name: '最大厚度测试',
        thickness: 100,
        unit: 'piece',
        piecesPerUnit: 1,
        status: 'active'
      }
    });
    console.log('✅ 最大厚度测试成功:', productMaxThickness.thickness);

    // 6. 清理测试数据
    console.log('\n6. 清理测试数据');
    const deleteResult = await prisma.product.deleteMany({
      where: {
        code: {
          startsWith: 'TEST-'
        }
      }
    });
    console.log('✅ 清理完成，删除产品数量:', deleteResult.count);

    console.log('\n🎉 所有测试通过！厚度字段功能正常。');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    
    // 清理可能创建的测试数据
    try {
      await prisma.product.deleteMany({
        where: {
          code: {
            startsWith: 'TEST-'
          }
        }
      });
      console.log('🧹 已清理测试数据');
    } catch (cleanupError) {
      console.error('清理测试数据失败:', cleanupError);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testThicknessField().catch(console.error);
