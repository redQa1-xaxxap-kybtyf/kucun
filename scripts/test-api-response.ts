/**
 * 测试入库记录API响应
 * 直接调用处理函数，模拟API响应
 */

import { 
  getInboundRecords,
  parseInboundQueryParams,
} from '../lib/api/inbound-handlers';

async function testApiResponse() {
  console.log('🔍 测试入库记录API响应...\n');
  
  try {
    // 1. 模拟查询参数
    console.log('1. 解析查询参数...');
    const searchParams = new URLSearchParams({
      page: '1',
      limit: '10',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    
    const queryData = parseInboundQueryParams(searchParams);
    console.log('✅ 查询参数解析成功:', {
      page: queryData.page,
      limit: queryData.limit,
      sortBy: queryData.sortBy,
      sortOrder: queryData.sortOrder,
    });
    
    // 2. 调用获取记录函数
    console.log('\n2. 调用获取记录函数...');
    const response = await getInboundRecords(queryData);
    
    console.log('✅ API响应成功');
    console.log(`📊 响应数据统计:`);
    console.log(`  成功状态: ${response.success}`);
    console.log(`  记录数量: ${response.data.length}`);
    console.log(`  分页信息:`);
    console.log(`    当前页: ${response.pagination.page}`);
    console.log(`    每页数量: ${response.pagination.limit}`);
    console.log(`    总记录数: ${response.pagination.total}`);
    console.log(`    总页数: ${response.pagination.pages}`);
    
    // 3. 检查记录详情
    console.log('\n3. 检查记录详情...');
    if (response.data.length > 0) {
      response.data.forEach((record, index) => {
        console.log(`\n  记录 ${index + 1}:`);
        console.log(`    ID: ${record.id}`);
        console.log(`    记录编号: ${record.recordNumber}`);
        console.log(`    产品ID: ${record.productId}`);
        console.log(`    产品名称: ${record.productName || '❌ 未获取'}`);
        console.log(`    产品编码: ${record.productSku || '❌ 未获取'}`);
        console.log(`    产品单位: ${record.productUnit || '❌ 未获取'}`);
        console.log(`    数量: ${record.quantity}`);
        console.log(`    单价: ${record.unitCost}`);
        console.log(`    总价: ${record.totalCost}`);
        console.log(`    色号: ${record.colorCode || '无'}`);
        console.log(`    生产日期: ${record.productionDate || '无'}`);
        console.log(`    原因: ${record.reason}`);
        console.log(`    备注: ${record.remarks || '无'}`);
        console.log(`    用户ID: ${record.userId}`);
        console.log(`    用户名称: ${record.userName || '❌ 未获取'}`);
        console.log(`    创建时间: ${record.createdAt}`);
        console.log(`    更新时间: ${record.updatedAt}`);
        
        // 检查关键字段是否有值
        const hasProductInfo = record.productName && record.productSku && record.productUnit;
        const hasUserInfo = record.userName;
        
        console.log(`    产品信息完整性: ${hasProductInfo ? '✅ 完整' : '❌ 缺失'}`);
        console.log(`    用户信息完整性: ${hasUserInfo ? '✅ 完整' : '❌ 缺失'}`);
      });
    } else {
      console.log('  ⚠️  没有找到入库记录');
    }
    
    // 4. 生成JSON响应示例
    console.log('\n4. JSON响应示例:');
    const jsonResponse = JSON.stringify(response, null, 2);
    console.log(jsonResponse.substring(0, 1000) + (jsonResponse.length > 1000 ? '...' : ''));
    
    console.log('\n✅ API响应测试完成');
    
    // 5. 问题诊断
    console.log('\n5. 问题诊断:');
    if (response.data.length > 0) {
      const firstRecord = response.data[0];
      const issues = [];
      
      if (!firstRecord.productName) issues.push('产品名称缺失');
      if (!firstRecord.productSku) issues.push('产品编码缺失');
      if (!firstRecord.productUnit) issues.push('产品单位缺失');
      if (!firstRecord.userName) issues.push('用户名称缺失');
      
      if (issues.length > 0) {
        console.log('❌ 发现问题:');
        issues.forEach(issue => console.log(`  - ${issue}`));
      } else {
        console.log('✅ 所有关键字段都正常');
      }
    }
    
  } catch (error) {
    console.error('❌ API响应测试失败:', error);
    
    if (error instanceof Error) {
      console.error('错误详情:', error.message);
      console.error('错误堆栈:', error.stack);
    }
  }
}

// 运行测试
testApiResponse().catch(console.error);
