/**
 * 财务管理模块完整单元测试脚本
 * 测试范围：应付款、应收款、付款记录、收款记录、退款记录
 * 遵循全局约定规范：测试文件不提交到 Git
 */

const BASE_URL = 'http://localhost:3000';

// 测试统计
const testStats = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
};

// 测试数据存储
const testData = {
  supplierId: null,
  customerId: null,
  salesOrderId: null,
  returnOrderId: null,
  payableId: null,
  paymentOutId: null,
  paymentInId: null,
  refundId: null,
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, passed, error = null) {
  testStats.total++;
  if (passed) {
    testStats.passed++;
    log(`✓ ${name}`, 'green');
  } else {
    testStats.failed++;
    log(`✗ ${name}`, 'red');
    if (error) {
      log(`  错误: ${error}`, 'red');
      testStats.errors.push({ test: name, error });
    }
  }
}

// API 请求辅助函数
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();
  return { response, data };
}

// ==================== 准备测试数据 ====================

async function prepareTestData() {
  log('\n========== 准备测试数据 ==========', 'cyan');

  try {
    // 1. 获取供应商
    const { data: suppliersData } = await apiRequest(
      '/api/suppliers?pageSize=1'
    );
    if (
      suppliersData.success &&
      Array.isArray(suppliersData.data) &&
      suppliersData.data.length > 0
    ) {
      testData.supplierId = suppliersData.data[0].id;
      log(`✓ 获取供应商ID: ${testData.supplierId}`, 'green');
    } else {
      throw new Error('未找到供应商数据');
    }

    // 2. 获取客户
    const { data: customersData } = await apiRequest(
      '/api/customers?page=1&limit=1'
    );
    if (
      customersData.success &&
      Array.isArray(customersData.data) &&
      customersData.data.length > 0
    ) {
      testData.customerId = customersData.data[0].id;
      log(`✓ 获取客户ID: ${testData.customerId}`, 'green');
    } else {
      throw new Error('未找到客户数据');
    }

    // 3. 获取销售订单
    const { data: ordersData } = await apiRequest(
      '/api/sales-orders?page=1&limit=1'
    );
    if (
      ordersData.success &&
      ordersData.data?.data &&
      Array.isArray(ordersData.data.data) &&
      ordersData.data.data.length > 0
    ) {
      testData.salesOrderId = ordersData.data.data[0].id;
      log(`✓ 获取销售订单ID: ${testData.salesOrderId}`, 'green');
    } else {
      throw new Error('未找到销售订单数据');
    }

    return true;
  } catch (error) {
    log(`✗ 准备测试数据失败: ${error.message}`, 'red');
    return false;
  }
}

// ==================== 应付款管理测试 ====================

