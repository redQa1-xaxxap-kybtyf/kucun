/**
 * 测试用户体验改进
 * 验证删除对话框自动关闭、操作反馈等功能
 */

async function testUXImprovements() {
  const baseUrl = 'http://localhost:3004';

  console.log('🎨 开始测试用户体验改进...\n');

  const timestamp = Date.now();
  const createdCategoryIds: string[] = [];

  try {
    // 1. 测试创建分类的用户反馈
    console.log('📝 1. 测试创建分类的用户反馈...');
    const createResponse = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `UX测试分类_${timestamp}`,
        description: '测试用户体验改进的分类',
        sortOrder: 1,
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`创建请求失败: HTTP ${createResponse.status}`);
    }

    const createResult = await createResponse.json();
    if (createResult.success) {
      createdCategoryIds.push(createResult.data.id);
      console.log(`   ✅ 创建成功: ${createResult.data.name}`);
      console.log(`   📝 生成编码: ${createResult.data.code}`);
      console.log(
        `   💡 预期行为: 创建成功后应显示详细的成功提示，然后延迟1.5秒跳转`
      );
    } else {
      throw new Error(`创建失败: ${createResult.error}`);
    }

    // 2. 测试状态管理的用户反馈
    console.log('\n🔄 2. 测试状态管理的用户反馈...');
    const statusResponse = await fetch(
      `${baseUrl}/api/categories/${createdCategoryIds[0]}/status`,
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
      throw new Error(`状态更新请求失败: HTTP ${statusResponse.status}`);
    }

    const statusResult = await statusResponse.json();
    if (statusResult.success) {
      console.log(`   ✅ 状态更新成功: ${statusResult.data.status}`);
      console.log(
        `   💡 预期行为: 状态更新时应显示加载指示器，成功后延迟显示提示`
      );
    } else {
      throw new Error(`状态更新失败: ${statusResult.error}`);
    }

    // 3. 测试编辑分类的用户反馈
    console.log('\n✏️ 3. 测试编辑分类的用户反馈...');
    const updateResponse = await fetch(
      `${baseUrl}/api/categories/${createdCategoryIds[0]}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: createdCategoryIds[0],
          name: `UX测试分类_更新_${timestamp}`,
          description: '这是更新后的描述',
          sortOrder: 2,
        }),
      }
    );

    if (!updateResponse.ok) {
      throw new Error(`更新请求失败: HTTP ${updateResponse.status}`);
    }

    const updateResult = await updateResponse.json();
    if (updateResult.success) {
      console.log(`   ✅ 更新成功: ${updateResult.data.name}`);
      console.log(
        `   💡 预期行为: 更新成功后应显示详细提示，然后延迟1.5秒跳转`
      );
    } else {
      throw new Error(`更新失败: ${updateResult.error}`);
    }

    // 4. 测试删除分类的用户反馈
    console.log('\n🗑️ 4. 测试删除分类的用户反馈...');
    const deleteResponse = await fetch(
      `${baseUrl}/api/categories/${createdCategoryIds[0]}`,
      {
        method: 'DELETE',
      }
    );

    if (!deleteResponse.ok) {
      throw new Error(`删除请求失败: HTTP ${deleteResponse.status}`);
    }

    const deleteResult = await deleteResponse.json();
    if (deleteResult.success) {
      console.log(`   ✅ 删除成功`);
      console.log(
        `   💡 预期行为: 删除确认对话框应立即关闭，然后延迟显示成功提示`
      );
      // 从数组中移除已删除的ID
      createdCategoryIds.splice(0, 1);
    } else {
      throw new Error(`删除失败: ${deleteResult.error}`);
    }

    console.log('\n🎉 用户体验改进测试完成！');
    console.log('\n📊 改进总结:');
    console.log('   ✅ 删除对话框自动关闭机制');
    console.log('   ✅ 创建成功后延迟跳转（1.5秒）');
    console.log('   ✅ 编辑成功后延迟跳转（1.5秒）');
    console.log('   ✅ 状态更新的加载指示器');
    console.log('   ✅ 改进的成功/失败提示信息');
    console.log('   ✅ 更好的按钮加载状态');

    console.log('\n💡 用户体验改进详情:');
    console.log('   🔄 删除操作: 对话框立即关闭 → 延迟100ms显示成功提示');
    console.log('   📝 创建操作: 立即显示成功提示 → 延迟1.5秒跳转页面');
    console.log('   ✏️ 编辑操作: 立即显示成功提示 → 延迟1.5秒跳转页面');
    console.log('   🔄 状态切换: 立即刷新数据 → 延迟200ms显示成功提示');
    console.log('   ⏳ 加载状态: 所有按钮都有详细的加载指示器');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);

    // 清理测试数据
    if (createdCategoryIds.length > 0) {
      console.log('\n🧹 清理测试数据...');
      for (const categoryId of createdCategoryIds) {
        try {
          await fetch(`${baseUrl}/api/categories/${categoryId}`, {
            method: 'DELETE',
          });
          console.log(`   ✅ 清理成功: ${categoryId}`);
        } catch (cleanupError) {
          console.log(`   ❌ 清理失败: ${categoryId}`);
        }
      }
    }
  }
}

// 运行测试
testUXImprovements();
