// 简单的 API 测试
// 注意：这个测试需要在开发服务器运行时执行

async function testSimpleApi() {
  console.log('🚀 开始简单 API 测试...')
  
  const baseUrl = 'http://localhost:3001'
  
  try {
    // 1. 测试根路径
    console.log('\n1. 测试根路径...')
    const rootResponse = await fetch(`${baseUrl}/`)
    console.log('   根路径状态码:', rootResponse.status)
    console.log('   根路径 Content-Type:', rootResponse.headers.get('content-type'))

    // 2. 测试 API 路径（无认证）
    console.log('\n2. 测试 API 路径（无认证）...')
    const apiResponse = await fetch(`${baseUrl}/api/customers`)
    console.log('   API 状态码:', apiResponse.status)
    console.log('   API Content-Type:', apiResponse.headers.get('content-type'))
    
    if (apiResponse.headers.get('content-type')?.includes('application/json')) {
      const apiResult = await apiResponse.json()
      console.log('   API 响应:', apiResult)
    } else {
      const textResult = await apiResponse.text()
      console.log('   API 响应（前100字符）:', textResult.substring(0, 100))
    }

    // 3. 测试认证 API
    console.log('\n3. 测试认证 API...')
    const authResponse = await fetch(`${baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@inventory.com',
        password: 'admin123456',
      }),
    })
    
    console.log('   认证 API 状态码:', authResponse.status)
    console.log('   认证 API Content-Type:', authResponse.headers.get('content-type'))
    
    if (authResponse.headers.get('content-type')?.includes('application/json')) {
      const authResult = await authResponse.json()
      console.log('   认证 API 响应:', authResult)
    } else {
      const textResult = await authResponse.text()
      console.log('   认证 API 响应（前100字符）:', textResult.substring(0, 100))
    }

    // 4. 测试用户 API
    console.log('\n4. 测试用户 API...')
    const usersResponse = await fetch(`${baseUrl}/api/users`)
    console.log('   用户 API 状态码:', usersResponse.status)
    console.log('   用户 API Content-Type:', usersResponse.headers.get('content-type'))
    
    if (usersResponse.headers.get('content-type')?.includes('application/json')) {
      const usersResult = await usersResponse.json()
      console.log('   用户 API 响应:', usersResult)
    } else {
      const textResult = await usersResponse.text()
      console.log('   用户 API 响应（前100字符）:', textResult.substring(0, 100))
    }

    console.log('\n🎉 简单 API 测试完成！')

  } catch (error) {
    console.error('\n❌ 简单 API 测试失败:', error)
    throw error
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testSimpleApi()
    .then(() => {
      console.log('\n✅ 简单 API 测试成功完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ 简单 API 测试失败:', error)
      process.exit(1)
    })
}

export { testSimpleApi }
