async function testRefundAPI() {
  try {
    console.log('🔍 直接测试退款API...');

    // 测试API端点
    const response = await fetch(
      'http://localhost:3000/api/finance/refunds?page=1&pageSize=10',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('响应状态:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('响应内容:', responseText);

    if (response.ok) {
      try {
        const data = JSON.parse(responseText);
        console.log('解析后的数据:', JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.error('JSON解析失败:', parseError.message);
      }
    } else {
      console.error('API请求失败:', response.status, responseText);
    }
  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testRefundAPI();
