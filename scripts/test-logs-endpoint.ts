/**
 * 简单测试系统日志 API 端点
 */

async function testLogsEndpoint() {
  console.log('🧪 测试系统日志 API 端点');
  console.log('='.repeat(80));

  const url = 'http://localhost:3001/api/settings/logs?page=1&limit=20';

  try {
    console.log(`\n📍 请求 URL: ${url}`);
    console.log('⏳ 发送请求...\n');

    const response = await fetch(url);

    console.log(`📊 HTTP 状态: ${response.status} ${response.statusText}`);

    const contentType = response.headers.get('content-type');
    console.log(`📊 Content-Type: ${contentType}`);

    const text = await response.text();

    if (response.ok) {
      console.log('\n✅ 请求成功！');
      try {
        const data = JSON.parse(text);
        console.log('\n📄 响应数据:');
        console.log(JSON.stringify(data, null, 2));
      } catch (_e) {
        console.log('\n⚠️  响应不是 JSON:');
        console.log(text);
      }
    } else {
      console.log('\n❌ 请求失败！');
      console.log('\n📄 错误响应:');
      console.log(text);
    }
  } catch (error) {
    console.error('\n❌ 发生错误:');
    console.error(error);
  }

  console.log('\n' + '='.repeat(80));
}

testLogsEndpoint();
