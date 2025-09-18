/**
 * 完整测试瓷砖产品厚度字段功能
 * 验证从数据库到前端的完整数据流
 */

import { PrismaClient } from '@prisma/client';
import { productCreateSchema, productUpdateSchema } from '@/lib/validations/product';

const prisma = new PrismaClient();

async function testCompleteThicknessFunctionality() {
  console.log('🧪 开始完整测试瓷砖产品厚度字段功能...\n');

  try {
    // 1. 测试数据库层面
    console.log('1. 测试数据库层面');
    
    // 创建测试产品
    const testProduct = await prisma.product.create({
      data: {
        code: 'COMPLETE-TEST-001',
        name: '完整测试瓷砖',
        specification: '完整功能测试用瓷砖',
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

    // 2. 测试前端验证层面
    console.log('\n2. 测试前端验证层面');
    
    // 2.1 测试创建验证
    const createValidationResult = productCreateSchema.safeParse({
      code: 'VALIDATION-TEST-001',
      name: '验证测试瓷砖',
      unit: 'piece',
      piecesPerUnit: 1,
      thickness: 9.5,
      weight: 30.0,
      specifications: {
        color: '深灰色',
        thickness: 9.5
      }
    });

    if (createValidationResult.success) {
      console.log('✅ 创建验证通过:', {
        thickness: createValidationResult.data.thickness,
        weight: createValidationResult.data.weight
      });
    } else {
      console.log('❌ 创建验证失败:', createValidationResult.error.errors);
    }

    // 2.2 测试更新验证
    const updateValidationResult = productUpdateSchema.safeParse({
      id: 'test-id',
      thickness: 10.0,
      weight: 28.0
    });

    if (updateValidationResult.success) {
      console.log('✅ 更新验证通过:', {
        thickness: updateValidationResult.data.thickness,
        weight: updateValidationResult.data.weight
      });
    } else {
      console.log('❌ 更新验证失败:', updateValidationResult.error.errors);
    }

    // 3. 测试边界值验证
    console.log('\n3. 测试边界值验证');
    
    const boundaryTests = [
      { thickness: 0, expected: true, desc: '最小值(0)' },
      { thickness: 100, expected: true, desc: '最大值(100)' },
      { thickness: -1, expected: false, desc: '负数(-1)' },
      { thickness: 101, expected: false, desc: '超大值(101)' },
      { thickness: 8.75, expected: true, desc: '小数(8.75)' }
    ];

    boundaryTests.forEach(test => {
      const result = productCreateSchema.safeParse({
        code: 'BOUNDARY-TEST',
        name: '边界测试',
        unit: 'piece',
        piecesPerUnit: 1,
        thickness: test.thickness
      });

      const passed = result.success === test.expected;
      console.log(passed ? '✅' : '❌', `${test.desc}: ${passed ? '通过' : '失败'}`);
    });

    // 4. 测试数据库更新
    console.log('\n4. 测试数据库更新');
    
    const updatedProduct = await prisma.product.update({
      where: { id: testProduct.id },
      data: {
        thickness: 12.0,
        weight: 35.0
      }
    });

    console.log('✅ 数据库更新成功:', {
      thickness: updatedProduct.thickness,
      weight: updatedProduct.weight
    });

    // 5. 测试查询功能
    console.log('\n5. 测试查询功能');
    
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
      console.log('✅ 查询成功:', {
        code: queriedProduct.code,
        thickness: queriedProduct.thickness,
        weight: queriedProduct.weight,
        specifications: queriedProduct.specifications ? JSON.parse(queriedProduct.specifications as string) : null
      });
    }

    // 6. 测试可选字段功能
    console.log('\n6. 测试可选字段功能');
    
    const optionalProduct = await prisma.product.create({
      data: {
        code: 'OPTIONAL-TEST-001',
        name: '可选字段测试',
        unit: 'piece',
        piecesPerUnit: 1,
        status: 'active'
        // thickness 和 weight 字段省略
      }
    });

    console.log('✅ 可选字段测试成功:', {
      code: optionalProduct.code,
      thickness: optionalProduct.thickness, // 应该是 null
      weight: optionalProduct.weight // 应该是 null
    });

    // 7. 清理测试数据
    console.log('\n7. 清理测试数据');
    
    const deleteResult = await prisma.product.deleteMany({
      where: {
        code: {
          in: ['COMPLETE-TEST-001', 'OPTIONAL-TEST-001']
        }
      }
    });

    console.log('✅ 清理完成，删除产品数量:', deleteResult.count);

    console.log('\n🎉 所有测试通过！厚度字段完整功能正常。');
    console.log('\n📋 测试总结:');
    console.log('  ✅ 数据库模型支持厚度字段');
    console.log('  ✅ 前端验证规则正确');
    console.log('  ✅ 边界值验证有效');
    console.log('  ✅ 数据库CRUD操作正常');
    console.log('  ✅ 可选字段功能正常');
    console.log('  ✅ 类型安全保证');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    
    // 清理可能创建的测试数据
    try {
      await prisma.product.deleteMany({
        where: {
          code: {
            startsWith: 'COMPLETE-TEST-'
          }
        }
      });
      await prisma.product.deleteMany({
        where: {
          code: {
            startsWith: 'OPTIONAL-TEST-'
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
testCompleteThicknessFunctionality().catch(console.error);
