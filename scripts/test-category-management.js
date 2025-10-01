/**
 * 分类管理功能单元测试
 * 测试范围: 分类的增删改查、状态管理、层级关系、边界条件、安全性
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
let testCategory = null;
let testParentCategory = null;

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
  console.log('分类管理功能单元测试');
  console.log('============================================================\n');

  try {
    // ==================== 第一部分: 分类查询测试 ====================
    console.log('第一部分: 分类查询测试\n');

    // 测试 1: 分类列表 API - 正常情况
    try {
      const response = await fetch(
        `${BASE_URL}/api/categories?page=1&limit=10`
      );
      const data = await response.json();
      console.log('   响应状态:', response.status);
      console.log('   响应数据:', JSON.stringify(data, null, 2));
      logTest(
        '分类列表 API - 正常情况',
        response.ok &&
          data.success &&
          Array.isArray(data.data) &&
          data.pagination
      );
    } catch (error) {
      logTest('分类列表 API - 正常情况', false, error.message);
    }

    // ==================== 第二部分: 创建分类测试 ====================
    console.log('\n第二部分: 创建分类测试\n');

    // 测试 2: 创建分类 - 正常情况
    try {
      const response = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `测试分类-${Date.now()}`,
          code: `TEST-${Date.now()}`,
          sortOrder: 0,
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        testCategory = data.data;
      }
      logTest('创建分类 - 正常情况', response.status === 201 && data.success);
    } catch (error) {
      logTest('创建分类 - 正常情况', false, error.message);
    }

    // 测试 3: 创建分类 - 空名称
    try {
      const response = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          code: `TEST-${Date.now()}`,
        }),
      });
      const data = await response.json();
      logTest('创建分类 - 空名称', !response.ok && !data.success);
    } catch (error) {
      logTest('创建分类 - 空名称', false, error.message);
    }

    // 测试 4: 创建分类 - 重复名称
    if (testCategory) {
      try {
        const response = await fetch(`${BASE_URL}/api/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: testCategory.name,
            code: `TEST-${Date.now()}`,
          }),
        });
        const data = await response.json();
        logTest('创建分类 - 重复名称', !response.ok && !data.success);
      } catch (error) {
        logTest('创建分类 - 重复名称', false, error.message);
      }
    }

    // 测试 5: 创建分类 - 超长名称
    try {
      const longName = 'A'.repeat(51);
      const response = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: longName,
          code: `TEST-${Date.now()}`,
        }),
      });
      const data = await response.json();
      logTest('创建分类 - 超长名称', !response.ok && !data.success);
    } catch (error) {
      logTest('创建分类 - 超长名称', false, error.message);
    }

    // 测试 6: 创建分类 - 无效的编码格式
    try {
      const response = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `测试分类-${Date.now()}`,
          code: 'TEST@#$%',
        }),
      });
      const data = await response.json();
      logTest('创建分类 - 无效的编码格式', !response.ok && !data.success);
    } catch (error) {
      logTest('创建分类 - 无效的编码格式', false, error.message);
    }

    // 测试 7: 创建父级分类
    try {
      const response = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `父级分类-${Date.now()}`,
          code: `PARENT-${Date.now()}`,
          sortOrder: 0,
        }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        testParentCategory = data.data;
      }
      logTest('创建父级分类', response.status === 201 && data.success);
    } catch (error) {
      logTest('创建父级分类', false, error.message);
    }

    // 测试 8: 创建子分类
    if (testParentCategory) {
      try {
        const response = await fetch(`${BASE_URL}/api/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `子分类-${Date.now()}`,
            code: `CHILD-${Date.now()}`,
            parentId: testParentCategory.id,
            sortOrder: 0,
          }),
        });
        const data = await response.json();
        logTest('创建子分类', response.status === 201 && data.success);
      } catch (error) {
        logTest('创建子分类', false, error.message);
      }
    }

    // ==================== 第三部分: 分类详情测试 ====================
    console.log('\n第三部分: 分类详情测试\n');

    // 测试 9: 获取分类详情 - 正常情况
    if (testCategory) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/categories/${testCategory.id}`
        );
        const data = await response.json();
        logTest(
          '获取分类详情 - 正常情况',
          response.ok &&
            data.success &&
            data.data &&
            data.data.id === testCategory.id
        );
      } catch (error) {
        logTest('获取分类详情 - 正常情况', false, error.message);
      }
    }

    // 测试 10: 获取分类详情 - 无效ID
    try {
      const response = await fetch(`${BASE_URL}/api/categories/invalid-id`);
      const data = await response.json();
      logTest('获取分类详情 - 无效ID', !response.ok && !data.success);
    } catch (error) {
      logTest('获取分类详情 - 无效ID', false, error.message);
    }

    // ==================== 第四部分: 更新分类测试 ====================
    console.log('\n第四部分: 更新分类测试\n');

    // 测试 11: 更新分类 - 正常情况
    if (testCategory) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/categories/${testCategory.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `更新后的分类-${Date.now()}`,
              sortOrder: 10,
            }),
          }
        );
        const data = await response.json();
        logTest('更新分类 - 正常情况', response.ok && data.success);
      } catch (error) {
        logTest('更新分类 - 正常情况', false, error.message);
      }
    }

    // 测试 12: 更新分类 - 循环引用
    if (testCategory && testParentCategory) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/categories/${testCategory.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              parentId: testCategory.id,
            }),
          }
        );
        const data = await response.json();
        logTest('更新分类 - 循环引用', !response.ok && !data.success);
      } catch (error) {
        logTest('更新分类 - 循环引用', false, error.message);
      }
    }

    // ==================== 第五部分: 状态管理测试 ====================
    console.log('\n第五部分: 状态管理测试\n');

    // 测试 13: 更新分类状态 - 禁用
    if (testCategory) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/categories/${testCategory.id}/status`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'inactive',
            }),
          }
        );
        const data = await response.json();
        logTest('更新分类状态 - 禁用', response.ok && data.success);
      } catch (error) {
        logTest('更新分类状态 - 禁用', false, error.message);
      }
    }

    // 测试 14: 更新分类状态 - 启用
    if (testCategory) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/categories/${testCategory.id}/status`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'active',
            }),
          }
        );
        const data = await response.json();
        logTest('更新分类状态 - 启用', response.ok && data.success);
      } catch (error) {
        logTest('更新分类状态 - 启用', false, error.message);
      }
    }

    // 测试 15: 更新分类状态 - 无效状态值
    if (testCategory) {
      try {
        const response = await fetch(
          `${BASE_URL}/api/categories/${testCategory.id}/status`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'invalid',
            }),
          }
        );
        const data = await response.json();
        logTest('更新分类状态 - 无效状态值', !response.ok && !data.success);
      } catch (error) {
        logTest('更新分类状态 - 无效状态值', false, error.message);
      }
    }

    // ==================== 第六部分: 安全性测试 ====================
    console.log('\n第六部分: 安全性测试\n');

    // 测试 16: SQL 注入防护 - 搜索参数
    try {
      const response = await fetch(
        `${BASE_URL}/api/categories?search=' OR '1'='1`
      );
      const data = await response.json();
      logTest('SQL 注入防护 - 搜索参数', response.ok && data.success);
    } catch (error) {
      logTest('SQL 注入防护 - 搜索参数', false, error.message);
    }

    // 测试 17: XSS 防护 - 分类名称
    try {
      const xssName = "<script>alert('XSS')</script>";
      const response = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: xssName,
          code: `XSS-${Date.now()}`,
        }),
      });
      const data = await response.json();
      // XSS 防护测试: 应该拒绝包含 HTML 标签的名称
      logTest('XSS 防护 - 分类名称', !response.ok && !data.success);
    } catch (error) {
      logTest('XSS 防护 - 分类名称', false, error.message);
    }

    // 测试 18: 超长字符串防护 - 分类编码
    try {
      const longCode = 'A'.repeat(51);
      const response = await fetch(`${BASE_URL}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `测试分类-${Date.now()}`,
          code: longCode,
        }),
      });
      const data = await response.json();
      logTest('超长字符串防护 - 分类编码', !response.ok && !data.success);
    } catch (error) {
      logTest('超长字符串防护 - 分类编码', false, error.message);
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
