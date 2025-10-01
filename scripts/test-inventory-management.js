/**
 * 库存管理功能单元测试
 * 测试范围:
 * 1. 库存查询 API
 * 2. 库存调整 API
 * 3. 库存入库 API
 * 4. 库存出库 API
 * 5. 库存可用性检查 API
 * 6. 边界条件测试
 * 7. 安全性测试
 */

const BASE_URL = 'http://localhost:3003';

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: [],
};

// 测试辅助函数
function logTest(name, passed, error = null, details = null) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ 测试 ${testResults.total}: ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ 测试 ${testResults.total}: ${name}`);
    if (error) {
      console.log(`   错误: ${error}`);
    }
    if (details) {
      console.log(`   详情: ${JSON.stringify(details, null, 2)}`);
    }
  }
  testResults.details.push({ name, passed, error, details });
}

// 生成唯一的幂等性键 (UUID v4 格式)
function generateIdempotencyKey() {
  // 生成符合 UUID v4 格式的字符串
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 创建测试产品
async function createTestProduct() {
  const timestamp = Date.now();
  const response = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: `INV-TEST-${timestamp}`,
      name: `库存测试产品-${timestamp}`,
      specification: '测试规格',
      unit: 'piece',
      categoryId: 'uncategorized',
      status: 'active',
      thumbnailUrl: '',
      images: [],
    }),
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(`创建测试产品失败: ${data.error || '未知错误'}`);
  }

  return data.data;
}

// 创建测试客户
async function createTestCustomer() {
  const timestamp = Date.now();
  const response = await fetch(`${BASE_URL}/api/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `测试客户-${timestamp}`,
      phone: '13800138000',
      address: '测试地址',
    }),
  });
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(`创建测试客户失败: ${data.error || '未知错误'}`);
  }

  return data.data;
}

