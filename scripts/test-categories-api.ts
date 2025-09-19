/**
 * 分类API测试脚本
 * 测试分类管理的所有API接口
 */

async function testCategoriesAPI() {
  const baseUrl = 'http://localhost:3003';

  console.log('开始测试分类API...\n');

  try {
    // 1. 测试获取分类列表
    console.log('1. 测试获取分类列表');
    const listResponse = await fetch(`${baseUrl}/api/categories?limit=5`);
    const listData = await listResponse.json();

    if (listData.success) {
      console.log(
        `✅ 获取分类列表成功，共 ${listData.pagination.total} 条记录`
      );
      console.log(
        `   前5条分类: ${listData.data.map((c: any) => c.name).join(', ')}`
      );
    } else {
      console.log(`❌ 获取分类列表失败: ${listData.error}`);
    }

    // 2. 测试创建分类
    console.log('\n2. 测试创建分类');
    const createData = {
      name: '测试分类API',
      code: 'TEST_API_CATEGORY',
      description: '通过API测试创建的分类',
      sortOrder: 999,
    };

    const createResponse = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createData),
    });
    const createResult = await createResponse.json();

    let testCategoryId = '';
    if (createResult.success) {
      testCategoryId = createResult.data.id;
      console.log(
        `✅ 创建分类成功: ${createResult.data.name} (ID: ${testCategoryId})`
      );
    } else {
      console.log(`❌ 创建分类失败: ${createResult.error}`);
      return;
    }

    // 3. 测试获取单个分类
    console.log('\n3. 测试获取单个分类');
    const getResponse = await fetch(
      `${baseUrl}/api/categories/${testCategoryId}`
    );
    const getData = await getResponse.json();

    if (getData.success) {
      console.log(`✅ 获取分类详情成功: ${getData.data.name}`);
    } else {
      console.log(`❌ 获取分类详情失败: ${getData.error}`);
    }

    // 4. 测试更新分类
    console.log('\n4. 测试更新分类');
    const updateData = {
      name: '测试分类API（已更新）',
      description: '通过API测试更新的分类',
    };

    const updateResponse = await fetch(
      `${baseUrl}/api/categories/${testCategoryId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }
    );
    const updateResult = await updateResponse.json();

    if (updateResult.success) {
      console.log(`✅ 更新分类成功: ${updateResult.data.name}`);
    } else {
      console.log(`❌ 更新分类失败: ${updateResult.error}`);
    }

    // 5. 测试更新分类状态
    console.log('\n5. 测试更新分类状态');
    const statusResponse = await fetch(
      `${baseUrl}/api/categories/${testCategoryId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'inactive' }),
      }
    );
    const statusResult = await statusResponse.json();

    if (statusResult.success) {
      console.log(`✅ 更新分类状态成功: ${statusResult.data.status}`);
    } else {
      console.log(`❌ 更新分类状态失败: ${statusResult.error}`);
    }

    // 6. 测试删除分类
    console.log('\n6. 测试删除分类');
    const deleteResponse = await fetch(
      `${baseUrl}/api/categories/${testCategoryId}`,
      {
        method: 'DELETE',
      }
    );
    const deleteResult = await deleteResponse.json();

    if (deleteResult.success) {
      console.log(`✅ 删除分类成功`);
    } else {
      console.log(`❌ 删除分类失败: ${deleteResult.error}`);
    }

    // 7. 测试搜索功能
    console.log('\n7. 测试搜索功能');
    const searchResponse = await fetch(
      `${baseUrl}/api/categories?search=瓷砖&limit=3`
    );
    const searchData = await searchResponse.json();

    if (searchData.success) {
      console.log(`✅ 搜索功能正常，找到 ${searchData.data.length} 条匹配记录`);
      console.log(
        `   搜索结果: ${searchData.data.map((c: any) => c.name).join(', ')}`
      );
    } else {
      console.log(`❌ 搜索功能失败: ${searchData.error}`);
    }

    console.log('\n🎉 所有API测试完成！');
  } catch (error) {
    console.error('❌ API测试过程中发生错误:', error);
  }
}

// 运行测试
testCategoriesAPI();
