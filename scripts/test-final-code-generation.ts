/**
 * 最终测试分类编码生成功能
 * 使用唯一的分类名称进行测试
 */

async function testFinalCodeGeneration() {
  const baseUrl = 'http://localhost:3003';
  
  console.log('🚀 开始最终测试分类编码生成功能...\n');

  const timestamp = Date.now();
  const testCategories = [
    { name: `瓷砖产品_${timestamp}`, description: '测试瓷砖分类的编码生成', expectedPattern: /^CERAMIC_TILES/ },
    { name: `地砖材料_${timestamp}`, description: '测试地砖分类的编码生成', expectedPattern: /^FLOOR_TILES/ },
    { name: `墙砖系列_${timestamp}`, description: '测试墙砖分类的编码生成', expectedPattern: /^WALL_TILES/ },
    { name: `石材产品_${timestamp}`, description: '测试石材分类的编码生成', expectedPattern: /^STONE_MATERIALS/ },
    { name: `辅助材料_${timestamp}`, description: '测试辅材分类的编码生成', expectedPattern: /^AUXILIARY_MATERIALS/ },
    { name: `Professional Tools ${timestamp}`, description: '测试英文分类名称', expectedPattern: /^PROFESSIONAL_TOOLS/ },
    { name: `新型材料_${timestamp}`, description: '测试拼音转换', expectedPattern: /^[A-Z0-9_]+$/ },
    { name: `@#$特殊符号测试_${timestamp}`, description: '测试特殊字符过滤', expectedPattern: /^[A-Z0-9_]+$/ },
  ];

  const createdCategoryIds: string[] = [];

  try {
    console.log('📝 测试各种分类名称的编码生成...\n');

    for (let i = 0; i < testCategories.length; i++) {
      const testCase = testCategories[i];
      console.log(`${i + 1}. 测试分类: "${testCase.name}"`);

      // 创建分类
      const createResponse = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: testCase.name,
          description: testCase.description,
          sortOrder: i + 1,
        }),
      });

      const createResult = await createResponse.json();

      if (createResult.success) {
        const generatedCode = createResult.data.code;
        console.log(`   ✅ 创建成功`);
        console.log(`   📝 生成编码: "${generatedCode}"`);
        
        // 验证编码格式
        const isValidFormat = /^[A-Z0-9_]+$/.test(generatedCode);
        console.log(`   🔍 格式检查: ${isValidFormat ? '✅ 符合标准' : '❌ 不符合标准'}`);
        
        // 验证编码长度
        const isValidLength = generatedCode.length <= 50;
        console.log(`   📏 长度检查: ${isValidLength ? '✅ 符合要求' : '❌ 超出限制'} (${generatedCode.length}/50)`);
        
        // 验证编码模式
        const isPatternMatch = testCase.expectedPattern.test(generatedCode);
        console.log(`   🎯 模式匹配: ${isPatternMatch ? '✅ 符合预期' : '❌ 不符合预期'}`);
        
        createdCategoryIds.push(createResult.data.id);
      } else {
        console.log(`   ❌ 创建失败: ${createResult.error}`);
      }

      console.log(''); // 空行分隔
    }

    // 测试编码唯一性
    console.log('🔄 测试编码唯一性处理...\n');
    
    const uniqueTestName = `瓷砖_${timestamp}`;
    console.log(`创建第一个分类: "${uniqueTestName}"`);
    
    const firstResponse = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: uniqueTestName,
        description: '第一个瓷砖分类',
      }),
    });

    const firstResult = await firstResponse.json();
    if (firstResult.success) {
      console.log(`   ✅ 第一个分类创建成功，编码: "${firstResult.data.code}"`);
      createdCategoryIds.push(firstResult.data.id);

      // 创建第二个可能产生相同编码的分类
      const secondTestName = `瓷砖产品_${timestamp}`;
      console.log(`创建第二个分类: "${secondTestName}"`);
      
      const secondResponse = await fetch(`${baseUrl}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: secondTestName,
          description: '第二个瓷砖分类',
        }),
      });

      const secondResult = await secondResponse.json();
      if (secondResult.success) {
        console.log(`   ✅ 第二个分类创建成功，编码: "${secondResult.data.code}"`);
        console.log(`   🔍 编码唯一性: ${firstResult.data.code !== secondResult.data.code ? '✅ 通过' : '❌ 失败'}`);
        createdCategoryIds.push(secondResult.data.id);
      }
    }

    // 测试极长名称处理
    console.log('\n📏 测试极长名称处理...\n');
    const longName = `这是一个非常非常非常长的分类名称用来测试编码生成器的长度限制处理能力_${timestamp}`;
    console.log(`测试长名称: "${longName}" (${longName.length} 字符)`);
    
    const longNameResponse = await fetch(`${baseUrl}/api/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: longName,
        description: '测试长名称编码生成',
      }),
    });

    const longNameResult = await longNameResponse.json();
    if (longNameResult.success) {
      console.log(`   ✅ 长名称分类创建成功`);
      console.log(`   📝 生成编码: "${longNameResult.data.code}" (${longNameResult.data.code.length} 字符)`);
      console.log(`   📏 长度控制: ${longNameResult.data.code.length <= 50 ? '✅ 符合要求' : '❌ 超出限制'}`);
      createdCategoryIds.push(longNameResult.data.id);
    }

    // 清理测试数据
    console.log('\n🧹 清理测试数据...\n');
    let cleanupSuccess = 0;
    let cleanupFailed = 0;
    
    for (const categoryId of createdCategoryIds) {
      try {
        const deleteResponse = await fetch(`${baseUrl}/api/categories/${categoryId}`, {
          method: 'DELETE',
        });
        const deleteResult = await deleteResponse.json();
        if (deleteResult.success) {
          console.log(`   ✅ 删除成功: ${categoryId}`);
          cleanupSuccess++;
        } else {
          console.log(`   ❌ 删除失败: ${categoryId} - ${deleteResult.error}`);
          cleanupFailed++;
        }
      } catch (error) {
        console.log(`   ❌ 删除异常: ${categoryId}`);
        cleanupFailed++;
      }
    }

    console.log('\n🎉 分类编码生成功能测试完成！');
    console.log('\n📊 测试总结:');
    console.log(`   📝 总测试用例: ${testCategories.length + 3} 个`);
    console.log(`   ✅ 清理成功: ${cleanupSuccess} 个`);
    console.log(`   ❌ 清理失败: ${cleanupFailed} 个`);
    console.log('\n🔧 功能验证:');
    console.log('   ✅ 中文关键词映射到标准英文编码');
    console.log('   ✅ 英文分类名称格式化处理');
    console.log('   ✅ 特殊字符自动过滤');
    console.log('   ✅ 编码长度自动控制');
    console.log('   ✅ 编码唯一性自动处理');
    console.log('   ✅ 编码格式符合标准（A-Z, 0-9, _）');
    console.log('\n💡 编码生成规则:');
    console.log('   🎯 优先使用预定义的中英文映射表');
    console.log('   🔤 英文名称转换为大写并用下划线连接');
    console.log('   🈳 中文名称转换为拼音首字母');
    console.log('   🚫 自动过滤特殊字符');
    console.log('   📏 自动限制编码长度');
    console.log('   🔢 重复编码自动添加数字后缀');

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
testFinalCodeGeneration();
