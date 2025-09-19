/**
 * 快速集成测试 - 验证分类管理核心功能
 */

async function testQuickIntegration() {
  const baseUrl = 'http://localhost:3004';

  console.log('🚀 开始快速集成测试...\n');

  const timestamp = Date.now();
  let categoryId = '';

  try {
    // 1. 测试创建分类
    console.log('📝 1. 测试分类创建...');
    const createResponse = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `快速测试分类_${timestamp}`,
        description: '这是一个快速测试分类',
        sortOrder: 1,
      }),
    });

    if (!createResponse.ok) {
      throw new Error(
        `HTTP ${createResponse.status}: ${createResponse.statusText}`
      );
    }

    const createResult = await createResponse.json();
    if (createResult.success) {
      categoryId = createResult.data.id;
      console.log(`   ✅ 创建成功: ${createResult.data.name}`);
      console.log(`   📝 生成编码: ${createResult.data.code}`);
    } else {
      throw new Error(`创建失败: ${createResult.error}`);
    }

    // 2. 测试查询分类
    console.log('\n🔍 2. 测试分类查询...');
    const getResponse = await fetch(`${baseUrl}/api/categories/${categoryId}`);

    if (!getResponse.ok) {
      throw new Error(`HTTP ${getResponse.status}: ${getResponse.statusText}`);
    }

    const getResult = await getResponse.json();
    if (getResult.success) {
      console.log(`   ✅ 查询成功: ${getResult.data.name}`);
    } else {
      throw new Error(`查询失败: ${getResult.error}`);
    }

    // 3. 测试更新分类
    console.log('\n✏️ 3. 测试分类更新...');
    const updateResponse = await fetch(
      `${baseUrl}/api/categories/${categoryId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: categoryId,
          name: `更新后的分类_${timestamp}`,
          description: '这是更新后的描述',
          sortOrder: 2,
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error(
        `HTTP ${updateResponse.status}: ${updateResponse.statusText}`
      );
    }

    const updateResult = await updateResponse.json();
    if (updateResult.success) {
      console.log(`   ✅ 更新成功: ${updateResult.data.name}`);
    } else {
      throw new Error(`更新失败: ${updateResult.error}`);
    }

    // 4. 测试状态管理
    console.log('\n🔄 4. 测试状态管理...');
    const statusResponse = await fetch(
      `${baseUrl}/api/categories/${categoryId}/status`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'inactive',
        }),
      }
    );

    if (!statusResponse.ok) {
      throw new Error(
        `HTTP ${statusResponse.status}: ${statusResponse.statusText}`
      );
    }

    const statusResult = await statusResponse.json();
    if (statusResult.success) {
      console.log(`   ✅ 状态更新成功: ${statusResult.data.status}`);
    } else {
      throw new Error(`状态更新失败: ${statusResult.error}`);
    }

    // 5. 测试删除分类
    console.log('\n🗑️ 5. 测试分类删除...');
    const deleteResponse = await fetch(
      `${baseUrl}/api/categories/${categoryId}`,
      {
        method: 'DELETE',
      }
    );

    if (!deleteResponse.ok) {
      throw new Error(
        `HTTP ${deleteResponse.status}: ${deleteResponse.statusText}`
      );
    }

    const deleteResult = await deleteResponse.json();
    if (deleteResult.success) {
      console.log(`   ✅ 删除成功`);
      categoryId = ''; // 清空ID，避免重复删除
    } else {
      throw new Error(`删除失败: ${deleteResult.error}`);
    }

    console.log('\n🎉 快速集成测试完成！');
    console.log('\n📊 测试结果:');
    console.log('   ✅ 分类创建 - 通过');
    console.log('   ✅ 分类查询 - 通过');
    console.log('   ✅ 分类更新 - 通过');
    console.log('   ✅ 状态管理 - 通过');
    console.log('   ✅ 分类删除 - 通过');
    console.log('\n🚀 分类管理功能运行正常！');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);

    // 清理测试数据
    if (categoryId) {
      console.log('\n🧹 清理测试数据...');
      try {
        await fetch(`${baseUrl}/api/categories/${categoryId}`, {
          method: 'DELETE',
        });
        console.log('   ✅ 清理成功');
      } catch (cleanupError) {
        console.log('   ❌ 清理失败');
      }
    }
  }
}

testQuickIntegration();
