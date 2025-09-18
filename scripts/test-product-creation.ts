#!/usr/bin/env tsx

/**
 * 产品创建功能测试脚本
 * 测试厚度字段和其他可选字段的处理
 */

import { CreateProductSchema } from '../lib/schemas/product';

// 测试数据
const testCases = [
  {
    name: '完整数据测试',
    data: {
      code: 'TEST-001',
      name: '测试瓷砖',
      specification: '600x600mm',
      unit: 'piece' as const,
      piecesPerUnit: 1,
      weight: 2.5,
      thickness: 9.5,
      status: 'active' as const,
      specifications: {
        color: '白色',
        surface: '抛光',
      },
    },
  },
  {
    name: '最小数据测试',
    data: {
      code: 'TEST-002',
      name: '最小测试瓷砖',
      unit: 'piece' as const,
      status: 'active' as const,
    },
  },
  {
    name: '厚度为空测试',
    data: {
      code: 'TEST-003',
      name: '无厚度瓷砖',
      unit: 'piece' as const,
      thickness: undefined,
      status: 'active' as const,
    },
  },
  {
    name: '厚度为0测试',
    data: {
      code: 'TEST-004',
      name: '零厚度瓷砖',
      unit: 'piece' as const,
      thickness: 0,
      status: 'active' as const,
    },
  },
  {
    name: '无效厚度测试（负数）',
    data: {
      code: 'TEST-005',
      name: '负厚度瓷砖',
      unit: 'piece' as const,
      thickness: -1,
      status: 'active' as const,
    },
    shouldFail: true,
  },
  {
    name: '无效厚度测试（超出范围）',
    data: {
      code: 'TEST-006',
      name: '超厚瓷砖',
      unit: 'piece' as const,
      thickness: 150,
      status: 'active' as const,
    },
    shouldFail: true,
  },
];

async function testProductCreation() {
  console.log('🧪 开始产品创建功能测试\n');

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`📋 测试: ${testCase.name}`);
    console.log(`📝 数据:`, JSON.stringify(testCase.data, null, 2));

    try {
      // 验证Schema
      const validationResult = CreateProductSchema.safeParse(testCase.data);

      if (testCase.shouldFail) {
        if (validationResult.success) {
          console.log(`❌ 测试失败: 应该验证失败但成功了`);
        } else {
          console.log(`✅ 测试通过: 正确验证失败`);
          console.log(`📄 错误信息:`, validationResult.error.errors[0]?.message);
          passedTests++;
        }
      } else {
        if (validationResult.success) {
          console.log(`✅ 测试通过: Schema验证成功`);
          console.log(`📄 验证后数据:`, JSON.stringify(validationResult.data, null, 2));
          passedTests++;
        } else {
          console.log(`❌ 测试失败: Schema验证失败`);
          console.log(`📄 错误信息:`, validationResult.error.errors);
        }
      }
    } catch (error) {
      console.log(`❌ 测试异常:`, error);
    }

    console.log('─'.repeat(50));
  }

  console.log(`\n📊 测试结果: ${passedTests}/${totalTests} 通过`);

  if (passedTests === totalTests) {
    console.log('🎉 所有测试通过！');
  } else {
    console.log('⚠️  部分测试失败，请检查代码');
  }
}

// API测试函数
async function testAPICreation() {
  console.log('\n🌐 开始API创建测试\n');

  const testData = {
    code: `API-TEST-${Date.now()}`,
    name: 'API测试瓷砖',
    specification: '800x800mm',
    unit: 'piece',
    piecesPerUnit: 1,
    weight: 3.2,
    thickness: 10.5,
    status: 'active',
  };

  try {
    const response = await fetch('http://localhost:3005/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log('✅ API创建测试通过');
      console.log('📄 返回数据:', JSON.stringify(result.data, null, 2));
    } else {
      console.log('❌ API创建测试失败');
      console.log('📄 错误信息:', result.error);
      console.log('📄 详细信息:', result.details);
    }
  } catch (error) {
    console.log('❌ API请求异常:', error);
  }
}

// 主函数
async function main() {
  await testProductCreation();
  await testAPICreation();
}

if (require.main === module) {
  main().catch(console.error);
}
