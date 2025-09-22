/**
 * 测试开发服务器状态和入库记录API
 */

async function testServerStatus() {
  console.log('🔍 测试开发服务器状态...\n');
  
  try {
    // 测试主页
    console.log('1. 测试主页访问...');
    const homeResponse = await fetch('http://localhost:3000');
    console.log(`   主页状态: ${homeResponse.status} ${homeResponse.statusText}`);
    
    // 测试入库记录API
    console.log('\n2. 测试入库记录API...');
    const apiResponse = await fetch('http://localhost:3000/api/inventory/inbound?page=1&limit=5');
    console.log(`   API状态: ${apiResponse.status} ${apiResponse.statusText}`);
    
    if (apiResponse.ok) {
      const data = await apiResponse.json();
      console.log(`   API响应: ${data.success ? '成功' : '失败'}`);
      if (data.data) {
        console.log(`   记录数量: ${data.data.length}`);
      }
      if (data.pagination) {
        console.log(`   分页信息: 第${data.pagination.page}页，共${data.pagination.total}条记录`);
      }
    } else {
      const errorText = await apiResponse.text();
      console.log(`   错误详情: ${errorText}`);
    }
    
    // 测试库存管理页面
    console.log('\n3. 测试库存管理页面...');
    const inventoryResponse = await fetch('http://localhost:3000/dashboard/inventory');
    console.log(`   库存页面状态: ${inventoryResponse.status} ${inventoryResponse.statusText}`);
    
    console.log('\n✅ 服务器状态检查完成');
    
  } catch (error) {
    console.error('❌ 服务器状态检查失败:', error.message);
  }
}

// 运行测试
testServerStatus();
