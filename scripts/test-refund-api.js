/**
 * 测试退款API
 */

// 使用内置的fetch (Node.js 18+)
const fetch = globalThis.fetch;

async function testRefundAPI() {
  console.log('🧪 测试退款API...\n');

  try {
    // 1. 测试获取退款列表
    console.log('1. 测试获取退款列表...');
    const response = await fetch(
      'http://localhost:3000/api/finance/refunds?page=1&pageSize=10',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'next-auth.session-token=test', // 模拟会话
        },
      }
    );

    console.log(`状态码: ${response.status}`);
    const result = await response.text();
    console.log(`响应: ${result}`);

    // 2. 测试统计API
    console.log('\n2. 测试统计API...');
    const statsResponse = await fetch(
      'http://localhost:3000/api/finance/refunds/statistics',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'next-auth.session-token=test',
        },
      }
    );

    console.log(`统计API状态码: ${statsResponse.status}`);
    const statsResult = await statsResponse.text();
    console.log(`统计API响应: ${statsResult}`);
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testRefundAPI();
