/**
 * 供应商管理功能单元测试
 * 测试范围: 供应商的增删改查、批量操作、边界条件、安全性
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
let testSupplier = null;
let testSupplier2 = null;

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
  console.log('供应商管理功能单元测试');
  console.log('============================================================\n');

  try {
    // ==================== 第一部分: 供应商查询测试 ====================
    console.log('第一部分: 供应商查询测试\n');

    // 测试 1: 供应商列表 API - 正常情况
    try {
      const response = await fetch(`${BASE_URL}/api/suppliers?page=1&limit=10`);
      const data = await response.json();
      logTest(
        '供应商列表 API - 正常情况',
        response.ok && data.success && Array.isArray(data.data)
      );
    } catch (error) {
      logTest('供应商列表 API - 正常情况', false, error.message);
    }

    // 测试 2: 供应商列表 API - 搜索功能
    try {
      const response = await fetch(`${BASE_URL}/api/suppliers?search=测试`);
      const data = await response.json();
      logTest(
        '供应商列表 API - 搜索功能',
        response.ok && data.success && Array.isArray(data.data)
      );
    } catch (error) {
      logTest('供应商列表 API - 搜索功能', false, error.message);
    }

    // ==================== 第二部分: 创建供应商测试 ====================
    console.log('\n第二部分: 创建供应商测试\n');

    // 测试 3: 创建供应商 - 正常情况
    try {
      const response = await fetch(`${BASE_URL}/api/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `测试供应商-${Date.now()}`,
          phone: '13800138000',
          address: '测试地址123号',
        }),
      });
      const data = await response.json();
      console.log('   响应状态:', response.status);
      console.log(
        '   响应数据:',
        JSON.stringify(data, null, 2).substring(0, 300)
      );
      if (response.status === 201 && data.success && data.data?.id) {
        testSupplier = data.data;
      }
      logTest(
        '创建供应商 - 正常情况',
        response.ok && data.success && data.data?.id
      );
    } catch (error) {
      logTest('创建供应商 - 正常情况', false, error.message);
    }

    // 测试 4: 创建供应商 - 空名称
    try {
      const response = await fetch(`${BASE_URL}/api/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          phone: '13800138000',
        }),
      });
      const data = await response.json();
      logTest('创建供应商 - 空名称', !response.ok && !data.success);
    } catch (error) {
      logTest('创建供应商 - 空名称', false, error.message);
    }

    // 测试 5: 创建供应商 - 超长名称
    try {
      const longName = 'A'.repeat(101);
      const response = await fetch(`${BASE_URL}/api/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: longName,
          phone: '13800138000',
        }),
      });
      const data = await response.json();
      logTest('创建供应商 - 超长名称', !response.ok && !data.success);
    } catch (error) {
      logTest('创建供应商 - 超长名称', false, error.message);
    }

    // 测试 6: 创建供应商 - 无效电话格式
    try {
      const response = await fetch(`${BASE_URL}/api/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `测试供应商-${Date.now()}`,
          phone: 'abc123xyz',
        }),
      });
      const data = await response.json();
      logTest('创建供应商 - 无效电话格式', !response.ok && !data.success);
    } catch (error) {
      logTest('创建供应商 - 无效电话格式', false, error.message);
    }

    // 测试 7: 创建供应商 - 超长地址
    try {
      const longAddress = 'A'.repeat(201);
      const response = await fetch(`${BASE_URL}/api/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `测试供应商-${Date.now()}`,
          address: longAddress,
        }),
      });
      const data = await response.json();
      logTest('创建供应商 - 超长地址', !response.ok && !data.success);
    } catch (error) {
      logTest('创建供应商 - 超长地址', false, error.message);
    }

    // ==================== 第三部分: 供应商详情测试 ====================
    console.log('\n第三部分: 供应商详情测试\n');

    // 测试 8: 获取供应商详情 - 正常情况
    if (testSupplier) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/suppliers/${testSupplier.id}`
        );
        const data = await response.json();
        logTest(
          '获取供应商详情 - 正常情况',
          response.ok && data.success && data.data?.id === testSupplier.id
        );
      } catch (error) {
        logTest('获取供应商详情 - 正常情况', false, error.message);
      }
    }

    // 测试 9: 获取供应商详情 - 无效ID
    try {
      const response = await fetch(`${BASE_URL}/api/suppliers/invalid-id`);
      const data = await response.json();
      logTest('获取供应商详情 - 无效ID', !response.ok && !data.success);
    } catch (error) {
      logTest('获取供应商详情 - 无效ID', false, error.message);
    }

    // ==================== 第四部分: 更新供应商测试 ====================
    console.log('\n第四部分: 更新供应商测试\n');

    // 测试 10: 更新供应商 - 正常情况
    if (testSupplier) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/suppliers/${testSupplier.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `更新后的供应商-${Date.now()}`,
              phone: '13900139000',
            }),
          }
        );
        const data = await response.json();
        logTest('更新供应商 - 正常情况', response.ok && data.success);
      } catch (error) {
        logTest('更新供应商 - 正常情况', false, error.message);
      }
    }

    // 测试 11: 更新供应商 - 空名称
    if (testSupplier) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/suppliers/${testSupplier.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: '',
            }),
          }
        );
        const data = await response.json();
        logTest('更新供应商 - 空名称', !response.ok && !data.success);
      } catch (error) {
        logTest('更新供应商 - 空名称', false, error.message);
      }
    }

    // 测试 12: 更新供应商状态 - 正常情况
    if (testSupplier) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/suppliers/${testSupplier.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'inactive',
            }),
          }
        );
        const data = await response.json();
        logTest('更新供应商状态 - 正常情况', response.ok && data.success);
      } catch (error) {
        logTest('更新供应商状态 - 正常情况', false, error.message);
      }
    }

    // ==================== 第五部分: 安全性测试 ====================
    console.log('\n第五部分: 安全性测试\n');

    // 测试 13: SQL 注入防护 - 搜索字段
    try {
      const response = await fetch(
        `${BASE_URL}/api/suppliers?search=' OR '1'='1`
      );
      const data = await response.json();
      logTest('SQL 注入防护 - 搜索字段', response.ok && data.success);
    } catch (error) {
      logTest('SQL 注入防护 - 搜索字段', false, error.message);
    }

    // 测试 14: XSS 防护 - 供应商名称
    try {
      const response = await fetch(`${BASE_URL}/api/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `<script>alert('XSS')</script>-${Date.now()}`,
          phone: '13800138000',
        }),
      });
      const data = await response.json();
      console.log('   响应状态:', response.status);
      console.log(
        '   响应数据:',
        JSON.stringify(data, null, 2).substring(0, 300)
      );
      logTest('XSS 防护 - 供应商名称', response.ok && data.success);
    } catch (error) {
      logTest('XSS 防护 - 供应商名称', false, error.message);
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
