/**
 * 往来账单API测试脚本
 * 用于验证API路径和响应格式是否正确
 *
 * 使用方法:
 * 1. 确保开发服务器正在运行 (npm run dev)
 * 2. 运行此脚本: node scripts/test-statements-api.js
 */

const http = require('http');

// 测试配置
const BASE_URL = 'http://localhost:3000';
const TEST_CASES = [
  {
    name: '获取往来账单列表（客户）',
    path: '/api/finance/statements?page=1&limit=10&type=customer',
    method: 'GET',
    expectedStatus: 200,
    validateResponse: data => {
      if (!data.success) {
        return { valid: false, error: '响应success字段不为true' };
      }
      if (!data.data) {
        return { valid: false, error: '缺少data字段' };
      }
      if (!Array.isArray(data.data.statements)) {
        return { valid: false, error: 'data.statements不是数组' };
      }
      if (!data.data.pagination) {
        return { valid: false, error: '缺少pagination字段' };
      }
      if (!data.data.summary) {
        return { valid: false, error: '缺少summary字段' };
      }
      return { valid: true };
    },
  },
  {
    name: '获取往来账单列表（供应商）',
    path: '/api/finance/statements?page=1&limit=10&type=supplier',
    method: 'GET',
    expectedStatus: 200,
    validateResponse: data => {
      if (!data.success) {
        return { valid: false, error: '响应success字段不为true' };
      }
      if (!data.data || !Array.isArray(data.data.statements)) {
        return { valid: false, error: '响应格式不正确' };
      }
      return { valid: true };
    },
  },
  {
    name: '搜索往来账单',
    path: '/api/finance/statements?page=1&limit=10&search=测试',
    method: 'GET',
    expectedStatus: 200,
    validateResponse: data => {
      if (!data.success) {
        return { valid: false, error: '响应success字段不为true' };
      }
      return { valid: true };
    },
  },
];

/**
 * 发送HTTP请求
 */
function makeRequest(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData,
          });
        } catch (error) {
          reject(new Error(`解析响应失败: ${error.message}`));
        }
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.end();
  });
}

/**
 * 运行单个测试用例
 */
async function runTestCase(testCase) {
  console.log(`\n🧪 测试: ${testCase.name}`);
  console.log(`   路径: ${testCase.path}`);

  try {
    const url = `${BASE_URL}${testCase.path}`;
    const response = await makeRequest(url, testCase.method);

    // 检查状态码
    if (response.status !== testCase.expectedStatus) {
      console.log(
        `   ❌ 失败: 期望状态码 ${testCase.expectedStatus}, 实际 ${response.status}`
      );
      console.log(`   响应: ${JSON.stringify(response.data, null, 2)}`);
      return false;
    }

    // 验证响应数据
    if (testCase.validateResponse) {
      const validation = testCase.validateResponse(response.data);
      if (!validation.valid) {
        console.log(`   ❌ 失败: ${validation.error}`);
        console.log(`   响应: ${JSON.stringify(response.data, null, 2)}`);
        return false;
      }
    }

    console.log(`   ✅ 通过`);

    // 显示响应摘要
    if (response.data.data) {
      const { statements, pagination, summary } = response.data.data;
      if (statements) {
        console.log(`   📊 数据: ${statements.length} 条记录`);
      }
      if (pagination) {
        console.log(
          `   📄 分页: 第${pagination.page}页, 共${pagination.total}条`
        );
      }
      if (summary) {
        console.log(
          `   💰 汇总: 客户${summary.totalCustomers}个, 供应商${summary.totalSuppliers}个`
        );
      }
    }

    return true;
  } catch (error) {
    console.log(`   ❌ 失败: ${error.message}`);
    return false;
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('📋 往来账单API测试');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    const result = await runTestCase(testCase);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 测试结果');
  console.log('='.repeat(60));
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📈 总计: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n🎉 所有测试通过！');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分测试失败，请检查上述错误信息');
    process.exit(1);
  }
}

// 检查服务器是否运行
async function checkServer() {
  console.log('🔍 检查开发服务器...');
  try {
    await makeRequest(`${BASE_URL}/api/health`, 'GET');
    console.log('✅ 服务器正在运行\n');
    return true;
  } catch (error) {
    console.log('❌ 服务器未运行或无法访问');
    console.log('   请先运行: npm run dev');
    console.log(`   错误: ${error.message}\n`);
    return false;
  }
}

// 主函数
async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }

  await runAllTests();
}

// 运行测试
main().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
