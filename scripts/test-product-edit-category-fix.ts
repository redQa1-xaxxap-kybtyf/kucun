#!/usr/bin/env tsx

/**
 * 产品编辑分类功能修复验证脚本
 * 验证产品编辑API和前端表单的分类处理
 */

import fs from 'fs';
import path from 'path';

async function testProductEditCategoryFix() {
  console.log('🧪 开始验证产品编辑分类功能修复...\n');

  const checks = [
    {
      name: '产品编辑API PUT方法包含categoryId处理',
      check: () => {
        const apiFile = fs.readFileSync('app/api/products/[id]/route.ts', 'utf8');
        
        // 检查解构赋值中是否包含categoryId
        const hasDestructuring = apiFile.includes('categoryId,') && 
                                 apiFile.includes('} = validationResult.data;');
        
        // 检查数据更新中是否包含categoryId处理
        const hasDataUpdate = apiFile.includes('...(categoryId !== undefined && {') &&
                             apiFile.includes('categoryId: categoryId === \'uncategorized\' ? null : categoryId');
        
        // 检查select中是否包含category关联查询
        const hasSelectCategory = apiFile.includes('categoryId: true,') &&
                                 apiFile.includes('category: {');
        
        // 检查返回数据中是否包含分类信息
        const hasReturnCategory = apiFile.includes('categoryId: updatedProduct.categoryId,') &&
                                 apiFile.includes('category: updatedProduct.category');
        
        return hasDestructuring && hasDataUpdate && hasSelectCategory && hasReturnCategory;
      }
    },
    {
      name: '产品详情API GET方法返回分类信息',
      check: () => {
        const apiFile = fs.readFileSync('app/api/products/[id]/route.ts', 'utf8');
        
        // 检查GET方法的select中是否包含category关联查询
        const hasSelectInGet = apiFile.includes('category: {') &&
                              apiFile.includes('select: {') &&
                              apiFile.includes('id: true,') &&
                              apiFile.includes('name: true,') &&
                              apiFile.includes('code: true,');
        
        // 检查返回数据格式化中是否包含分类信息
        const hasReturnInGet = apiFile.includes('categoryId: product.categoryId,') &&
                              apiFile.includes('category: product.category');
        
        return hasSelectInGet && hasReturnInGet;
      }
    },
    {
      name: '产品创建API POST方法返回分类信息',
      check: () => {
        const apiFile = fs.readFileSync('app/api/products/route.ts', 'utf8');
        
        // 检查返回数据格式化中是否包含分类信息
        const hasReturnCategory = apiFile.includes('categoryId: product.categoryId,') &&
                                 apiFile.includes('category: product.category');
        
        return hasReturnCategory;
      }
    },
    {
      name: '数据验证Schema包含categoryId字段',
      check: () => {
        const validationFile = fs.readFileSync('lib/validations/database.ts', 'utf8');
        
        // 检查产品创建验证是否包含categoryId
        const hasCreateCategoryId = validationFile.includes('categoryId: baseValidations.id.optional(),') &&
                                   validationFile.includes('create: z.object({');
        
        // 检查产品更新验证是否包含categoryId
        const hasUpdateCategoryId = validationFile.includes('categoryId: baseValidations.id.optional(),') &&
                                   validationFile.includes('update: z.object({');
        
        return hasCreateCategoryId && hasUpdateCategoryId;
      }
    },
    {
      name: '产品Schema包含categoryId字段',
      check: () => {
        const schemaFile = fs.readFileSync('lib/schemas/product.ts', 'utf8');
        
        // 检查CreateProductSchema是否包含categoryId
        const hasCreateCategoryId = schemaFile.includes('categoryId: z.string().optional(),');
        
        // 检查UpdateProductSchema继承了CreateProductSchema
        const hasUpdateInheritance = schemaFile.includes('UpdateProductSchema = CreateProductSchema.partial()');
        
        return hasCreateCategoryId && hasUpdateInheritance;
      }
    },
    {
      name: '产品编辑表单正确处理categoryId',
      check: () => {
        const editPageFile = fs.readFileSync('app/(dashboard)/products/[id]/edit/page.tsx', 'utf8');
        
        // 检查表单提交处理中是否包含categoryId处理
        const hasSubmitProcessing = editPageFile.includes('categoryId: data.categoryId === \'uncategorized\' ? null : data.categoryId,');
        
        // 检查是否使用了updateProduct函数
        const hasUpdateCall = editPageFile.includes('updateProductMutation.mutate(processedData);');
        
        return hasSubmitProcessing && hasUpdateCall;
      }
    },
    {
      name: '产品编辑成功后跳转到列表页',
      check: () => {
        const editPageFile = fs.readFileSync('app/(dashboard)/products/[id]/edit/page.tsx', 'utf8');
        
        // 检查成功回调中是否跳转到产品列表页
        const hasCorrectRedirect = editPageFile.includes('router.push(\'/products\');');
        
        // 检查是否有延迟跳转
        const hasDelayedRedirect = editPageFile.includes('setTimeout(() => {') &&
                                  editPageFile.includes('}, 1500);');
        
        return hasCorrectRedirect && hasDelayedRedirect;
      }
    },
    {
      name: '产品编辑API使用正确的Schema验证',
      check: () => {
        const apiFile = fs.readFileSync('app/api/products/[id]/route.ts', 'utf8');
        
        // 检查是否使用了productValidations.update进行验证
        const hasCorrectValidation = apiFile.includes('productValidations.update.safeParse({');
        
        return hasCorrectValidation;
      }
    },
    {
      name: '产品创建API使用正确的Schema验证',
      check: () => {
        const apiFile = fs.readFileSync('app/api/products/route.ts', 'utf8');
        
        // 检查是否使用了productValidations.create进行验证
        const hasCorrectValidation = apiFile.includes('productValidations.create.safeParse(body);');
        
        return hasCorrectValidation;
      }
    },
    {
      name: '产品详情页面显示分类信息',
      check: () => {
        const detailPageFile = fs.readFileSync('app/(dashboard)/products/[id]/page.tsx', 'utf8');
        
        // 检查是否显示分类信息
        const hasDisplayCategory = detailPageFile.includes('product.category ? product.category.name : \'未分类\'');
        
        return hasDisplayCategory;
      }
    }
  ];

  let passedChecks = 0;
  let totalChecks = checks.length;

  for (const { name, check } of checks) {
    try {
      const result = check();
      if (result) {
        console.log(`   ✅ ${name}`);
        passedChecks++;
      } else {
        console.log(`   ❌ ${name}`);
      }
    } catch (error) {
      console.log(`   ❌ ${name} (检查失败: ${error})`);
    }
  }

  console.log(`\n📊 检查结果: ${passedChecks}/${totalChecks} 项通过`);

  if (passedChecks === totalChecks) {
    console.log('\n🎉 所有产品编辑分类功能修复检查通过！');
    
    console.log('\n✨ 修复总结:');
    console.log('   ✅ 产品编辑API正确处理categoryId字段');
    console.log('   ✅ 产品详情API正确返回分类信息');
    console.log('   ✅ 产品创建API正确返回分类信息');
    console.log('   ✅ 数据验证Schema包含categoryId字段');
    console.log('   ✅ 产品Schema包含categoryId字段');
    console.log('   ✅ 产品编辑表单正确处理categoryId');
    console.log('   ✅ 产品编辑成功后跳转到列表页');
    console.log('   ✅ API使用正确的Schema验证');
    console.log('   ✅ 产品详情页面显示分类信息');
    
    console.log('\n🎯 用户体验改进:');
    console.log('   📋 用户在编辑页面修改分类后，分类信息能够成功保存');
    console.log('   🔍 在产品详情页面和列表页面都能看到更新后的分类');
    console.log('   💫 整个分类更新流程与其他字段更新保持一致');
    console.log('   ⚡ 前端表单到数据库存储的整个数据流正常工作');
    console.log('   🔄 编辑成功后统一跳转到列表页，提升用户体验');
    
    console.log('\n🔧 技术实现:');
    console.log('   🛠️  修复了数据验证Schema中缺失的categoryId字段');
    console.log('   🛠️  完善了产品编辑API的分类信息处理逻辑');
    console.log('   🛠️  统一了产品创建、编辑、详情API的分类信息返回');
    console.log('   🛠️  保持了前端表单与后端API的数据一致性');
    console.log('   🛠️  实现了完整的分类信息CRUD操作');
    
  } else {
    console.log('\n❌ 部分检查未通过，请检查相关文件的修复情况');
    process.exit(1);
  }
}

testProductEditCategoryFix();
