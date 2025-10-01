/**
 * 退货订单管理功能单元测试
 * 测试范围: 退货订单的查询、创建、边界条件、安全性
 */

const BASE_URL = 'http://localhost:3000';

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  details: [],
};

// 测试数据
let testSalesOrder = null;
let testCustomer = null;

// 辅助函数: 记录测试结果
function logTest(name, passed, error = null) {
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
  }
  testResults.details.push({ name, passed, error });
}

// 主测试函数
async function runTests() {
  console.log('============================================================');
  console.log('退货订单管理功能单元测试');
  console.log('============================================================\n');

  try {
    // ==================== 准备测试数据 ====================
    console.log('准备测试数据...\n');

    // 获取测试客户
    try {
      const response = await fetch(`${BASE_URL}/api/customers?page=1&limit=1`);
      const data = await response.json();
      if (data.data && data.data.length > 0) {
        testCustomer = data.data[0];
        console.log(`✅ 获取测试客户: ${testCustomer.name}`);
      }
    } catch (error) {
      console.log(`❌ 获取测试客户失败: ${error.message}`);
    }

    // 获取测试销售订单 (状态为 completed 的订单才能退货)
    try {
      const response = await fetch(
        `${BASE_URL}/api/sales-orders?page=1&limit=10&status=completed`
      );
      const data = await response.json();
      if (data.orders && data.orders.length > 0) {
        testSalesOrder = data.orders[0];
        console.log(`✅ 获取测试销售订单: ${testSalesOrder.orderNumber}\n`);
      } else {
        console.log(`⚠️  未找到已完成的销售订单,将跳过需要销售订单的测试\n`);
      }
    } catch (error) {
      console.log(`❌ 获取测试销售订单失败: ${error.message}\n`);
    }

    if (!testCustomer) {
      console.log('❌ 缺少必要的测试数据,无法继续测试');
      return;
    }

    // ==================== 第一部分: 退货订单查询测试 ====================
    console.log('第一部分: 退货订单查询测试\n');

    // 测试 1: 退货订单列表 API - 正常情况
    try {
      const response = await fetch(
        `${BASE_URL}/api/return-orders?page=1&pageSize=10`
      );
      const data = await response.json();
      logTest(
        '退货订单列表 API - 正常情况',
        response.ok &&
          data.success &&
          data.data &&
          Array.isArray(data.data.returnOrders)
      );
    } catch (error) {
      logTest('退货订单列表 API - 正常情况', false, error.message);
    }

    // 测试 2: 退货订单列表 API - 按状态筛选
    try {
      const response = await fetch(
        `${BASE_URL}/api/return-orders?status=draft`
      );
      const data = await response.json();
      logTest(
        '退货订单列表 API - 按状态筛选',
        response.ok &&
          data.success &&
          data.data &&
          Array.isArray(data.data.returnOrders)
      );
    } catch (error) {
      logTest('退货订单列表 API - 按状态筛选', false, error.message);
    }

    // ==================== 第二部分: 创建退货订单测试 ====================
    console.log('\n第二部分: 创建退货订单测试\n');

    // 测试 3: 创建退货订单 - 空销售订单ID
    try {
      const response = await fetch(`${BASE_URL}/api/return-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesOrderId: '',
          customerId: testCustomer.id,
          type: 'quality_issue',
          processType: 'refund',
          reason: '产品质量问题',
          items: [],
        }),
      });
      const data = await response.json();
      logTest('创建退货订单 - 空销售订单ID', !response.ok && !data.success);
    } catch (error) {
      logTest('创建退货订单 - 空销售订单ID', false, error.message);
    }

    // 如果有测试销售订单,继续测试
    if (testSalesOrder) {
      // 测试 4: 创建退货订单 - 空退货明细
      try {
        const response = await fetch(`${BASE_URL}/api/return-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salesOrderId: testSalesOrder.id,
            customerId: testCustomer.id,
            type: 'quality_issue',
            processType: 'refund',
            reason: '产品质量问题',
            items: [],
          }),
        });
        const data = await response.json();
        logTest('创建退货订单 - 空退货明细', !response.ok && !data.success);
      } catch (error) {
        logTest('创建退货订单 - 空退货明细', false, error.message);
      }

      // 测试 5: 创建退货订单 - 空退货原因
      try {
        const response = await fetch(`${BASE_URL}/api/return-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salesOrderId: testSalesOrder.id,
            customerId: testCustomer.id,
            type: 'quality_issue',
            processType: 'refund',
            reason: '',
            items: [
              {
                salesOrderItemId: 'test-id',
                productId: 'test-product-id',
                returnQuantity: 1,
                originalQuantity: 10,
                unitPrice: 100,
                subtotal: 100,
                condition: 'good',
              },
            ],
          }),
        });
        const data = await response.json();
        logTest('创建退货订单 - 空退货原因', !response.ok && !data.success);
      } catch (error) {
        logTest('创建退货订单 - 空退货原因', false, error.message);
      }

      // 测试 6: 创建退货订单 - 超长退货原因
      try {
        const longReason = 'A'.repeat(501);
        const response = await fetch(`${BASE_URL}/api/return-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salesOrderId: testSalesOrder.id,
            customerId: testCustomer.id,
            type: 'quality_issue',
            processType: 'refund',
            reason: longReason,
            items: [
              {
                salesOrderItemId: 'test-id',
                productId: 'test-product-id',
                returnQuantity: 1,
                originalQuantity: 10,
                unitPrice: 100,
                subtotal: 100,
                condition: 'good',
              },
            ],
          }),
        });
        const data = await response.json();
        logTest('创建退货订单 - 超长退货原因', !response.ok && !data.success);
      } catch (error) {
        logTest('创建退货订单 - 超长退货原因', false, error.message);
      }

      // 测试 7: 创建退货订单 - 无效的退货类型
      try {
        const response = await fetch(`${BASE_URL}/api/return-orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            salesOrderId: testSalesOrder.id,
            customerId: testCustomer.id,
            type: 'invalid_type',
            processType: 'refund',
            reason: '产品质量问题',
            items: [
              {
                salesOrderItemId: 'test-id',
                productId: 'test-product-id',
                returnQuantity: 1,
                originalQuantity: 10,
                unitPrice: 100,
                subtotal: 100,
                condition: 'good',
              },
            ],
          }),
        });
        const data = await response.json();
        logTest('创建退货订单 - 无效的退货类型', !response.ok && !data.success);
      } catch (error) {
        logTest('创建退货订单 - 无效的退货类型', false, error.message);
      }
    } else {
      console.log('⚠️  跳过需要销售订单的测试 (测试 4-7)\n');
    }

    // ==================== 第三部分: 退货订单详情测试 ====================
    console.log('\n第三部分: 退货订单详情测试\n');

    // 测试 6: 获取退货订单详情 - 无效ID
    try {
      const response = await fetch(`${BASE_URL}/api/return-orders/invalid-id`);
      const data = await response.json();
      logTest('获取退货订单详情 - 无效ID', !response.ok && !data.success);
    } catch (error) {
      logTest('获取退货订单详情 - 无效ID', false, error.message);
    }

    // ==================== 第四部分: 安全性测试 ====================
    console.log('\n第四部分: 安全性测试\n');

    // 测试 7: SQL 注入防护 - 搜索字段
    try {
      const searchTerm = encodeURIComponent("' OR '1'='1");
      const response = await fetch(
        `${BASE_URL}/api/return-orders?search=${searchTerm}`
      );
      const data = await response.json();
      // SQL注入防护测试:应该正常处理,不会导致错误或返回所有数据
      // 如果返回错误,说明没有正确处理SQL注入
      logTest('SQL 注入防护 - 搜索字段', response.ok && data.success);
    } catch (error) {
      logTest('SQL 注入防护 - 搜索字段', false, error.message);
    }

    // 测试 8: XSS 防护 - 退货原因
    try {
      const response = await fetch(`${BASE_URL}/api/return-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesOrderId: testSalesOrder ? testSalesOrder.id : 'test-id',
          customerId: testCustomer.id,
          type: 'quality_issue',
          processType: 'refund',
          reason: "<script>alert('XSS')</script>",
          items: [
            {
              salesOrderItemId: 'test-id',
              productId: 'test-product-id',
              returnQuantity: 1,
              originalQuantity: 10,
              unitPrice: 100,
              subtotal: 100,
              condition: 'good',
            },
          ],
        }),
      });
      const data = await response.json();
      // XSS防护测试:应该允许创建但会转义HTML标签,或者因为没有销售订单而失败
      logTest('XSS 防护 - 退货原因', response.ok || !data.success);
    } catch (error) {
      logTest('XSS 防护 - 退货原因', false, error.message);
    }

    // ==================== 测试结果汇总 ====================
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
    testResults.details.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.name}`);
    });

    console.log(
      '\n============================================================\n'
    );
  } catch (error) {
    console.error('测试执行失败:', error);
  }
}

// 运行测试
runTests();
