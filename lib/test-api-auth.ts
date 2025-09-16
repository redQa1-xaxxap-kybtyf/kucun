// API 认证测试
// 注意：这个测试需要在开发服务器运行时执行

async function testApiAuthentication() {
  console.log('🔐 开始 API 认证测试...')
  
  const baseUrl = 'http://localhost:3000'
  
  try {
    // 1. 测试用户注册 API
    console.log('\n1. 测试用户注册 API...')
    
    const registerData = {
      email: 'apitest@inventory.com',
      name: 'API测试用户',
      password: 'apitest123456',
      confirmPassword: 'apitest123456',
    }

    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registerData),
    })

    if (registerResponse.ok) {
      const registerResult = await registerResponse.json()
      console.log('   ✅ 用户注册成功:', registerResult.data.name)
    } else {
      const error = await registerResponse.json()
      if (error.error?.includes('已被注册')) {
        console.log('   ✅ 用户已存在，跳过注册')
      } else {
        throw new Error(`注册失败: ${error.error}`)
      }
    }

    // 2. 测试 Next-Auth 登录 API
    console.log('\n2. 测试 Next-Auth 登录 API...')
    
    const loginData = {
      email: 'admin@inventory.com',
      password: 'admin123456',
      redirect: false,
    }

    const loginResponse = await fetch(`${baseUrl}/api/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    })

    console.log('   登录响应状态:', loginResponse.status)
    console.log('   登录响应头:', Object.fromEntries(loginResponse.headers.entries()))

    // 3. 测试受保护的 API 路由（无认证）
    console.log('\n3. 测试受保护的 API 路由（无认证）...')
    
    const protectedResponse = await fetch(`${baseUrl}/api/users`, {
      method: 'GET',
    })

    if (protectedResponse.status === 401 || protectedResponse.status === 403) {
      console.log('   ✅ 未认证访问被正确拒绝')
    } else {
      console.log('   ⚠️  未认证访问未被拒绝，状态码:', protectedResponse.status)
    }

    // 4. 测试 API 响应格式
    console.log('\n4. 测试 API 响应格式...')
    
    const testResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'invalid-email',
        name: 'Test',
        password: '123',
        confirmPassword: '123',
      }),
    })

    if (!testResponse.ok) {
      const errorResult = await testResponse.json()
      if (errorResult.success === false && errorResult.error) {
        console.log('   ✅ API 错误响应格式正确')
      } else {
        console.log('   ⚠️  API 错误响应格式不正确:', errorResult)
      }
    }

    // 5. 测试数据验证
    console.log('\n5. 测试数据验证...')
    
    const invalidDataResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'invalid-email',
        name: '',
        password: '123',
      }),
    })

    if (!invalidDataResponse.ok) {
      const validationError = await invalidDataResponse.json()
      if (validationError.details && Array.isArray(validationError.details)) {
        console.log('   ✅ 数据验证正确工作')
        console.log('   验证错误:', validationError.details.length, '个')
      } else {
        console.log('   ⚠️  数据验证响应格式不正确')
      }
    }

    // 6. 测试 CORS 和安全头
    console.log('\n6. 测试 CORS 和安全头...')
    
    const corsResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'OPTIONS',
    })

    console.log('   OPTIONS 响应状态:', corsResponse.status)
    console.log('   安全头检查:')
    console.log('     - Content-Type:', corsResponse.headers.get('content-type'))
    console.log('     - X-Frame-Options:', corsResponse.headers.get('x-frame-options'))

    console.log('\n🎉 API 认证测试完成！')

  } catch (error) {
    console.error('\n❌ API 认证测试失败:', error)
    throw error
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testApiAuthentication()
    .then(() => {
      console.log('\n✅ API 认证测试成功完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ API 认证测试失败:', error)
      process.exit(1)
    })
}

export { testApiAuthentication }
