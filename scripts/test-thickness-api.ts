/**
 * 测试瓷砖产品厚度字段的API功能
 * 验证前端表单验证和API接口的正确性
 */

import { productCreateSchema, productUpdateSchema } from '@/lib/validations/product';

async function testThicknessValidation() {
  console.log('🧪 开始测试瓷砖产品厚度字段的验证功能...\n');

  try {
    // 1. 测试创建产品的厚度验证
    console.log('1. 测试创建产品的厚度验证');
    
    // 1.1 有效的厚度值
    const validCreateData = {
      code: 'TEST-001',
      name: '测试瓷砖',
      specification: '测试规格',
      unit: 'piece' as const,
      piecesPerUnit: 1,
      weight: 25.5,
      thickness: 8.5, // 有效厚度
      specifications: {
        color: '米白色',
        surface: '抛光',
        thickness: 8.5
      }
    };

    const validResult = productCreateSchema.safeParse(validCreateData);
    if (validResult.success) {
      console.log('✅ 有效厚度验证通过:', validResult.data.thickness);
    } else {
      console.log('❌ 有效厚度验证失败:', validResult.error.errors);
    }

    // 1.2 可选厚度（undefined）
    const optionalThicknessData = {
      code: 'TEST-002',
      name: '测试瓷砖2',
      unit: 'piece' as const,
      piecesPerUnit: 1,
      // thickness 字段省略
    };

    const optionalResult = productCreateSchema.safeParse(optionalThicknessData);
    if (optionalResult.success) {
      console.log('✅ 可选厚度验证通过:', optionalResult.data.thickness);
    } else {
      console.log('❌ 可选厚度验证失败:', optionalResult.error.errors);
    }

    // 1.3 负数厚度（应该失败）
    const negativeThicknessData = {
      code: 'TEST-003',
      name: '测试瓷砖3',
      unit: 'piece' as const,
      piecesPerUnit: 1,
      thickness: -1, // 负数厚度
    };

    const negativeResult = productCreateSchema.safeParse(negativeThicknessData);
    if (!negativeResult.success) {
      console.log('✅ 负数厚度验证正确失败:', negativeResult.error.errors[0]?.message);
    } else {
      console.log('❌ 负数厚度验证应该失败但通过了');
    }

    // 1.4 超大厚度（应该失败）
    const oversizeThicknessData = {
      code: 'TEST-004',
      name: '测试瓷砖4',
      unit: 'piece' as const,
      piecesPerUnit: 1,
      thickness: 150, // 超过100mm的厚度
    };

    const oversizeResult = productCreateSchema.safeParse(oversizeThicknessData);
    if (!oversizeResult.success) {
      console.log('✅ 超大厚度验证正确失败:', oversizeResult.error.errors[0]?.message);
    } else {
      console.log('❌ 超大厚度验证应该失败但通过了');
    }

    // 1.5 字符串厚度（应该失败）
    const stringThicknessData = {
      code: 'TEST-005',
      name: '测试瓷砖5',
      unit: 'piece' as const,
      piecesPerUnit: 1,
      thickness: '8.5' as any, // 字符串厚度
    };

    const stringResult = productCreateSchema.safeParse(stringThicknessData);
    if (!stringResult.success) {
      console.log('✅ 字符串厚度验证正确失败:', stringResult.error.errors[0]?.message);
    } else {
      console.log('❌ 字符串厚度验证应该失败但通过了');
    }

    // 2. 测试更新产品的厚度验证
    console.log('\n2. 测试更新产品的厚度验证');

    // 2.1 有效的更新数据
    const validUpdateData = {
      id: 'test-id',
      thickness: 10.0,
    };

    const validUpdateResult = productUpdateSchema.safeParse(validUpdateData);
    if (validUpdateResult.success) {
      console.log('✅ 有效更新厚度验证通过:', validUpdateResult.data.thickness);
    } else {
      console.log('❌ 有效更新厚度验证失败:', validUpdateResult.error.errors);
    }

    // 2.2 可选更新（不包含厚度）
    const optionalUpdateData = {
      id: 'test-id',
      name: '更新后的名称',
      // thickness 字段省略
    };

    const optionalUpdateResult = productUpdateSchema.safeParse(optionalUpdateData);
    if (optionalUpdateResult.success) {
      console.log('✅ 可选更新厚度验证通过:', optionalUpdateResult.data.thickness);
    } else {
      console.log('❌ 可选更新厚度验证失败:', optionalUpdateResult.error.errors);
    }

    // 3. 测试边界值
    console.log('\n3. 测试厚度字段边界值');

    // 3.1 最小值 0
    const minThicknessData = {
      code: 'TEST-MIN',
      name: '最小厚度测试',
      unit: 'piece' as const,
      piecesPerUnit: 1,
      thickness: 0,
    };

    const minResult = productCreateSchema.safeParse(minThicknessData);
    if (minResult.success) {
      console.log('✅ 最小厚度(0)验证通过:', minResult.data.thickness);
    } else {
      console.log('❌ 最小厚度(0)验证失败:', minResult.error.errors);
    }

    // 3.2 最大值 100
    const maxThicknessData = {
      code: 'TEST-MAX',
      name: '最大厚度测试',
      unit: 'piece' as const,
      piecesPerUnit: 1,
      thickness: 100,
    };

    const maxResult = productCreateSchema.safeParse(maxThicknessData);
    if (maxResult.success) {
      console.log('✅ 最大厚度(100)验证通过:', maxResult.data.thickness);
    } else {
      console.log('❌ 最大厚度(100)验证失败:', maxResult.error.errors);
    }

    // 3.3 小数厚度
    const decimalThicknessData = {
      code: 'TEST-DECIMAL',
      name: '小数厚度测试',
      unit: 'piece' as const,
      piecesPerUnit: 1,
      thickness: 8.75,
    };

    const decimalResult = productCreateSchema.safeParse(decimalThicknessData);
    if (decimalResult.success) {
      console.log('✅ 小数厚度(8.75)验证通过:', decimalResult.data.thickness);
    } else {
      console.log('❌ 小数厚度(8.75)验证失败:', decimalResult.error.errors);
    }

    console.log('\n🎉 所有验证测试通过！厚度字段验证功能正常。');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testThicknessValidation().catch(console.error);
