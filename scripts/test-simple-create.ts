/**
 * 简单的分类创建测试
 */

async function testSimpleCreate() {
  const baseUrl = 'http://localhost:3004';

  console.log('🧪 测试分类创建API...');

  const testData = {
    name: `测试分类 ${Date.now()}`,
    description: '这是一个测试分类',
  };

  try {
    console.log('发送请求:', JSON.stringify(testData, null, 2));

    const response = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    console.log('响应状态:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('响应内容 (前200字符):', responseText.substring(0, 200));

    if (responseText.startsWith('<!DOCTYPE')) {
      console.log('❌ 收到HTML响应，可能是错误页面');
      return;
    }

    try {
      const result = JSON.parse(responseText);
      console.log('解析结果:', result);

      if (result.success) {
        console.log('✅ 创建成功');

        // 清理测试数据
        const deleteResponse = await fetch(
          `${baseUrl}/api/categories/${result.data.id}`,
          {
            method: 'DELETE',
          }
        );

        if (deleteResponse.ok) {
          console.log('✅ 清理成功');
        }
      } else {
        console.log('❌ 创建失败:', result.error);
      }
    } catch (parseError) {
      console.log('❌ JSON解析失败:', parseError);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error);
  }
}

testSimpleCreate();