async function testPayables() {
  log('\n========== 应付款管理测试 ==========', 'cyan');

  // 测试1: 创建应付款记录
  try {
    const { response, data } = await apiRequest('/api/finance/payables', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: testData.supplierId,
        sourceType: 'purchase_order',
        sourceNumber: 'TEST-PO-001',
        payableAmount: 10000.5,
        dueDate: '2025-12-31',
        paymentTerms: '30天',
        description: '测试应付款',
        remarks: '单元测试创建',
      }),
    });

    if (response.ok && data.success && data.data?.id) {
      testData.payableId = data.data.id;
      logTest('创建应付款记录', true);
    } else {
      logTest('创建应付款记录', false, data.error || '创建失败');
    }
  } catch (error) {
    logTest('创建应付款记录', false, error.message);
  }

  // 测试2: 获取应付款列表
  try {
    const { response, data } = await apiRequest(
      '/api/finance/payables?page=1&limit=10'
    );
    logTest(
      '获取应付款列表',
      response.ok &&
        data.success &&
        data.data?.data &&
        Array.isArray(data.data.data),
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取应付款列表', false, error.message);
  }

  // 测试3: 获取应付款详情
  if (testData.payableId) {
    try {
      const { response, data } = await apiRequest(
        `/api/finance/payables/${testData.payableId}`
      );
      logTest(
        '获取应付款详情',
        response.ok && data.success && data.data?.id === testData.payableId,
        !response.ok ? data.error : null
      );
    } catch (error) {
      logTest('获取应付款详情', false, error.message);
    }
  }

  // 测试4: 更新应付款记录
  if (testData.payableId) {
    try {
      const { response, data } = await apiRequest(
        `/api/finance/payables/${testData.payableId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            id: testData.payableId,
            payableAmount: 12000.75,
            remarks: '更新测试',
          }),
        }
      );
      logTest('更新应付款记录', response.ok && data.success, data.error);
    } catch (error) {
      logTest('更新应付款记录', false, error.message);
    }
  }

  // 测试5: 边界条件 - 负数金额
  try {
    const { response, data } = await apiRequest('/api/finance/payables', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: testData.supplierId,
        sourceType: 'other',
        payableAmount: -100,
        dueDate: '2025-12-31',
      }),
    });
    logTest('边界测试-负数金额', !response.ok || !data.success);
  } catch (error) {
    logTest('边界测试-负数金额', true);
  }

  // 测试6: 边界条件 - 超大金额
  try {
    const { response, data } = await apiRequest('/api/finance/payables', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: testData.supplierId,
        sourceType: 'other',
        payableAmount: 9999999999,
        dueDate: '2025-12-31',
      }),
    });
    logTest('边界测试-超大金额', !response.ok || !data.success);
  } catch (error) {
    logTest('边界测试-超大金额', true);
  }

  // 测试7: 边界条件 - 无效日期
  try {
    const { response, data } = await apiRequest('/api/finance/payables', {
      method: 'POST',
      body: JSON.stringify({
        supplierId: testData.supplierId,
        sourceType: 'other',
        payableAmount: 1000,
        dueDate: 'invalid-date',
      }),
    });
    logTest('边界测试-无效日期', !response.ok || !data.success);
  } catch (error) {
    logTest('边界测试-无效日期', true);
  }

  // 测试8: 边界条件 - 缺少必填字段
  try {
    const { response, data } = await apiRequest('/api/finance/payables', {
      method: 'POST',
      body: JSON.stringify({
        sourceType: 'other',
        payableAmount: 1000,
      }),
    });
    logTest('边界测试-缺少必填字段', !response.ok || !data.success);
  } catch (error) {
    logTest('边界测试-缺少必填字段', true);
  }
}

// ==================== 付款记录测试 ====================

async function testPaymentsOut() {
  log('\n========== 付款记录测试 ==========', 'cyan');

  // 测试1: 创建付款记录
  if (testData.payableId) {
    try {
      const { response, data } = await apiRequest('/api/finance/payments-out', {
        method: 'POST',
        body: JSON.stringify({
          payableRecordId: testData.payableId,
          supplierId: testData.supplierId,
          paymentMethod: 'bank_transfer',
          paymentAmount: 5000.25,
          paymentDate: '2025-01-15',
          remarks: '测试付款',
          voucherNumber: 'TEST-V-001',
          bankInfo: '测试银行账户',
        }),
      });

      if (response.ok && data.success && data.data?.id) {
        testData.paymentOutId = data.data.id;
        logTest('创建付款记录', true);
      } else {
        logTest('创建付款记录', false, data.error);
      }
    } catch (error) {
      logTest('创建付款记录', false, error.message);
    }
  }

  // 测试2: 获取付款记录列表
  try {
    const { response, data } = await apiRequest(
      '/api/finance/payments-out?page=1&limit=10'
    );
    logTest(
      '获取付款记录列表',
      response.ok &&
        data.success &&
        data.data?.data &&
        Array.isArray(data.data.data),
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取付款记录列表', false, error.message);
  }

  // 测试3: 获取付款记录详情
  if (testData.paymentOutId) {
    try {
      const { response, data } = await apiRequest(
        `/api/finance/payments-out/${testData.paymentOutId}`
      );
      logTest(
        '获取付款记录详情',
        response.ok && data.success && data.data?.id === testData.paymentOutId,
        !response.ok ? data.error : null
      );
    } catch (error) {
      logTest('获取付款记录详情', false, error.message);
    }
  }

  // 测试4: 更新付款记录
  if (testData.paymentOutId) {
    try {
      const { response, data } = await apiRequest(
        `/api/finance/payments-out/${testData.paymentOutId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            id: testData.paymentOutId,
            paymentAmount: 6000.5,
            remarks: '更新付款测试',
          }),
        }
      );
      logTest('更新付款记录', response.ok && data.success, data.error);
    } catch (error) {
      logTest('更新付款记录', false, error.message);
    }
  }

  // 测试5: 边界条件 - 付款金额超过应付金额
  if (testData.payableId) {
    try {
      const { response, data } = await apiRequest('/api/finance/payments-out', {
        method: 'POST',
        body: JSON.stringify({
          payableRecordId: testData.payableId,
          supplierId: testData.supplierId,
          paymentMethod: 'cash',
          paymentAmount: 999999999,
          paymentDate: '2025-01-15',
        }),
      });
      logTest('边界测试-付款金额超限', !response.ok || !data.success);
    } catch (error) {
      logTest('边界测试-付款金额超限', true);
    }
  }
}

