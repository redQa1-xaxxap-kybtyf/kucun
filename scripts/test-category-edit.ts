/**
 * 测试分类编辑功能
 * 验证分类编辑页面的表单提交和数据处理
 */

async function testCategoryEdit() {
  const baseUrl = 'http://localhost:3003';
  
  console.log('开始测试分类编辑功能...\n');

  try {
    // 1. 获取一个现有分类用于测试
    console.log('1. 获取现有分类列表');
    const listResponse = await fetch(`${baseUrl}/api/categories?limit=1`);
    const listData = await listResponse.json();
    
    if (!listData.success || listData.data.length === 0) {
      console.log('❌ 没有找到可用于测试的分类');
      return;
    }

    const testCategory = listData.data[0];
    console.log(`✅ 找到测试分类: ${testCategory.name} (ID: ${testCategory.id})`);

    // 2. 获取分类详情
    console.log('\n2. 获取分类详情');
    const detailResponse = await fetch(`${baseUrl}/api/categories/${testCategory.id}`);
    const detailData = await detailResponse.json();

    if (detailData.success) {
      console.log(`✅ 获取分类详情成功`);
      console.log(`   名称: ${detailData.data.name}`);
      console.log(`   编码: ${detailData.data.code}`);
      console.log(`   描述: ${detailData.data.description || '无'}`);
      console.log(`   父级ID: ${detailData.data.parentId || '无（顶级分类）'}`);
      console.log(`   状态: ${detailData.data.status}`);
    } else {
      console.log(`❌ 获取分类详情失败: ${detailData.error}`);
      return;
    }

    // 3. 测试更新分类（只更新描述，避免影响其他数据）
    console.log('\n3. 测试更新分类');
    const originalDescription = detailData.data.description;
    const testDescription = `${originalDescription || '测试描述'} - 编辑测试 ${new Date().toISOString()}`;

    const updateData = {
      name: detailData.data.name,
      description: testDescription,
    };

    const updateResponse = await fetch(`${baseUrl}/api/categories/${testCategory.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    const updateResult = await updateResponse.json();

    if (updateResult.success) {
      console.log(`✅ 更新分类成功`);
      console.log(`   新描述: ${updateResult.data.description}`);
    } else {
      console.log(`❌ 更新分类失败: ${updateResult.error}`);
      return;
    }

    // 4. 验证更新结果
    console.log('\n4. 验证更新结果');
    const verifyResponse = await fetch(`${baseUrl}/api/categories/${testCategory.id}`);
    const verifyData = await verifyResponse.json();

    if (verifyData.success && verifyData.data.description === testDescription) {
      console.log(`✅ 更新验证成功，描述已正确更新`);
    } else {
      console.log(`❌ 更新验证失败，描述未正确更新`);
    }

    // 5. 恢复原始描述（清理测试数据）
    console.log('\n5. 恢复原始数据');
    const restoreData = {
      name: detailData.data.name,
      description: originalDescription,
    };

    const restoreResponse = await fetch(`${baseUrl}/api/categories/${testCategory.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(restoreData),
    });
    const restoreResult = await restoreResponse.json();

    if (restoreResult.success) {
      console.log(`✅ 原始数据恢复成功`);
    } else {
      console.log(`❌ 原始数据恢复失败: ${restoreResult.error}`);
    }

    console.log('\n🎉 分类编辑功能测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testCategoryEdit();
