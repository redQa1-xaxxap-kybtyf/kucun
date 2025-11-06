/**
 * 测试船公司名称编辑功能的端到端测试脚本
 *
 * 测试流程：
 * 1. 获取厂家发货订单列表
 * 2. 选择一个订单进行测试
 * 3. 更新船公司名称
 * 4. 验证更新是否成功
 * 5. 恢复原始数据
 */

import 'dotenv/config';

interface TestResult {
  step: string;
  status: 'success' | 'failed';
  message: string;
  data?: unknown;
}

const results: TestResult[] = [];

function logResult(
  step: string,
  status: 'success' | 'failed',
  message: string,
  data?: unknown
) {
  results.push({ step, status, message, data });
  const icon = status === 'success' ? '✅' : '❌';
  console.log(`${icon} ${step}: ${message}`);
  if (data) {
    console.log('   数据:', JSON.stringify(data, null, 2));
  }
}

async function testShippingCompanyEdit() {
  const baseUrl = 'http://localhost:3001';

  console.log('\n🚀 开始测试船公司名称编辑功能\n');
  console.log('='.repeat(60));

  try {
    // 步骤 1: 获取订单列表
    console.log('\n📋 步骤 1: 获取厂家发货订单列表');
    const listResponse = await fetch(
      `${baseUrl}/api/factory-shipments?page=1&limit=10`
    );

    if (!listResponse.ok) {
      logResult(
        '获取订单列表',
        'failed',
        `HTTP ${listResponse.status}: ${listResponse.statusText}`
      );
      return;
    }

    const listData = await listResponse.json();

    if (
      !listData.success ||
      !listData.data?.orders ||
      listData.data.orders.length === 0
    ) {
      logResult('获取订单列表', 'failed', '没有找到订单数据');
      return;
    }

    logResult(
      '获取订单列表',
      'success',
      `找到 ${listData.data.orders.length} 个订单`
    );

    // 步骤 2: 选择第一个订单进行测试
    const testOrder = listData.data.orders[0];
    const orderId = testOrder.id;
    const originalShippingCompany = testOrder.shippingCompany || '(空)';

    console.log('\n🎯 步骤 2: 选择测试订单');
    logResult('选择订单', 'success', `订单 ID: ${orderId}`, {
      id: orderId,
      orderNumber: testOrder.orderNumber,
      originalShippingCompany,
    });

    // 步骤 3: 更新船公司名称
    const newShippingCompany = `测试船公司 ${Date.now()}`;
    console.log('\n✏️ 步骤 3: 更新船公司名称');
    console.log(`   原始值: ${originalShippingCompany}`);
    console.log(`   新值: ${newShippingCompany}`);

    const updateResponse = await fetch(
      `${baseUrl}/api/factory-shipments/${orderId}/shipping-company`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shippingCompany: newShippingCompany,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json().catch(() => ({}));
      logResult(
        '更新船公司名称',
        'failed',
        `HTTP ${updateResponse.status}: ${JSON.stringify(errorData)}`
      );
      return;
    }

    const updateData = await updateResponse.json();

    if (!updateData.success) {
      logResult('更新船公司名称', 'failed', updateData.message || '更新失败');
      return;
    }

    logResult('更新船公司名称', 'success', '更新成功', {
      newValue: updateData.data?.shippingCompany,
    });

    // 步骤 4: 验证更新
    console.log('\n🔍 步骤 4: 验证更新结果');
    const verifyResponse = await fetch(
      `${baseUrl}/api/factory-shipments?page=1&limit=10`
    );

    if (!verifyResponse.ok) {
      logResult('验证更新', 'failed', `HTTP ${verifyResponse.status}`);
      return;
    }

    const verifyData = await verifyResponse.json();
    const updatedOrder = verifyData.data?.orders?.find(
      (o: { id: string }) => o.id === orderId
    );

    if (!updatedOrder) {
      logResult('验证更新', 'failed', '找不到更新后的订单');
      return;
    }

    if (updatedOrder.shippingCompany === newShippingCompany) {
      logResult('验证更新', 'success', '船公司名称已正确更新', {
        expected: newShippingCompany,
        actual: updatedOrder.shippingCompany,
      });
    } else {
      logResult('验证更新', 'failed', '船公司名称不匹配', {
        expected: newShippingCompany,
        actual: updatedOrder.shippingCompany,
      });
    }

    // 步骤 5: 恢复原始数据（如果原始值不为空）
    if (originalShippingCompany !== '(空)') {
      console.log('\n🔄 步骤 5: 恢复原始数据');
      const restoreResponse = await fetch(
        `${baseUrl}/api/factory-shipments/${orderId}/shipping-company`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            shippingCompany: originalShippingCompany,
          }),
        }
      );

      if (restoreResponse.ok) {
        logResult(
          '恢复原始数据',
          'success',
          `已恢复为: ${originalShippingCompany}`
        );
      } else {
        logResult('恢复原始数据', 'failed', '恢复失败（请手动恢复）');
      }
    }
  } catch (error) {
    logResult(
      '测试执行',
      'failed',
      `异常: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // 打印测试总结
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 测试总结\n');

  const successCount = results.filter(r => r.status === 'success').length;
  const failedCount = results.filter(r => r.status === 'failed').length;

  console.log(`总步骤数: ${results.length}`);
  console.log(`✅ 成功: ${successCount}`);
  console.log(`❌ 失败: ${failedCount}`);

  if (failedCount === 0) {
    console.log('\n🎉 所有测试通过！船公司名称编辑功能正常工作。\n');
  } else {
    console.log('\n⚠️ 部分测试失败，请检查上述错误信息。\n');
    process.exit(1);
  }
}

// 运行测试
testShippingCompanyEdit().catch(error => {
  console.error('\n❌ 测试脚本执行失败:', error);
  process.exit(1);
});
