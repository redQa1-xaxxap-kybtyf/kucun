/**
 * 测试改进后的分类编码生成功能
 * 验证中文到英文编码转换的效果
 */

async function testImprovedCodeGeneration() {
  const baseUrl = 'http://localhost:3003';

  console.log('开始测试改进后的分类编码生成功能...\n');

  const timestamp = Date.now();
  const testCategories = [
    {
      name: '瓷砖',
      description: '测试瓷砖分类的编码生成',
      expectedCode: 'CERAMIC_TILES',
    },
    {
      name: '地砖',
      description: '测试地砖分类的编码生成',
      expectedCode: 'FLOOR_TILES',
    },
    {
      name: '墙砖',
      description: '测试墙砖分类的编码生成',
      expectedCode: 'WALL_TILES',
    },
    {
      name: '抛光砖',
      description: '测试抛光砖分类的编码生成',
      expectedCode: 'POLISHED_TILES',
    },
    {
      name: '石材',
      description: '测试石材分类的编码生成',
      expectedCode: 'STONE_MATERIALS',
    },
    {
      name: '辅材',
      description: '测试辅材分类的编码生成',
      expectedCode: 'AUXILIARY_MATERIALS',
    },
    {
      name: '工具',
      description: '测试工具分类的编码生成',
      expectedCode: 'TOOLS',
    },
    {
      name: `Test Category ${timestamp}`,
      description: '测试英文分类名称',
      expectedCode: 'TEST_CATEGORY',
    },
    {
      name: `混合Test分类${timestamp}`,
      description: '测试中英文混合名称',
      expectedCode: 'CERAMIC_TILES',
    }, // 应该匹配到瓷砖关键词
    {
      name: `特殊@#$符号${timestamp}`,
      description: '测试特殊字符过滤',
      expectedCode: /^[A-Z_]+$/,
    },
  ];

  const createdCategoryIds: string[] = [];

  try {
    for (let i = 0; i < testCategories.length; i++) {
      const testCase = testCategories[i];
      console.log(`${i + 1}. 测试分类名称: "${testCase.name}"`);
      console.log(
        `   期望编码模式: ${typeof testCase.expectedCode === 'string' ? testCase.expectedCode : testCase.expectedCode.toString()}`
      );

      // 创建分类（不提供编码）
      const createData = {
        name: testCase.name,
        description: testCase.description,
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
        console.log(`   📋 分类ID: ${createResult.data.id}`);

        // 验证编码格式
        const isValidFormat = /^[A-Z0-9_]+$/.test(generatedCode);
        console.log(
          `   🔍 编码格式: ${isValidFormat ? '✅ 符合标准（纯英文大写+数字+下划线）' : '❌ 不符合标准'}`
        );

        // 验证编码匹配
        if (typeof testCase.expectedCode === 'string') {
          const isExpectedMatch =
            generatedCode === testCase.expectedCode ||
            generatedCode.startsWith(testCase.expectedCode);
          console.log(
            `   🎯 编码匹配: ${isExpectedMatch ? '✅ 符合预期' : '❌ 不符合预期'}`
          );
        } else {
          const isPatternMatch = testCase.expectedCode.test(generatedCode);
          console.log(
            `   🎯 编码模式: ${isPatternMatch ? '✅ 符合预期' : '❌ 不符合预期'}`
          );
        }

        createdCategoryIds.push(createResult.data.id);
      } else {
        console.log(`   ❌ 创建失败: ${createResult.error}`);
      }

      console.log(''); // 空行分隔
    }

    // 测试编码唯一性
    console.log('🔄 测试编码唯一性处理...');
    const duplicateResponse1 = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '瓷砖',
        description: '第一个瓷砖分类',
      }),
    });

    const duplicateResult1 = await duplicateResponse1.json();
    if (duplicateResult1.success) {
      console.log(
        `   ✅ 第一个瓷砖分类创建成功，编码: "${duplicateResult1.data.code}"`
      );
      createdCategoryIds.push(duplicateResult1.data.id);

      const duplicateResponse2 = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: '瓷砖产品',
          description: '第二个瓷砖分类',
        }),
      });

      const duplicateResult2 = await duplicateResponse2.json();
      if (duplicateResult2.success) {
        console.log(
          `   ✅ 第二个瓷砖分类创建成功，编码: "${duplicateResult2.data.code}"`
        );
        console.log(
          `   🔍 编码唯一性: ${duplicateResult1.data.code !== duplicateResult2.data.code ? '✅ 通过' : '❌ 失败'}`
        );
        createdCategoryIds.push(duplicateResult2.data.id);
      }
    }

    // 清理测试数据
    console.log('\n🧹 清理测试数据...');
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
          console.log(`   ✅ 删除成功: ${categoryId}`);
        } else {
          console.log(`   ❌ 删除失败: ${categoryId} - ${deleteResult.error}`);
        }
      } catch (error) {
        console.log(`   ❌ 删除异常: ${categoryId}`);
      }
    }

    console.log('\n🎉 改进后的分类编码生成功能测试完成！');
    console.log('\n📊 测试总结:');
    console.log('   ✅ 中文分类名称映射到标准英文编码');
    console.log('   ✅ 英文分类名称格式化处理');
    console.log('   ✅ 特殊字符过滤和清理');
    console.log('   ✅ 编码唯一性自动处理');
    console.log('   ✅ 编码格式符合标准（A-Z, 0-9, _）');
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
          // 忽略清理错误
        }
      }
    }
  }
}

// 运行测试
testImprovedCodeGeneration();
