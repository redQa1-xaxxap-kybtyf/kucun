/**
 * 销售管理功能单元测试
 * 测试销售订单的增删改查、状态管理、边界条件和安全性
 */

const BASE_URL = 'http://localhost:3000';

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
};

// 测试数据
let testProduct = null;
let testCustomer = null;
let testSalesOrder = null;

// 生成唯一的幂等性键 (UUID v4 格式)
function generateIdempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 记录测试结果
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
  testResults.tests.push({ name, passed, error, details });
}

// 创建测试产品
async function createTestProduct() {
  const timestamp = Date.now();
  const response = await fetch(`${BASE_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: `SALES-TEST-${timestamp}`,
      name: `销售测试产品-${timestamp}`,
      unit: 'piece',
      status: 'active',
      categoryId: 'uncategorized',
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
      name: `销售测试客户-${timestamp}`,
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
  console.log('销售管理功能单元测试');
  console.log('============================================================\n');

  try {
    // 创建测试数据
    testProduct = await createTestProduct();
    console.log(`✅ 创建测试产品: ${testProduct.code}`);

    testCustomer = await createTestCustomer();
    console.log(`✅ 创建测试客户: ${testCustomer.name}\n`);

    // 第一部分: 销售订单查询测试
    console.log('第一部分: 销售订单查询测试\n');

    // 测试 1: 销售订单列表 API - 正常情况
    try {
      const response = await fetch(
        `${BASE_URL}/api/sales-orders?page=1&limit=10`
      );
      const data = await response.json();
      // 数据结构: {success: true, data: {data: [], pagination: {...}}}
      const passed =
        response.ok &&
        data.success &&
        data.data &&
        Array.isArray(data.data.data) &&
        data.data.pagination;
      logTest('销售订单列表 API - 正常情况', passed);
    } catch (error) {
      logTest('销售订单列表 API - 正常情况', false, error.message);
    }

    // 第二部分: 创建销售订单测试
    console.log('\n第二部分: 创建销售订单测试\n');

    // 测试 2: 创建销售订单 - 正常情况
    try {
      const response = await fetch(`${BASE_URL}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          orderType: 'NORMAL',
          status: 'draft',
          items: [
            {
              productId: testProduct.id,
              displayUnit: '片',
              displayQuantity: 10,
              quantity: 10,
              unitPrice: 100,
              subtotal: 1000,
            },
          ],
          remarks: '测试订单',
        }),
      });
      const data = await response.json();
      const passed = response.ok && data.success && data.data?.id;
      if (passed) {
        testSalesOrder = data.data;
      } else {
        console.log(`   响应状态: ${response.status}`);
        console.log(`   响应数据: ${JSON.stringify(data, null, 2)}`);
      }
      logTest('创建销售订单 - 正常情况', passed);
    } catch (error) {
      logTest('创建销售订单 - 正常情况', false, error.message);
    }

    // 测试 3: 创建销售订单 - 空客户ID
    try {
      const response = await fetch(`${BASE_URL}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: '',
          orderType: 'NORMAL',
          items: [
            {
              productId: testProduct.id,
              quantity: 10,
              unitPrice: 100,
              subtotal: 1000,
            },
          ],
        }),
      });
      const data = await response.json();
      logTest('创建销售订单 - 空客户ID', !response.ok && !data.success);
    } catch (error) {
      logTest('创建销售订单 - 空客户ID', false, error.message);
    }

    // 测试 4: 创建销售订单 - 空订单明细
    try {
      const response = await fetch(`${BASE_URL}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          orderType: 'NORMAL',
          items: [],
        }),
      });
      const data = await response.json();
      logTest('创建销售订单 - 空订单明细', !response.ok && !data.success);
    } catch (error) {
      logTest('创建销售订单 - 空订单明细', false, error.message);
    }

    // 测试 5: 创建销售订单 - 负数数量
    try {
      const response = await fetch(`${BASE_URL}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          orderType: 'NORMAL',
          items: [
            {
              productId: testProduct.id,
              quantity: -10,
              unitPrice: 100,
              subtotal: -1000,
            },
          ],
        }),
      });
      const data = await response.json();
      logTest('创建销售订单 - 负数数量', !response.ok && !data.success);
    } catch (error) {
      logTest('创建销售订单 - 负数数量', false, error.message);
    }

    // 测试 6: 创建销售订单 - 超大数量
    try {
      const response = await fetch(`${BASE_URL}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          orderType: 'NORMAL',
          items: [
            {
              productId: testProduct.id,
              quantity: 1000000,
              unitPrice: 100,
              subtotal: 100000000,
            },
          ],
        }),
      });
      const data = await response.json();
      logTest('创建销售订单 - 超大数量', !response.ok && !data.success);
    } catch (error) {
      logTest('创建销售订单 - 超大数量', false, error.message);
    }

    // 第三部分: 销售订单详情测试
    console.log('\n第三部分: 销售订单详情测试\n');

    // 测试 7: 获取销售订单详情 - 正常情况
    if (testSalesOrder) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/sales-orders/${testSalesOrder.id}`
        );
        const data = await response.json();
        const passed =
          response.ok && data.success && data.data?.id === testSalesOrder.id;
        if (!passed) {
          console.log(`   响应状态: ${response.status}`);
          console.log(`   响应数据: ${JSON.stringify(data, null, 2)}`);
          console.log(`   期望订单ID: ${testSalesOrder.id}`);
        }
        logTest('获取销售订单详情 - 正常情况', passed);
      } catch (error) {
        logTest('获取销售订单详情 - 正常情况', false, error.message);
      }
    } else {
      logTest('获取销售订单详情 - 正常情况', false, '测试订单未创建');
    }

    // 测试 8: 获取销售订单详情 - 无效ID
    try {
      const response = await fetch(`${BASE_URL}/api/sales-orders/invalid-id`);
      const data = await response.json();
      logTest('获取销售订单详情 - 无效ID', !response.ok && !data.success);
    } catch (error) {
      logTest('获取销售订单详情 - 无效ID', false, error.message);
    }

    // 第四部分: 销售订单状态更新测试
    console.log('\n第四部分: 销售订单状态更新测试\n');

    // 测试 9: 更新订单状态 - draft -> confirmed
    if (testSalesOrder) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/sales-orders/${testSalesOrder.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idempotencyKey: generateIdempotencyKey(),
              status: 'confirmed',
              remarks: '确认订单',
            }),
          }
        );
        const data = await response.json();
        const passed =
          response.ok && data.success && data.data?.status === 'confirmed';
        if (passed) {
          testSalesOrder.status = 'confirmed';
        } else {
          console.log(`   响应状态: ${response.status}`);
          console.log(`   响应数据: ${JSON.stringify(data, null, 2)}`);
        }
        logTest('更新订单状态 - draft -> confirmed', passed);
      } catch (error) {
        logTest('更新订单状态 - draft -> confirmed', false, error.message);
      }
    } else {
      logTest('更新订单状态 - draft -> confirmed', false, '测试订单未创建');
    }

    // 测试 10: 更新订单状态 - 无效的状态流转
    if (testSalesOrder) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/sales-orders/${testSalesOrder.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idempotencyKey: generateIdempotencyKey(),
              status: 'draft', // confirmed 不能回到 draft
              remarks: '无效的状态流转',
            }),
          }
        );
        const data = await response.json();
        logTest('更新订单状态 - 无效的状态流转', !response.ok && !data.success);
      } catch (error) {
        logTest('更新订单状态 - 无效的状态流转', false, error.message);
      }
    } else {
      logTest('更新订单状态 - 无效的状态流转', false, '测试订单未创建');
    }

    // 测试 11: 更新订单状态 - 空幂等性键
    if (testSalesOrder) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/sales-orders/${testSalesOrder.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idempotencyKey: '',
              status: 'shipped',
            }),
          }
        );
        const data = await response.json();
        logTest('更新订单状态 - 空幂等性键', !response.ok && !data.success);
      } catch (error) {
        logTest('更新订单状态 - 空幂等性键', false, error.message);
      }
    } else {
      logTest('更新订单状态 - 空幂等性键', false, '测试订单未创建');
    }

    // 第五部分: 安全性测试
    console.log('\n第五部分: 安全性测试\n');

    // 测试 12: SQL 注入防护 - 客户ID
    try {
      const response = await fetch(
        `${BASE_URL}/api/sales-orders?customerId=' OR '1'='1`
      );
      const data = await response.json();
      // SQL 注入应该被正确处理,不会返回所有数据
      logTest(
        'SQL 注入防护 - 客户ID',
        response.ok &&
          data.success &&
          (!data.data?.salesOrders || data.data.salesOrders.length === 0)
      );
    } catch (error) {
      logTest('SQL 注入防护 - 客户ID', false, error.message);
    }

    // 测试 13: XSS 防护 - 备注字段
    try {
      const xssInput = '<script>alert("XSS")</script>';
      const response = await fetch(`${BASE_URL}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          orderType: 'NORMAL',
          items: [
            {
              productId: testProduct.id,
              quantity: 10,
              unitPrice: 100,
              subtotal: 1000,
            },
          ],
          remarks: xssInput,
        }),
      });
      const data = await response.json();
      // XSS 防护: 要么拒绝请求,要么清理了 HTML 标签
      const passed =
        (!response.ok && !data.success) || // 拒绝请求
        (response.ok &&
          data.success &&
          data.data &&
          data.data.remarks !== xssInput); // 或者清理了标签
      logTest('XSS 防护 - 备注字段', passed);
    } catch (error) {
      logTest('XSS 防护 - 备注字段', false, error.message);
    }

    // 测试 14: 超长字符串防护 - 备注字段
    try {
      const longString = 'A'.repeat(2000);
      const response = await fetch(`${BASE_URL}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          orderType: 'NORMAL',
          items: [
            {
              productId: testProduct.id,
              quantity: 10,
              unitPrice: 100,
              subtotal: 1000,
            },
          ],
          remarks: longString,
        }),
      });
      const data = await response.json();
      logTest('超长字符串防护 - 备注字段', !response.ok && !data.success);
    } catch (error) {
      logTest('超长字符串防护 - 备注字段', false, error.message);
    }

    // 测试 15: 幂等性测试 - 重复的幂等性键
    // 创建一个新的草稿订单用于幂等性测试
    let idempotencyTestOrder = null;
    try {
      const createResponse = await fetch(`${BASE_URL}/api/sales-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          orderType: 'NORMAL',
          status: 'draft',
          items: [
            {
              productId: testProduct.id,
              displayUnit: '片',
              displayQuantity: 5,
              quantity: 5,
              unitPrice: 50,
              subtotal: 250,
            },
          ],
          remarks: '幂等性测试订单',
        }),
      });
      const createData = await createResponse.json();
      if (createData.success) {
        idempotencyTestOrder = createData.data;
      }
    } catch (error) {
      console.error('创建幂等性测试订单失败:', error.message);
    }

    if (idempotencyTestOrder) {
      try {
        // 测试 draft -> confirmed 的幂等性 (不需要库存)
        const idempotencyKey = generateIdempotencyKey();
        // 第一次请求
        const response1 = await fetch(
          `${BASE_URL}/api/sales-orders/${idempotencyTestOrder.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idempotencyKey,
              status: 'confirmed',
              remarks: '确认订单',
            }),
          }
        );
        const data1 = await response1.json();
        console.log('   第一次响应状态:', response1.status);
        console.log('   第一次响应数据:', JSON.stringify(data1, null, 2));

        // 第二次请求 (相同的幂等性键)
        const response2 = await fetch(
          `${BASE_URL}/api/sales-orders/${idempotencyTestOrder.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idempotencyKey,
              status: 'confirmed',
              remarks: '确认订单',
            }),
          }
        );
        const data2 = await response2.json();

        // 第二次请求应该返回相同的结果,不会重复执行
        const passed =
          response1.ok && response2.ok && data1.success && data2.success;
        if (!passed) {
          console.log(`   第一次响应状态: ${response1.status}`);
          console.log(`   第一次响应数据: ${JSON.stringify(data1, null, 2)}`);
          console.log(`   第二次响应状态: ${response2.status}`);
          console.log(`   第二次响应数据: ${JSON.stringify(data2, null, 2)}`);
        }
        logTest('幂等性测试 - 重复的幂等性键', passed);
      } catch (error) {
        logTest('幂等性测试 - 重复的幂等性键', false, error.message);
      }
    } else {
      logTest('幂等性测试 - 重复的幂等性键', false, '测试订单未创建');
    }

    // 打印测试结果汇总
    console.log(
      '\n============================================================'
    );
    console.log('测试结果汇总');
    console.log(
      '============================================================\n'
    );
    console.log(`总测试数: ${testResults.total}`);
    console.log(`✅ 通过: ${testResults.passed}`);
    console.log(`❌ 失败: ${testResults.failed}`);
    console.log(
      `通过率: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%\n`
    );

    console.log('详细结果:');
    testResults.tests.forEach((test, index) => {
      console.log(`${index + 1}. ${test.passed ? '✅' : '❌'} ${test.name}`);
    });

    console.log(
      '\n============================================================\n'
    );
  } catch (error) {
    console.error('测试执行失败:', error);
    process.exit(1);
  }
}

// 运行测试
runTests().catch(console.error);
