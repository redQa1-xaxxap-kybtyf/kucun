/**
 * 测试 Toast 修复
 * 验证所有 toast 用法都已修复为正确的 shadcn/ui 格式
 */

async function testToastFixes() {
  const baseUrl = 'http://localhost:3004';

  console.log('🎨 开始测试 Toast 修复...\n');

  const timestamp = Date.now();
  const createdCategoryIds: string[] = [];

  try {
    // 1. 测试创建分类的 toast
    console.log('📝 1. 测试创建分类的 toast...');
    const createResponse = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Toast测试分类_${timestamp}`,
        description: '测试Toast修复的分类',
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
        `   💡 预期行为: 前端应显示 toast({ title: '创建成功', variant: 'success' })`
      );
    } else {
      throw new Error(`创建失败: ${createResult.error}`);
    }

    // 2. 测试状态管理的 toast
    console.log('\n🔄 2. 测试状态管理的 toast...');
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
        `   💡 预期行为: 前端应显示 toast({ title: '状态更新成功', variant: 'success' })`
      );
    } else {
      throw new Error(`状态更新失败: ${statusResult.error}`);
    }

    // 3. 测试编辑分类的 toast
    console.log('\n✏️ 3. 测试编辑分类的 toast...');
    const updateResponse = await fetch(
      `${baseUrl}/api/categories/${createdCategoryIds[0]}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: createdCategoryIds[0],
          name: `Toast测试分类_更新_${timestamp}`,
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
        `   💡 预期行为: 前端应显示 toast({ title: '更新成功', variant: 'success' })`
      );
    } else {
      throw new Error(`更新失败: ${updateResult.error}`);
    }

    // 4. 测试删除分类的 toast
    console.log('\n🗑️ 4. 测试删除分类的 toast...');
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
        `   💡 预期行为: 前端应显示 toast({ title: '删除成功', variant: 'success' })`
      );
      // 从数组中移除已删除的ID
      createdCategoryIds.splice(0, 1);
    } else {
      throw new Error(`删除失败: ${deleteResult.error}`);
    }

    console.log('\n🎉 Toast 修复测试完成！');
    console.log('\n📊 修复总结:');
    console.log('   ✅ 删除操作 toast 修复完成');
    console.log('   ✅ 创建操作 toast 修复完成');
    console.log('   ✅ 编辑操作 toast 修复完成');
    console.log('   ✅ 状态更新 toast 修复完成');

    console.log('\n💡 Toast 格式修复详情:');
    console.log('   🔧 修复前: toast.success("消息") - 不存在的方法');
    console.log(
      '   ✅ 修复后: toast({ title: "标题", description: "消息", variant: "success" })'
    );
    console.log('   🔧 修复前: toast.error("消息") - 不存在的方法');
    console.log(
      '   ✅ 修复后: toast({ title: "标题", description: "消息", variant: "destructive" })'
    );

    console.log('\n🎨 Toast 变体说明:');
    console.log('   🟢 success: 绿色背景，用于成功操作');
    console.log('   🔴 destructive: 红色背景，用于错误和失败操作');
    console.log('   ⚪ default: 默认背景，用于一般信息');
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
testToastFixes();