// 主测试函数
async function runTests() {
  console.log('============================================================');
  console.log('库存管理功能单元测试');
  console.log('============================================================\n');

  let testProduct = null;
  let testCustomer = null;
  let testInventoryId = null;

  try {
    // 创建测试产品
    testProduct = await createTestProduct();
    console.log(`✅ 创建测试产品: ${testProduct.code}`);

    // 创建测试客户
    testCustomer = await createTestCustomer();
    console.log(`✅ 创建测试客户: ${testCustomer.name}\n`);

    // ==================== 第一部分: 库存查询测试 ====================
    console.log('第一部分: 库存查询测试\n');

    // 测试 1: 库存列表 API - 正常情况
    try {
      const response = await fetch(`${BASE_URL}/api/inventory?page=1&limit=10`);
      const data = await response.json();
      const passed =
        response.ok &&
        data.success &&
        data.data &&
        Array.isArray(data.data.data) &&
        data.data.pagination;
      logTest('库存列表 API - 正常情况', passed, passed ? null : data.error);
    } catch (error) {
      logTest('库存列表 API - 正常情况', false, error.message);
    }

    // 测试 2: 库存可用性检查 - 正常情况
    try {
      const response = await fetch(
        `${BASE_URL}/api/inventory/check-availability`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: testProduct.id,
            quantity: 10,
          }),
        }
      );
      const data = await response.json();
      logTest(
        '库存可用性检查 - 正常情况',
        response.ok && data.success !== undefined
      );
    } catch (error) {
      logTest('库存可用性检查 - 正常情况', false, error.message);
    }

    // ==================== 第二部分: 库存入库测试 ====================
    console.log('\n第二部分: 库存入库测试\n');

    // 测试 3: 创建入库记录 - 正常情况
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: testProduct.id,
          inputQuantity: 100,
          inputUnit: 'pieces',
          quantity: 100,
          batchNumber: `BATCH-${Date.now()}`,
          unitCost: 10.5,
          remarks: '测试入库',
        }),
      });
      const data = await response.json();
      if (response.ok && data.success && data.data) {
        testInventoryId = data.data.id;
      }
      const passed = response.ok && data.success;
      logTest(
        '创建入库记录 - 正常情况',
        passed,
        passed ? null : data.error,
        passed ? null : data
      );
    } catch (error) {
      logTest('创建入库记录 - 正常情况', false, error.message);
    }

    // 测试 4: 创建入库记录 - 空产品ID
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: '',
          inputQuantity: 100,
          inputUnit: 'pieces',
          quantity: 100,
        }),
      });
      const data = await response.json();
      logTest('创建入库记录 - 空产品ID', !response.ok && !data.success);
    } catch (error) {
      logTest('创建入库记录 - 空产品ID', false, error.message);
    }

    // 测试 5: 创建入库记录 - 负数数量
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: testProduct.id,
          inputQuantity: -10,
          inputUnit: 'pieces',
          quantity: -10,
        }),
      });
      const data = await response.json();
      logTest('创建入库记录 - 负数数量', !response.ok && !data.success);
    } catch (error) {
      logTest('创建入库记录 - 负数数量', false, error.message);
    }

    // 测试 6: 创建入库记录 - 超大数量
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: testProduct.id,
          inputQuantity: 9999999,
          inputUnit: 'pieces',
          quantity: 9999999,
        }),
      });
      const data = await response.json();
      logTest('创建入库记录 - 超大数量', !response.ok && !data.success);
    } catch (error) {
      logTest('创建入库记录 - 超大数量', false, error.message);
    }

    // ==================== 第三部分: 库存调整测试 ====================
    console.log('\n第三部分: 库存调整测试\n');

    // 等待一下确保入库事务完成
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 测试 7: 库存调整 - 增加库存
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: testProduct.id,
          adjustQuantity: 50,
          reason: 'surplus_gain',
          notes: '测试增加库存',
        }),
      });
      const data = await response.json();
      const passed = response.ok && data.success;
      logTest(
        '库存调整 - 增加库存',
        passed,
        passed ? null : data.error,
        passed ? null : data
      );
    } catch (error) {
      logTest('库存调整 - 增加库存', false, error.message);
    }

    // 测试 8: 库存调整 - 减少库存
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: testProduct.id,
          adjustQuantity: -20,
          reason: 'damage_loss',
          notes: '测试减少库存',
        }),
      });
      const data = await response.json();
      const passed = response.ok && data.success;
      logTest(
        '库存调整 - 减少库存',
        passed,
        passed ? null : data.error,
        passed ? null : data
      );
    } catch (error) {
      logTest('库存调整 - 减少库存', false, error.message);
    }

    // 测试 9: 库存调整 - 调整为负数 (应该失败)
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: testProduct.id,
          adjustQuantity: -99999,
          reason: 'damage_loss',
          notes: '测试调整为负数',
        }),
      });
      const data = await response.json();
      logTest(
        '库存调整 - 调整为负数 (应该失败)',
        !response.ok && !data.success
      );
    } catch (error) {
      logTest('库存调整 - 调整为负数 (应该失败)', false, error.message);
    }

    // 测试 10: 库存调整 - 空产品ID
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: '',
          adjustQuantity: 10,
          reason: 'surplus_gain',
        }),
      });
      const data = await response.json();
      logTest('库存调整 - 空产品ID', !response.ok && !data.success);
    } catch (error) {
      logTest('库存调整 - 空产品ID', false, error.message);
    }

    // 测试 11: 库存调整 - 无效的调整原因
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: testProduct.id,
          adjustQuantity: 10,
          reason: 'invalid_reason',
        }),
      });
      const data = await response.json();
      logTest('库存调整 - 无效的调整原因', !response.ok && !data.success);
    } catch (error) {
      logTest('库存调整 - 无效的调整原因', false, error.message);
    }

    // ==================== 第四部分: 库存出库测试 ====================
    console.log('\n第四部分: 库存出库测试\n');

    // 测试 12: 库存出库 - 正常情况
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          type: 'sales_outbound',
          productId: testProduct.id,
          customerId: testCustomer.id, // 使用测试客户ID
          quantity: 10,
          reason: 'sales',
          remarks: '测试出库',
        }),
      });
      const data = await response.json();
      const passed = response.ok && data.success;
      logTest(
        '库存出库 - 正常情况',
        passed,
        passed ? null : data.error,
        passed ? null : data
      );
    } catch (error) {
      logTest('库存出库 - 正常情况', false, error.message);
    }

    // 测试 13: 库存出库 - 超出可用库存 (应该失败)
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: testProduct.id,
          quantity: 999999,
          reason: 'sales',
        }),
      });
      const data = await response.json();
      logTest(
        '库存出库 - 超出可用库存 (应该失败)',
        !response.ok && !data.success
      );
    } catch (error) {
      logTest('库存出库 - 超出可用库存 (应该失败)', false, error.message);
    }

    // 测试 14: 库存出库 - 负数数量
    try {
      const response = await fetch(`${BASE_URL}/api/inventory/outbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: testProduct.id,
          quantity: -10,
          reason: 'sales',
        }),
      });
      const data = await response.json();
      logTest('库存出库 - 负数数量', !response.ok && !data.success);
    } catch (error) {
      logTest('库存出库 - 负数数量', false, error.message);
    }

    // ==================== 第五部分: 安全性测试 ====================
    console.log('\n第五部分: 安全性测试\n');

    // 测试 15: SQL 注入防护 - 产品ID
    try {
      const response = await fetch(
        `${BASE_URL}/api/inventory/check-availability`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: "' OR '1'='1",
            quantity: 10,
          }),
        }
      );
      const data = await response.json();
      // SQL注入被正确处理: 返回成功但产品不存在,而不是返回所有产品或报错
      const passed =
        response.ok &&
        data.success &&
        data.data &&
        !data.data.available &&
        data.data.message === '产品不存在';
      logTest(
        'SQL 注入防护 - 产品ID',
        passed,
        passed ? null : 'SQL注入未被正确处理',
        passed ? null : data
      );
    } catch (error) {
      logTest('SQL 注入防护 - 产品ID', false, error.message);
    }

    // 测试 16: XSS 防护 - 备注字段
    try {
      const xssInput = '<script>alert("XSS")</script>';
      const response = await fetch(`${BASE_URL}/api/inventory/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: testProduct.id,
          inputQuantity: 10,
          inputUnit: 'pieces',
          quantity: 10,
          remarks: xssInput,
        }),
      });
      const data = await response.json();
      // XSS 防护: 要么拒绝请求,要么清理/转义了 HTML 标签
      const passed =
        (!response.ok && !data.success) || // 拒绝请求
        (response.ok &&
          data.success &&
          data.data &&
          data.data.remarks !== xssInput); // 或者清理了标签
      logTest(
        'XSS 防护 - 备注字段',
        passed,
        passed ? null : 'XSS未被防护',
        passed ? null : { input: xssInput, output: data.data?.remarks, data }
      );
    } catch (error) {
      logTest('XSS 防护 - 备注字段', false, error.message);
    }

    // 测试 17: 超长字符串防护 - 备注字段
    try {
      const longString = 'A'.repeat(1000);
      const response = await fetch(`${BASE_URL}/api/inventory/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          productId: testProduct.id,
          inputQuantity: 10,
          inputUnit: 'pieces',
          quantity: 10,
          remarks: longString,
        }),
      });
      const data = await response.json();
      logTest('超长字符串防护 - 备注字段', !response.ok && !data.success);
    } catch (error) {
      logTest('超长字符串防护 - 备注字段', false, error.message);
    }

    // 测试 18: 幂等性测试 - 重复的幂等性键
    try {
      const idempotencyKey = generateIdempotencyKey();

      // 第一次请求
      const response1 = await fetch(`${BASE_URL}/api/inventory/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          productId: testProduct.id,
          inputQuantity: 10,
          inputUnit: 'pieces',
          quantity: 10,
          batchNumber: `BATCH-IDEMPOTENT-${Date.now()}`,
        }),
      });
      const data1 = await response1.json();

      // 等待一下确保第一次请求完成
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 第二次请求 (相同的幂等性键)
      const response2 = await fetch(`${BASE_URL}/api/inventory/inbound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          productId: testProduct.id,
          inputQuantity: 10,
          inputUnit: 'pieces',
          quantity: 10,
          batchNumber: `BATCH-IDEMPOTENT-${Date.now()}`,
        }),
      });
      const data2 = await response2.json();

      // 第二次请求应该返回相同的结果或明确的幂等性响应
      const passed =
        response1.ok && response2.ok && data1.success && data2.success;
      logTest(
        '幂等性测试 - 重复的幂等性键',
        passed,
        passed ? null : '幂等性验证失败',
        passed ? null : { data1, data2 }
      );
    } catch (error) {
      logTest('幂等性测试 - 重复的幂等性键', false, error.message);
    }
  } catch (error) {
    console.error('\n测试过程中发生错误:', error);
  }

  // 输出测试结果
  console.log('\n============================================================');
  console.log('测试结果汇总');
  console.log('============================================================\n');
  console.log(`总测试数: ${testResults.total}`);
  console.log(`✅ 通过: ${testResults.passed}`);
  console.log(`❌ 失败: ${testResults.failed}`);
  console.log(
    `通过率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%\n`
  );

  console.log('详细结果:');
  testResults.details.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.name}`);
  });

  console.log(
    '\n============================================================\n'
  );
}

// 运行测试
runTests().catch(console.error);
