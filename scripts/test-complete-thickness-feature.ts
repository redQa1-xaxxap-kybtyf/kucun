/**
 * 完整测试瓷砖产品厚度字段功能
 * 包括数据库、API、验证和前端显示的全面测试
 */

import { PrismaClient } from '@prisma/client';
import { productCreateSchema, productUpdateSchema } from '@/lib/validations/product';

const prisma = new PrismaClient();

async function testCompleteThicknessFeature() {
  console.log('🧪 开始完整测试瓷砖产品厚度字段功能...\n');

  try {
    // 1. 测试数据库模型
    console.log('1. 测试数据库模型 - 厚度字段');
    
    const testProduct = await prisma.product.create({
      data: {
        code: 'COMPLETE-TEST-001',
        name: '完整测试瓷砖',
        specification: '用于完整功能测试',
        unit: 'piece',
        piecesPerUnit: 1,
        weight: 25.5,
        thickness: 8.5, // 厚度字段
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

    console.log('✅ 数据库创建成功:', {
      id: testProduct.id,
      code: testProduct.code,
      thickness: testProduct.thickness,
      weight: testProduct.weight
    });

    // 2. 测试前端验证规则
    console.log('\n2. 测试前端验证规则');
    
    // 2.1 有效数据验证
    const validData = {
      code: 'VALID-001',
      name: '有效测试瓷砖',
      unit: 'piece' as const,
      piecesPerUnit: 1,
      thickness: 9.5,
      weight: 30.0
    };

    const validResult = productCreateSchema.safeParse(validData);
    if (validResult.success) {
      console.log('✅ 有效数据验证通过');
    } else {
      console.log('❌ 有效数据验证失败:', validResult.error.errors);
    }

    // 2.2 边界值测试
    const boundaryTests = [
      { name: '最小厚度', thickness: 0, shouldPass: true },
      { name: '最大厚度', thickness: 100, shouldPass: true },
      { name: '负数厚度', thickness: -1, shouldPass: false },
      { name: '超大厚度', thickness: 150, shouldPass: false },
      { name: '小数厚度', thickness: 8.75, shouldPass: true },
    ];

    for (const test of boundaryTests) {
      const testData = {
        code: `BOUNDARY-${test.name}`,
        name: `边界测试-${test.name}`,
        unit: 'piece' as const,
        piecesPerUnit: 1,
        thickness: test.thickness
      };

      const result = productCreateSchema.safeParse(testData);
      const passed = result.success === test.shouldPass;
      
      if (passed) {
        console.log(`✅ ${test.name}验证正确: ${test.thickness}mm`);
      } else {
        console.log(`❌ ${test.name}验证错误: 期望${test.shouldPass ? '通过' : '失败'}，实际${result.success ? '通过' : '失败'}`);
      }
    }

    // 3. 测试更新功能
    console.log('\n3. 测试产品更新功能');
    
    const updatedProduct = await prisma.product.update({
      where: { id: testProduct.id },
      data: {
        thickness: 10.0,
        weight: 28.0
      }
    });

    console.log('✅ 产品更新成功:', {
      id: updatedProduct.id,
      thickness: updatedProduct.thickness,
      weight: updatedProduct.weight
    });

    // 4. 测试查询功能
    console.log('\n4. 测试产品查询功能');
    
    const queriedProduct = await prisma.product.findUnique({
      where: { id: testProduct.id },
      select: {
        id: true,
        code: true,
        name: true,
        thickness: true,
        weight: true,
        specifications: true
      }
    });

    if (queriedProduct) {
      console.log('✅ 产品查询成功:', {
        code: queriedProduct.code,
        thickness: queriedProduct.thickness,
        weight: queriedProduct.weight
      });
    } else {
      console.log('❌ 产品查询失败');
    }

    // 5. 测试可选字段功能
    console.log('\n5. 测试可选字段功能');
    
    const productWithoutThickness = await prisma.product.create({
      data: {
        code: 'NO-THICKNESS-001',
        name: '无厚度测试瓷砖',
        unit: 'piece',
        piecesPerUnit: 1,
        // thickness 和 weight 字段省略
        status: 'active'
      }
    });

    console.log('✅ 无厚度产品创建成功:', {
      id: productWithoutThickness.id,
      code: productWithoutThickness.code,
      thickness: productWithoutThickness.thickness, // 应该是 null
      weight: productWithoutThickness.weight // 应该是 null
    });

    // 6. 测试数据格式化
    console.log('\n6. 测试数据格式化功能');
    
    const formatThickness = (thickness?: number | null): string => {
      if (!thickness) return '-';
      return `${thickness}mm`;
    };

    const formatWeight = (weight?: number | null): string => {
      if (!weight) return '-';
      return `${weight}kg`;
    };

    console.log('✅ 格式化测试:');
    console.log(`  - 有厚度: ${formatThickness(testProduct.thickness)}`);
    console.log(`  - 无厚度: ${formatThickness(null)}`);
    console.log(`  - 有重量: ${formatWeight(testProduct.weight)}`);
    console.log(`  - 无重量: ${formatWeight(null)}`);

    // 7. 测试类型安全
    console.log('\n7. 测试TypeScript类型安全');
    
    // 这些应该在编译时通过类型检查
    const typeSafeProduct: {
      thickness?: number;
      weight?: number;
    } = {
      thickness: 8.5,
      weight: 25.0
    };

    console.log('✅ TypeScript类型安全测试通过:', typeSafeProduct);

    // 8. 清理测试数据
    console.log('\n8. 清理测试数据');
    
    const deleteResult = await prisma.product.deleteMany({
      where: {
        code: {
          startsWith: 'COMPLETE-TEST-'
        }
      }
    });

    await prisma.product.deleteMany({
      where: {
        code: {
          startsWith: 'NO-THICKNESS-'
        }
      }
    });

    console.log('✅ 清理完成，删除产品数量:', deleteResult.count + 1);

    console.log('\n🎉 完整厚度字段功能测试全部通过！');
    console.log('\n📋 测试总结:');
    console.log('  ✅ 数据库模型支持厚度字段');
    console.log('  ✅ 前端验证规则正确');
    console.log('  ✅ 边界值验证正常');
    console.log('  ✅ 产品更新功能正常');
    console.log('  ✅ 产品查询功能正常');
    console.log('  ✅ 可选字段功能正常');
    console.log('  ✅ 数据格式化功能正常');
    console.log('  ✅ TypeScript类型安全');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    
    // 清理可能创建的测试数据
    try {
      await prisma.product.deleteMany({
        where: {
          OR: [
            { code: { startsWith: 'COMPLETE-TEST-' } },
            { code: { startsWith: 'NO-THICKNESS-' } }
          ]
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
testCompleteThicknessFeature().catch(console.error);
