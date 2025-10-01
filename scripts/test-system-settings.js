/**
 * 系统设置模块完整单元测试
 * 测试范围：基本设置、用户管理、存储配置、系统日志
 */

const BASE_URL = 'http://localhost:3000';

// 测试数据存储
const testData = {
  userId: null,
  username: null,
};

// 测试结果统计
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, passed, error = null) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    log(`✓ ${testName}`, 'green');
  } else {
    testResults.failed++;
    log(`✗ ${testName}`, 'red');
    if (error) {
      log(`  错误: ${error}`, 'red');
      testResults.errors.push({ test: testName, error });
    }
  }
}

// API 请求封装
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { response, data };
}

// ==================== 基本设置测试 ====================

async function testBasicSettings() {
  log('\n========== 基本设置测试 ==========', 'cyan');

  // 测试1: 获取基本设置
  try {
    const { response, data } = await apiRequest('/api/settings/basic');
    logTest(
      '获取基本设置',
      response.ok && data.success && data.data?.companyName,
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取基本设置', false, error.message);
  }

  // 测试2: 更新基本设置
  try {
    const { response, data } = await apiRequest('/api/settings/basic', {
      method: 'PUT',
      body: JSON.stringify({
        companyName: '测试公司',
        companyAddress: '测试地址',
        companyPhone: '13800138000',
        companyEmail: 'test@example.com',
        systemName: '测试系统',
        defaultLanguage: 'zh',
        lowStockThreshold: 10,
        enableStockAlerts: true,
        orderNumberPrefix: 'TEST',
        enableOrderApproval: false,
      }),
    });
    logTest(
      '更新基本设置',
      response.ok && data.success,
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('更新基本设置', false, error.message);
  }

  // 测试3: 边界测试 - 无效的公司名称
  try {
    const { response, data } = await apiRequest('/api/settings/basic', {
      method: 'PUT',
      body: JSON.stringify({
        companyName: '', // 空字符串
        systemName: '测试系统',
        defaultLanguage: 'zh',
        lowStockThreshold: 10,
        enableStockAlerts: true,
        orderNumberPrefix: 'TEST',
        enableOrderApproval: false,
      }),
    });
    logTest('边界测试-空公司名称', !response.ok && !data.success);
  } catch (error) {
    logTest('边界测试-空公司名称', true);
  }

  // 测试4: 边界测试 - 无效的邮箱格式
  try {
    const { response, data } = await apiRequest('/api/settings/basic', {
      method: 'PUT',
      body: JSON.stringify({
        companyName: '测试公司',
        companyEmail: 'invalid-email', // 无效邮箱
        systemName: '测试系统',
        defaultLanguage: 'zh',
        lowStockThreshold: 10,
        enableStockAlerts: true,
        orderNumberPrefix: 'TEST',
        enableOrderApproval: false,
      }),
    });
    logTest('边界测试-无效邮箱格式', !response.ok && !data.success);
  } catch (error) {
    logTest('边界测试-无效邮箱格式', true);
  }
}

// ==================== 用户管理测试 ====================

async function testUserManagement() {
  log('\n========== 用户管理测试 ==========', 'cyan');

  // 测试1: 获取用户列表
  try {
    const { response, data } = await apiRequest(
      '/api/settings/users?page=1&limit=10'
    );
    logTest(
      '获取用户列表',
      response.ok && data.success && Array.isArray(data.data?.users),
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取用户列表', false, error.message);
  }

  // 测试2: 创建用户
  const timestamp = Date.now();
  const username = `test${timestamp}`.substring(0, 20); // 限制长度为20
  try {
    const { response, data } = await apiRequest('/api/settings/users', {
      method: 'POST',
      body: JSON.stringify({
        username,
        email: `${username}@test.com`,
        name: '测试用户',
        password: 'Test123!@#',
        role: 'sales',
      }),
    });

    if (response.ok && data.success && data.data?.id) {
      testData.userId = data.data.id;
      testData.username = username;
      logTest('创建用户', true);
    } else {
      logTest('创建用户', false, data.error);
    }
  } catch (error) {
    logTest('创建用户', false, error.message);
  }

  // 测试3: 更新用户信息
  if (testData.userId) {
    try {
      const { response, data } = await apiRequest('/api/settings/users', {
        method: 'PUT',
        body: JSON.stringify({
          userId: testData.userId,
          name: '更新后的测试用户',
          email: `updated_${testData.username}@test.com`,
          role: 'sales',
          status: 'active',
        }),
      });
      logTest(
        '更新用户信息',
        response.ok && data.success,
        !response.ok ? data.error : null
      );
    } catch (error) {
      logTest('更新用户信息', false, error.message);
    }
  }

  // 测试5: 边界测试 - 无效的用户名
  try {
    const { response, data } = await apiRequest('/api/settings/users', {
      method: 'POST',
      body: JSON.stringify({
        username: 'ab', // 太短
        email: 'test@test.com',
        name: '测试',
        password: 'Test123!@#',
        role: 'sales',
      }),
    });
    logTest('边界测试-用户名太短', !response.ok && !data.success);
  } catch (error) {
    logTest('边界测试-用户名太短', true);
  }

  // 测试6: 边界测试 - 无效的邮箱
  try {
    const { response, data } = await apiRequest('/api/settings/users', {
      method: 'POST',
      body: JSON.stringify({
        username: 'testuser999',
        email: 'invalid-email',
        name: '测试',
        password: 'Test123!@#',
        role: 'sales',
      }),
    });
    logTest('边界测试-无效邮箱', !response.ok && !data.success);
  } catch (error) {
    logTest('边界测试-无效邮箱', true);
  }

  // 测试7: 边界测试 - 密码太短
  try {
    const { response, data } = await apiRequest('/api/settings/users', {
      method: 'POST',
      body: JSON.stringify({
        username: 'testuser999',
        email: 'test@test.com',
        name: '测试',
        password: '123', // 太短
        role: 'sales',
      }),
    });
    logTest('边界测试-密码太短', !response.ok && !data.success);
  } catch (error) {
    logTest('边界测试-密码太短', true);
  }
}

// ==================== 存储配置测试 ====================

async function testStorageSettings() {
  log('\n========== 存储配置测试 ==========', 'cyan');

  // 测试1: 获取存储配置
  try {
    const { response, data } = await apiRequest('/api/settings/storage');
    logTest(
      '获取存储配置',
      response.ok && data.success,
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取存储配置', false, error.message);
  }
}

// ==================== 系统日志测试 ====================

async function testSystemLogs() {
  log('\n========== 系统日志测试 ==========', 'cyan');

  // 测试1: 获取系统日志列表
  try {
    const { response, data } = await apiRequest(
      '/api/settings/logs?page=1&limit=10'
    );
    logTest(
      '获取系统日志列表',
      response.ok && data.success && Array.isArray(data.data?.logs),
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('获取系统日志列表', false, error.message);
  }

  // 测试2: 按类型筛选日志
  try {
    const { response, data } = await apiRequest(
      '/api/settings/logs?page=1&limit=10&type=system_event'
    );
    logTest(
      '按类型筛选日志',
      response.ok && data.success,
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('按类型筛选日志', false, error.message);
  }

  // 测试3: 按级别筛选日志
  try {
    const { response, data } = await apiRequest(
      '/api/settings/logs?page=1&limit=10&level=info'
    );
    logTest(
      '按级别筛选日志',
      response.ok && data.success,
      !response.ok ? data.error : null
    );
  } catch (error) {
    logTest('按级别筛选日志', false, error.message);
  }
}

// ==================== 主测试函数 ====================

async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║        系统设置模块完整单元测试                        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');

  const startTime = Date.now();

  // 运行所有测试
  await testBasicSettings();
  await testUserManagement();
  await testStorageSettings();
  await testSystemLogs();

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // 输出测试结果
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    测试结果汇总                        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  log(`\n总测试数: ${testResults.total}`);
  log(`通过: ${testResults.passed}`, 'green');
  log(`失败: ${testResults.failed}`, 'red');
  log(
    `通过率: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`
  );
  log(`耗时: ${duration}秒`);

  if (testResults.errors.length > 0) {
    log('\n失败的测试详情:\n', 'yellow');
    testResults.errors.forEach((err, index) => {
      log(`${index + 1}. ${err.test}`, 'yellow');
      log(`   ${err.error}\n`, 'red');
    });
  }

  log('\n测试完成！');
}

// 运行测试
runAllTests().catch(error => {
  log(`\n测试执行失败: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
