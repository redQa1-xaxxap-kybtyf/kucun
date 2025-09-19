/**
 * 测试分类编码自动生成功能
 * 验证创建分类时编码的自动生成逻辑
 */

async function testAutoCodeGeneration() {
  const baseUrl = 'http://localhost:3003';

  console.log('开始测试分类编码自动生成功能...\n');

  const testCategories: Array<{ name: string; expectedCodePattern: RegExp }> = [
    { name: '测试分类', expectedCodePattern: /^测试分类(_\d+)?$/ },
    { name: 'Test Category', expectedCodePattern: /^TESTCATEGORY(_\d+)?$/ },
    {
      name: '混合Test分类123',
      expectedCodePattern: /^混合TEST分类123(_\d+)?$/,
    },
    { name: '特殊@#$符号', expectedCodePattern: /^特殊符号(_\d+)?$/ },
  ];

  const createdCategoryIds: string[] = [];

  try {
    for (let i = 0; i < testCategories.length; i++) {
      const testCase = testCategories[i];
      console.log(`${i + 1}. 测试分类名称: "${testCase.name}"`);

      // 创建分类（不提供编码）
      const createData = {
        name: testCase.name,
        description: `自动生成编码测试 - ${testCase.name}`,
        sortOrder: i + 1,
      };

      const createResponse = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createData),
      });

      const createResult = await createResponse.json();

      if (createResult.success) {
        const generatedCode = createResult.data.code;
        console.log(`   ✅ 创建成功`);
        console.log(`   📝 生成的编码: "${generatedCode}"`);
        console.log(
          `   🔍 编码格式检查: ${testCase.expectedCodePattern.test(generatedCode) ? '✅ 通过' : '❌ 失败'}`
        );

        createdCategoryIds.push(createResult.data.id);

        // 验证编码唯一性 - 创建同名分类
        console.log(`   🔄 测试同名分类的编码唯一性...`);
        const duplicateResponse = await fetch(`${baseUrl}/api/categories`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: testCase.name,
            description: `重复名称测试 - ${testCase.name}`,
          }),
        });

        const duplicateResult = await duplicateResponse.json();
        if (duplicateResult.success) {
          const duplicateCode = duplicateResult.data.code;
          console.log(`   📝 重复分类编码: "${duplicateCode}"`);
          console.log(
            `   🔍 编码唯一性检查: ${generatedCode !== duplicateCode ? '✅ 通过' : '❌ 失败'}`
          );
          createdCategoryIds.push(duplicateResult.data.id);
        } else {
          console.log(`   ❌ 创建重复分类失败: ${duplicateResult.error}`);
        }
      } else {
        console.log(`   ❌ 创建失败: ${createResult.error}`);
      }

      console.log(''); // 空行分隔
    }

    // 清理测试数据
    console.log('🧹 清理测试数据...');
    for (const categoryId of createdCategoryIds) {
      try {
        const deleteResponse = await fetch(
          `${baseUrl}/api/categories/${categoryId}`,
          {
            method: 'DELETE',
          }
        );
        const deleteResult = await deleteResponse.json();
        if (deleteResult.success) {
          console.log(`   ✅ 删除分类成功: ${categoryId}`);
        } else {
          console.log(
            `   ❌ 删除分类失败: ${categoryId} - ${deleteResult.error}`
          );
        }
      } catch (error) {
        console.log(`   ❌ 删除分类异常: ${categoryId} - ${error}`);
      }
    }

    console.log('\n🎉 分类编码自动生成功能测试完成！');
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);

    // 尝试清理已创建的分类
    if (createdCategoryIds.length > 0) {
      console.log('🧹 尝试清理已创建的测试数据...');
      for (const categoryId of createdCategoryIds) {
        try {
          await fetch(`${baseUrl}/api/categories/${categoryId}`, {
            method: 'DELETE',
          });
        } catch (cleanupError) {
          console.log(`   清理失败: ${categoryId}`);
        }
      }
    }
  }
}

// 运行测试
testAutoCodeGeneration();
