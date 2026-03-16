/**
 * 测试收款记录创建
 * 运行: npx tsx scripts/test-payment-creation.ts [salesOrderId] [customerId] [amount]
 * 示例: npx tsx scripts/test-payment-creation.ts "cm123abc" "ck456def" 1000
 */

async function testPaymentCreation() {
  const baseUrl = 'http://localhost:3000';

  // 从命令行参数获取测试数据
  const args = process.argv.slice(2);
  const salesOrderId = args[0] || 'PLEASE_REPLACE_WITH_REAL_ORDER_ID';
  const customerId = args[1] || 'PLEASE_REPLACE_WITH_REAL_CUSTOMER_ID';
  const amount = args[2] ? parseFloat(args[2]) : 100;

  // 检查是否提供了真实的ID
  if (
    salesOrderId.includes('PLEASE_REPLACE') ||
    customerId.includes('PLEASE_REPLACE')
  ) {
    console.error('❌ 错误: 请提供真实的订单ID和客户ID');
    console.log('\n使用方法:');
    console.log(
      'npx tsx scripts/test-payment-creation.ts [订单ID] [客户ID] [金额]'
    );
    console.log('\n示例:');
    console.log(
      'npx tsx scripts/test-payment-creation.ts "cm62a5vup0003qbnkqh1gwsf6" "ck62a5vup0001qbnk8h2fwsf7" 1000'
    );
    console.log(
      '\n💡 提示: 你可以从数据库或应收账款页面获取真实的订单ID和客户ID'
    );
    process.exit(1);
  }

  const testPayload = {
    paymentType: 'order_payment',
    salesOrderId,
    customerId,
    paymentMethod: 'cash',
    paymentAmount: amount,
    actualPaymentAmount: amount,
    roundingAmount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    remarks: '测试收款 - 通过脚本创建',
  };

  console.log('🧪 测试收款记录创建');
  console.log('='.repeat(60));
  console.log('📝 请求数据:');
  console.log(JSON.stringify(testPayload, null, 2));
  console.log('\n🌐 API端点:', `${baseUrl}/api/payments`);
  console.log('='.repeat(60));

  try {
    console.log('\n⏳ 发送请求...');
    const response = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log(`\n📊 响应状态: ${response.status} ${response.statusText}`);

    const result = await response.json();
    console.log('\n📦 响应数据:');
    console.log(JSON.stringify(result, null, 2));

    if (!response.ok) {
      console.error('\n❌ 请求失败');
      console.error('='.repeat(60));

      if (result.error) {
        console.error('错误信息:', result.error);
      }

      if (result.details) {
        console.error('\n验证错误详情:');
        result.details.forEach((detail: any, index: number) => {
          console.error(
            `  ${index + 1}. 字段: ${detail.path?.join('.') || '未知'}`
          );
          console.error(`     消息: ${detail.message}`);
          if (detail.code) {
            console.error(`     代码: ${detail.code}`);
          }
        });
      }

      console.error('='.repeat(60));
      console.error('\n💡 调试建议:');
      console.error('1. 检查订单ID是否存在于数据库中');
      console.error('2. 检查客户ID是否与订单的客户ID匹配');
      console.error('3. 检查订单是否已经全额收款');
      console.error('4. 检查收款金额是否大于0且不超过待收金额');
      process.exit(1);
    } else {
      console.log('\n✅ 收款记录创建成功!');
      console.log('='.repeat(60));
      console.log('收款单号:', result.data.paymentNumber);
      console.log('收款金额:', result.data.paymentAmount);
      console.log('实际金额:', result.data.actualPaymentAmount);
      console.log('收款状态:', result.data.status);
      console.log('='.repeat(60));

      // 如果创建成功，尝试确认收款
      console.log('\n⏳ 尝试确认收款...');
      const confirmResponse = await fetch(
        `${baseUrl}/api/payments/${result.data.id}/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notes: '测试确认' }),
        }
      );

      const confirmResult = await confirmResponse.json();

      if (confirmResponse.ok) {
        console.log('✅ 收款确认成功!');
        console.log('收款状态:', confirmResult.data.status);
      } else {
        console.error('❌ 收款确认失败:', confirmResult.error);
      }

      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ 请求异常:');
    console.error('='.repeat(60));
    if (error instanceof Error) {
      console.error('错误类型:', error.name);
      console.error('错误消息:', error.message);
      console.error('\n堆栈信息:');
      console.error(error.stack);
    } else {
      console.error(error);
    }
    console.error('='.repeat(60));
    console.error('\n💡 可能的原因:');
    console.error('1. 开发服务器未运行 (请运行 npm run dev)');
    console.error('2. 网络连接问题');
    console.error('3. API端点地址错误');
    process.exit(1);
  }
}

// 使用说明
console.log('\n📋 收款记录创建测试工具');
console.log('='.repeat(60));
console.log('使用方法:');
console.log(
  '  npx tsx scripts/test-payment-creation.ts [订单ID] [客户ID] [金额]'
);
console.log('\n示例:');
console.log(
  '  npx tsx scripts/test-payment-creation.ts "cm62abc" "ck62def" 1000'
);
console.log('\n前置条件:');
console.log('  1. 开发服务器正在运行 (npm run dev)');
console.log('  2. 提供真实的订单ID和客户ID');
console.log('  3. 订单存在且有待收金额');
console.log(`${'='.repeat(60)}\n`);

testPaymentCreation();
