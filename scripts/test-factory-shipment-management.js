/**
 * 厂家发货管理功能单元测试
 * 测试范围: 厂家发货订单的增删改查、状态管理、边界条件、安全性
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
let testOrder = null;
let testCustomer = null;
let testSupplier = null;
let testProduct = null;

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

// 生成 UUID v4 格式的幂等性键
function generateIdempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 主测试函数
async function runTests() {
  console.log('============================================================');
  console.log('厂家发货管理功能单元测试');
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

    // 获取测试供应商 - 直接从数据库查询
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const supplier = await prisma.supplier.findFirst();
      if (supplier) {
        testSupplier = supplier;
        console.log(`✅ 获取测试供应商: ${testSupplier.name}`);
      } else {
        // 创建测试供应商
        testSupplier = await prisma.supplier.create({
          data: {
            name: `测试供应商-${Date.now()}`,
            phone: '13800138000',
            address: '测试地址',
          },
        });
        console.log(`✅ 创建测试供应商: ${testSupplier.name}`);
      }
      await prisma.$disconnect();
    } catch (error) {
      console.log(`❌ 获取测试供应商失败: ${error.message}`);
    }

    // 获取测试产品 - 直接从数据库查询
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      const product = await prisma.product.findFirst();
      if (product) {
        testProduct = product;
        console.log(`✅ 获取测试产品: ${testProduct.name}\n`);
      } else {
        // 创建测试产品
        const category = await prisma.category.findFirst();
        if (!category) {
          console.log('❌ 缺少分类数据,无法创建测试产品\n');
        } else {
          testProduct = await prisma.product.create({
            data: {
              code: `TEST-${Date.now()}`,
              name: `测试产品-${Date.now()}`,
              categoryId: category.id,
              unit: '片',
              weight: 1.0,
              status: 'active',
            },
          });
          console.log(`✅ 创建测试产品: ${testProduct.name}\n`);
        }
      }
      await prisma.$disconnect();
    } catch (error) {
      console.log(`❌ 获取测试产品失败: ${error.message}\n`);
    }

    if (!testCustomer || !testSupplier || !testProduct) {
      console.log('❌ 缺少必要的测试数据,无法继续测试');
      return;
    }

    // ==================== 第一部分: 订单查询测试 ====================
    console.log('第一部分: 订单查询测试\n');

    // 测试 1: 订单列表 API - 正常情况
    try {
      const response = await fetch(
        `${BASE_URL}/api/factory-shipments?page=1&pageSize=10`
      );
      const data = await response.json();
      console.log('   响应状态:', response.status);
      console.log(
        '   响应数据:',
        JSON.stringify(data, null, 2).substring(0, 200)
      );
      logTest(
        '订单列表 API - 正常情况',
        response.ok &&
          data.orders &&
          Array.isArray(data.orders) &&
          data.pagination
      );
    } catch (error) {
      logTest('订单列表 API - 正常情况', false, error.message);
    }

    // ==================== 第二部分: 创建订单测试 ====================
    console.log('\n第二部分: 创建订单测试\n');

    // 测试 2: 创建订单 - 正常情况
    try {
      const response = await fetch(`${BASE_URL}/api/factory-shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          status: 'draft',
          items: [
            {
              productId: testProduct.id,
              supplierId: testSupplier.id,
              quantity: 100,
              unitPrice: 50,
              displayName: testProduct.name,
              specification: testProduct.specification || '',
              unit: testProduct.unit,
              weight: testProduct.weight || 0,
              isManualProduct: false,
            },
          ],
          remarks: '测试订单',
        }),
      });
      const data = await response.json();
      console.log('   响应状态:', response.status);
      console.log(
        '   响应数据:',
        JSON.stringify(data, null, 2).substring(0, 300)
      );
      if (response.status === 201 && data.id) {
        testOrder = data;
      }
      logTest('创建订单 - 正常情况', response.status === 201 && data.id);
    } catch (error) {
      logTest('创建订单 - 正常情况', false, error.message);
    }

    // 测试 3: 创建订单 - 空客户ID
    try {
      const response = await fetch(`${BASE_URL}/api/factory-shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: '',
          items: [
            {
              productId: testProduct.id,
              supplierId: testSupplier.id,
              quantity: 100,
              unitPrice: 50,
              displayName: testProduct.name,
              unit: testProduct.unit,
            },
          ],
        }),
      });
      const data = await response.json();
      logTest('创建订单 - 空客户ID', !response.ok && data.error);
    } catch (error) {
      logTest('创建订单 - 空客户ID', false, error.message);
    }

    // 测试 4: 创建订单 - 空订单明细
    try {
      const response = await fetch(`${BASE_URL}/api/factory-shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          items: [],
        }),
      });
      const data = await response.json();
      logTest('创建订单 - 空订单明细', !response.ok && data.error);
    } catch (error) {
      logTest('创建订单 - 空订单明细', false, error.message);
    }

    // 测试 5: 创建订单 - 负数数量
    try {
      const response = await fetch(`${BASE_URL}/api/factory-shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          items: [
            {
              productId: testProduct.id,
              supplierId: testSupplier.id,
              quantity: -10,
              unitPrice: 50,
              displayName: testProduct.name,
              unit: testProduct.unit,
            },
          ],
        }),
      });
      const data = await response.json();
      logTest('创建订单 - 负数数量', !response.ok && data.error);
    } catch (error) {
      logTest('创建订单 - 负数数量', false, error.message);
    }

    // 测试 6: 创建订单 - 负数单价
    try {
      const response = await fetch(`${BASE_URL}/api/factory-shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          items: [
            {
              productId: testProduct.id,
              supplierId: testSupplier.id,
              quantity: 100,
              unitPrice: -50,
              displayName: testProduct.name,
              unit: testProduct.unit,
            },
          ],
        }),
      });
      const data = await response.json();
      logTest('创建订单 - 负数单价', !response.ok && data.error);
    } catch (error) {
      logTest('创建订单 - 负数单价', false, error.message);
    }

    // 测试 7: 创建订单 - 定金超过应收金额
    try {
      const response = await fetch(`${BASE_URL}/api/factory-shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          receivableAmount: 1000,
          depositAmount: 2000,
          items: [
            {
              productId: testProduct.id,
              supplierId: testSupplier.id,
              quantity: 100,
              unitPrice: 50,
              displayName: testProduct.name,
              unit: testProduct.unit,
            },
          ],
        }),
      });
      const data = await response.json();
      logTest('创建订单 - 定金超过应收金额', !response.ok && data.error);
    } catch (error) {
      logTest('创建订单 - 定金超过应收金额', false, error.message);
    }

    // ==================== 第三部分: 订单详情测试 ====================
    console.log('\n第三部分: 订单详情测试\n');

    // 测试 8: 获取订单详情 - 正常情况
    if (testOrder) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/factory-shipments/${testOrder.id}`
        );
        const data = await response.json();
        logTest(
          '获取订单详情 - 正常情况',
          response.ok && data.id === testOrder.id
        );
      } catch (error) {
        logTest('获取订单详情 - 正常情况', false, error.message);
      }
    }

    // 测试 9: 获取订单详情 - 无效ID
    try {
      const response = await fetch(
        `${BASE_URL}/api/factory-shipments/invalid-id`
      );
      const data = await response.json();
      logTest('获取订单详情 - 无效ID', !response.ok && data.error);
    } catch (error) {
      logTest('获取订单详情 - 无效ID', false, error.message);
    }

    // ==================== 第四部分: 更新订单测试 ====================
    console.log('\n第四部分: 更新订单测试\n');

    // 测试 10: 更新订单 - 正常情况
    if (testOrder) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/factory-shipments/${testOrder.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idempotencyKey: generateIdempotencyKey(),
              remarks: '更新后的备注',
            }),
          }
        );
        const data = await response.json();
        logTest('更新订单 - 正常情况', response.ok && data.id);
      } catch (error) {
        logTest('更新订单 - 正常情况', false, error.message);
      }
    }

    // 测试 11: 更新订单 - 无效的幂等性键
    if (testOrder) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/factory-shipments/${testOrder.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idempotencyKey: 'invalid-key',
              remarks: '测试',
            }),
          }
        );
        const data = await response.json();
        logTest('更新订单 - 无效的幂等性键', !response.ok && data.error);
      } catch (error) {
        logTest('更新订单 - 无效的幂等性键', false, error.message);
      }
    }

    // ==================== 第五部分: 状态管理测试 ====================
    console.log('\n第五部分: 状态管理测试\n');

    // 测试 12: 更新订单状态 - draft -> planning
    if (testOrder) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/factory-shipments/${testOrder.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idempotencyKey: generateIdempotencyKey(),
              status: 'planning',
              remarks: '开始计划',
            }),
          }
        );
        const data = await response.json();
        logTest('更新订单状态 - draft -> planning', response.ok && data.id);
      } catch (error) {
        logTest('更新订单状态 - draft -> planning', false, error.message);
      }
    }

    // ==================== 第六部分: 安全性测试 ====================
    console.log('\n第六部分: 安全性测试\n');

    // 测试 13: SQL 注入防护 - 订单编号搜索
    try {
      const response = await fetch(
        `${BASE_URL}/api/factory-shipments?orderNumber=' OR '1'='1`
      );
      const data = await response.json();
      logTest('SQL 注入防护 - 订单编号搜索', response.ok && data.orders);
    } catch (error) {
      logTest('SQL 注入防护 - 订单编号搜索', false, error.message);
    }

    // 测试 14: XSS 防护 - 备注字段
    try {
      const response = await fetch(`${BASE_URL}/api/factory-shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          items: [
            {
              productId: testProduct.id,
              supplierId: testSupplier.id,
              quantity: 100,
              unitPrice: 50,
              displayName: testProduct.name,
              unit: testProduct.unit,
            },
          ],
          remarks: "<script>alert('XSS')</script>",
        }),
      });
      const data = await response.json();
      logTest('XSS 防护 - 备注字段', response.status === 201 && data.id);
    } catch (error) {
      logTest('XSS 防护 - 备注字段', false, error.message);
    }

    // 测试 15: 超长字符串防护 - 备注字段
    try {
      const longRemarks = 'A'.repeat(1001);
      const response = await fetch(`${BASE_URL}/api/factory-shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: testCustomer.id,
          items: [
            {
              productId: testProduct.id,
              supplierId: testSupplier.id,
              quantity: 100,
              unitPrice: 50,
              displayName: testProduct.name,
              unit: testProduct.unit,
            },
          ],
          remarks: longRemarks,
        }),
      });
      const data = await response.json();
      logTest('超长字符串防护 - 备注字段', !response.ok && data.error);
    } catch (error) {
      logTest('超长字符串防护 - 备注字段', false, error.message);
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
