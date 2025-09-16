// 带认证的核心 API 测试
// 注意：这个测试需要在开发服务器运行时执行

async function testAuthenticatedApis() {
  console.log('🚀 开始带认证的核心 API 测试...')
  
  const baseUrl = 'http://localhost:3001'
  
  try {
    // 1. 首先登录获取会话
    console.log('\n1. 用户登录...')
    
    const loginResponse = await fetch(`${baseUrl}/api/auth/signin/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@inventory.com',
        password: 'admin123456',
        redirect: false,
      }),
    })

    let sessionCookie = ''
    if (loginResponse.ok) {
      const cookies = loginResponse.headers.get('set-cookie')
      if (cookies) {
        sessionCookie = cookies.split(';')[0]
        console.log('   ✅ 登录成功，获取会话')
      } else {
        console.log('   ⚠️  登录成功但未获取到会话cookie')
      }
    } else {
      console.log('   ⚠️  登录失败，状态码:', loginResponse.status)
      // 尝试直接测试 API（可能中间件会处理认证）
    }

    // 2. 测试客户管理 API
    console.log('\n2. 测试客户管理 API...')
    
    const customerData = {
      name: 'API测试客户',
      phone: '13800138000',
      address: '测试地址123号',
      extendedInfo: {
        contactPerson: '张三',
        businessType: '零售',
      },
    }

    const createCustomerResponse = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie && { 'Cookie': sessionCookie }),
      },
      body: JSON.stringify(customerData),
    })

    let customerId = ''
    if (createCustomerResponse.ok) {
      const customerResult = await createCustomerResponse.json()
      customerId = customerResult.data.id
      console.log('   ✅ 客户创建成功:', customerResult.data.name)
    } else {
      const error = await createCustomerResponse.json()
      console.log('   ⚠️  客户创建失败:', error.error)
    }

    // 获取客户列表
    const getCustomersResponse = await fetch(`${baseUrl}/api/customers?page=1&limit=10`, {
      headers: {
        ...(sessionCookie && { 'Cookie': sessionCookie }),
      },
    })
    
    if (getCustomersResponse.ok) {
      const customersResult = await getCustomersResponse.json()
      console.log('   ✅ 客户列表获取成功，数量:', customersResult.data.length)
    } else {
      console.log('   ⚠️  客户列表获取失败，状态码:', getCustomersResponse.status)
    }

    // 3. 测试产品管理 API
    console.log('\n3. 测试产品管理 API...')
    
    const productData = {
      code: 'TEST-TILE-001',
      name: 'API测试瓷砖',
      specification: '600x600mm',
      specifications: {
        color: '白色',
        surface: '亮光',
        thickness: '10mm',
      },
      unit: 'piece',
      piecesPerUnit: 1,
      weight: 1.5,
    }

    const createProductResponse = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie && { 'Cookie': sessionCookie }),
      },
      body: JSON.stringify(productData),
    })

    let productId = ''
    if (createProductResponse.ok) {
      const productResult = await createProductResponse.json()
      productId = productResult.data.id
      console.log('   ✅ 产品创建成功:', productResult.data.name)
    } else {
      const error = await createProductResponse.json()
      console.log('   ⚠️  产品创建失败:', error.error)
    }

    // 4. 测试入库记录 API
    console.log('\n4. 测试入库记录 API...')
    
    if (productId) {
      const inboundData = {
        productId,
        type: 'normal_inbound',
        colorCode: 'WHITE001',
        productionDate: '2024-01-15',
        quantity: 100,
        remarks: 'API测试入库',
      }

      const createInboundResponse = await fetch(`${baseUrl}/api/inbound-records`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionCookie && { 'Cookie': sessionCookie }),
        },
        body: JSON.stringify(inboundData),
      })

      if (createInboundResponse.ok) {
        const inboundResult = await createInboundResponse.json()
        console.log('   ✅ 入库记录创建成功，数量:', inboundResult.data.quantity)
      } else {
        const error = await createInboundResponse.json()
        console.log('   ⚠️  入库记录创建失败:', error.error)
      }
    }

    // 5. 测试库存管理 API
    console.log('\n5. 测试库存管理 API...')
    
    const getInventoryResponse = await fetch(`${baseUrl}/api/inventory?page=1&limit=10`, {
      headers: {
        ...(sessionCookie && { 'Cookie': sessionCookie }),
      },
    })
    
    if (getInventoryResponse.ok) {
      const inventoryResult = await getInventoryResponse.json()
      console.log('   ✅ 库存列表获取成功，数量:', inventoryResult.data.length)
    } else {
      console.log('   ⚠️  库存列表获取失败，状态码:', getInventoryResponse.status)
    }

    // 6. 测试销售订单 API
    console.log('\n6. 测试销售订单 API...')
    
    if (customerId && productId) {
      const salesOrderData = {
        customerId,
        items: [
          {
            productId,
            colorCode: 'WHITE001',
            productionDate: '2024-01-15',
            quantity: 10,
            unitPrice: 25.50,
          },
        ],
        remarks: 'API测试订单',
      }

      const createOrderResponse = await fetch(`${baseUrl}/api/sales-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionCookie && { 'Cookie': sessionCookie }),
        },
        body: JSON.stringify(salesOrderData),
      })

      if (createOrderResponse.ok) {
        const orderResult = await createOrderResponse.json()
        console.log('   ✅ 销售订单创建成功:', orderResult.data.orderNumber)
      } else {
        const error = await createOrderResponse.json()
        console.log('   ⚠️  销售订单创建失败:', error.error)
      }
    }

    // 7. 测试 API 响应格式
    console.log('\n7. 测试 API 响应格式...')
    
    const testResponse = await fetch(`${baseUrl}/api/customers`, {
      headers: {
        ...(sessionCookie && { 'Cookie': sessionCookie }),
      },
    })
    
    if (testResponse.ok) {
      const result = await testResponse.json()
      if (result.success === true && result.data && result.pagination) {
        console.log('   ✅ API 响应格式正确')
      } else {
        console.log('   ⚠️  API 响应格式不正确')
      }
    } else {
      console.log('   ⚠️  API 响应测试失败，状态码:', testResponse.status)
    }

    console.log('\n🎉 带认证的核心 API 测试完成！')

  } catch (error) {
    console.error('\n❌ 带认证的核心 API 测试失败:', error)
    throw error
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testAuthenticatedApis()
    .then(() => {
      console.log('\n✅ 带认证的核心 API 测试成功完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ 带认证的核心 API 测试失败:', error)
      process.exit(1)
    })
}

export { testAuthenticatedApis }