// ==================== 应收款管理测试 ====================

async function testReceivables() {
  log('\n========== 应收款管理测试 ==========', 'cyan');

  // 测试1: 获取应收款列表
  try {
    const { response, data } = await apiRequest(
      '/api/finance/receivables?page=1&pageSize=10'
    );
    logTest(
      '获取应收款列表',
      response.ok && data.success && Array.isArray(data.data?.receivables),
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取应收款列表', false, error.message);
  }

  // 测试2: 获取应收款统计
  try {
    const { response, data } = await apiRequest(
      '/api/finance/receivables/statistics'
    );
    logTest(
      '获取应收款统计',
      response.ok && data.success && data.data?.totalReceivable !== undefined,
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取应收款统计', false, error.message);
  }

  // 测试3: 按客户筛选应收款
  if (testData.customerId) {
    try {
      const { response, data } = await apiRequest(
        `/api/finance/receivables?customerId=${testData.customerId}`
      );
      logTest(
        '按客户筛选应收款',
        response.ok && data.success,
        !response.ok ? data.error : null
      );
    } catch (error) {
      logTest('按客户筛选应收款', false, error.message);
    }
  }

  // 测试4: 按状态筛选应收款
  try {
    const { response, data } = await apiRequest(
      '/api/finance/receivables?paymentStatus=unpaid'
    );
    logTest(
      '按状态筛选应收款',
      response.ok && data.success,
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('按状态筛选应收款', false, error.message);
  }

  // 测试5: 日期范围筛选
  try {
    const { response, data } = await apiRequest(
      '/api/finance/receivables?startDate=2025-01-01&endDate=2025-12-31'
    );
    logTest(
      '日期范围筛选应收款',
      response.ok && data.success,
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('日期范围筛选应收款', false, error.message);
  }
}

// ==================== 收款记录测试 ====================

async function testPaymentsIn() {
  log('\n========== 收款记录测试 ==========', 'cyan');

  // 测试1: 创建收款记录
  if (testData.salesOrderId && testData.customerId) {
    try {
      const { response, data } = await apiRequest('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          salesOrderId: testData.salesOrderId,
          customerId: testData.customerId,
          paymentMethod: 'bank_transfer',
          paymentAmount: 100.5, // 使用较小的金额避免超过应收金额
          paymentDate: '2025-01-15',
          remarks: '测试收款',
          receiptNumber: 'TEST-R-001',
          bankInfo: '测试银行账户',
        }),
      });

      if (response.ok && data.success && data.data?.id) {
        testData.paymentInId = data.data.id;
        logTest('创建收款记录', true);
      } else {
        logTest('创建收款记录', false, data.error);
      }
    } catch (error) {
      logTest('创建收款记录', false, error.message);
    }
  }

  // 测试2: 获取收款记录列表
  try {
    const { response, data } = await apiRequest(
      '/api/payments?page=1&pageSize=10'
    );
    logTest(
      '获取收款记录列表',
      response.ok && data.success && Array.isArray(data.data?.payments),
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取收款记录列表', false, error.message);
  }

  // 测试3: 获取收款记录详情
  if (testData.paymentInId) {
    try {
      const { response, data } = await apiRequest(
        `/api/payments/${testData.paymentInId}`
      );
      logTest(
        '获取收款记录详情',
        response.ok && data.success && data.data?.id === testData.paymentInId,
        !response.ok ? data.error : null
      );
    } catch (error) {
      logTest('获取收款记录详情', false, error.message);
    }
  }

  // 测试4: 更新收款记录
  if (testData.paymentInId) {
    try {
      const { response, data } = await apiRequest(
        `/api/payments/${testData.paymentInId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            paymentAmount: 3500.75,
            remarks: '更新收款测试',
          }),
        }
      );
      logTest('更新收款记录', response.ok && data.success, data.error);
    } catch (error) {
      logTest('更新收款记录', false, error.message);
    }
  }

  // 测试5: 边界条件 - 银行转账缺少银行信息
  if (testData.salesOrderId && testData.customerId) {
    try {
      const { response, data } = await apiRequest('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          salesOrderId: testData.salesOrderId,
          customerId: testData.customerId,
          paymentMethod: 'bank_transfer',
          paymentAmount: 1000,
          paymentDate: '2025-01-15',
          bankInfo: '', // 空银行信息
        }),
      });
      logTest('边界测试-银行转账缺少银行信息', !response.ok || !data.success);
    } catch (error) {
      logTest('边界测试-银行转账缺少银行信息', true);
    }
  }
}

// ==================== 退款记录测试 ====================

async function testRefunds() {
  log('\n========== 退款记录测试 ==========', 'cyan');

  // 测试1: 创建退款记录
  if (testData.salesOrderId && testData.customerId) {
    try {
      const { response, data } = await apiRequest('/api/finance/refunds', {
        method: 'POST',
        body: JSON.stringify({
          returnOrderId: '', // 可选字段，可以为空
          returnOrderNumber: '',
          salesOrderId: testData.salesOrderId,
          customerId: testData.customerId,
          refundType: 'partial_refund',
          refundMethod: 'bank_transfer',
          refundAmount: 100.5,
          refundDate: '2025-01-15',
          reason: '测试退款',
          remarks: '单元测试创建',
          bankInfo: '测试银行账户',
        }),
      });

      if (response.ok && data.success && data.data?.id) {
        testData.refundId = data.data.id;
        logTest('创建退款记录', true);
      } else {
        logTest('创建退款记录', false, data.error);
      }
    } catch (error) {
      logTest('创建退款记录', false, error.message);
    }
  }

  // 测试2: 获取退款记录列表
  try {
    const { response, data } = await apiRequest(
      '/api/finance/refunds?page=1&pageSize=10'
    );
    logTest(
      '获取退款记录列表',
      response.ok && data.success && Array.isArray(data.data?.refunds),
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取退款记录列表', false, error.message);
  }

  // 测试3: 获取退款记录详情
  if (testData.refundId) {
    try {
      const { response, data } = await apiRequest(
        `/api/finance/refunds/${testData.refundId}`
      );
      logTest(
        '获取退款记录详情',
        response.ok && data.success && data.data?.id === testData.refundId,
        !response.ok ? data.error : null
      );
    } catch (error) {
      logTest('获取退款记录详情', false, error.message);
    }
  }

  // 测试4: 更新退款记录
  if (testData.refundId) {
    try {
      const { response, data } = await apiRequest(
        `/api/finance/refunds/${testData.refundId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            processedAmount: 1000.25,
            status: 'processing',
            remarks: '更新退款测试',
          }),
        }
      );
      logTest('更新退款记录', response.ok && data.success, data.error);
    } catch (error) {
      logTest('更新退款记录', false, error.message);
    }
  }

  // 测试5: 获取退款统计
  try {
    const { response, data } = await apiRequest(
      '/api/finance/refunds/statistics'
    );
    logTest(
      '获取退款统计',
      response.ok && data.success,
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取退款统计', false, error.message);
  }

  // 测试6: 边界条件 - 退款金额为0
  if (testData.salesOrderId && testData.customerId) {
    try {
      const { response, data } = await apiRequest('/api/finance/refunds', {
        method: 'POST',
        body: JSON.stringify({
          salesOrderId: testData.salesOrderId,
          customerId: testData.customerId,
          refundType: 'partial_refund',
          refundMethod: 'cash',
          refundAmount: 0,
          refundDate: '2025-01-15',
          reason: '测试',
        }),
      });
      logTest('边界测试-退款金额为0', !response.ok || !data.success);
    } catch (error) {
      logTest('边界测试-退款金额为0', true);
    }
  }

  // 测试7: 边界条件 - 缺少退款原因
  if (testData.salesOrderId && testData.customerId) {
    try {
      const { response, data } = await apiRequest('/api/finance/refunds', {
        method: 'POST',
        body: JSON.stringify({
          salesOrderId: testData.salesOrderId,
          customerId: testData.customerId,
          refundType: 'partial_refund',
          refundMethod: 'cash',
          refundAmount: 1000,
          refundDate: '2025-01-15',
          reason: '', // 空原因
        }),
      });
      logTest('边界测试-缺少退款原因', !response.ok || !data.success);
    } catch (error) {
      logTest('边界测试-缺少退款原因', true);
    }
  }
}

// ==================== 财务统计测试 ====================

async function testFinanceStatistics() {
  log('\n========== 财务统计测试 ==========', 'cyan');

  // 测试1: 获取财务概览
  try {
    const { response, data } = await apiRequest('/api/finance');
    logTest(
      '获取财务概览',
      response.ok && data.success && data.data?.totalReceivable !== undefined,
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取财务概览', false, error.message);
  }

  // 测试2: 获取应付款统计
  try {
    const { response, data } = await apiRequest(
      '/api/finance/payables/statistics'
    );
    logTest(
      '获取应付款统计',
      response.ok && data.success,
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取应付款统计', false, error.message);
  }
}

// ==================== 主测试函数 ====================

async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║        财务管理模块完整单元测试                        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');

  const startTime = Date.now();

  // 准备测试数据
  const prepared = await prepareTestData();
  if (!prepared) {
    log('\n✗ 测试数据准备失败，无法继续测试', 'red');
    return;
  }

  // 运行所有测试
  await testPayables();
  await testPaymentsOut();
  await testReceivables();
  await testPaymentsIn();
  await testRefunds();
  await testFinanceStatistics();

  // 输出测试结果
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    测试结果汇总                        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  log(`\n总测试数: ${testStats.total}`, 'blue');
  log(`通过: ${testStats.passed}`, 'green');
  log(`失败: ${testStats.failed}`, 'red');
  log(
    `通过率: ${((testStats.passed / testStats.total) * 100).toFixed(2)}%`,
    'yellow'
  );
  log(`耗时: ${duration}秒`, 'blue');

  if (testStats.errors.length > 0) {
    log('\n失败的测试详情:', 'red');
    testStats.errors.forEach((err, index) => {
      log(`\n${index + 1}. ${err.test}`, 'red');
      log(`   ${err.error}`, 'red');
    });
  }

  log('\n测试完成！', 'cyan');
}

// 运行测试
runAllTests().catch(error => {
  log(`\n测试执行失败: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
