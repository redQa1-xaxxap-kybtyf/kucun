#!/usr/bin/env tsx

/**
 * Toast导入修复验证脚本
 * 检查所有文件是否正确使用useToast hook而不是sonner toast
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: string;
}

async function testToastImportFixes() {
  console.log('🧪 开始测试Toast导入修复...\n');

  const results: TestResult[] = [];

  // 需要检查的文件列表
  const filesToCheck = [
    'app/(dashboard)/products/create/page.tsx',
    'app/(dashboard)/products/[id]/edit/page.tsx',
    'app/(dashboard)/customers/create/page.tsx',
    'app/(dashboard)/sales-orders/create/page.tsx',
    'app/(dashboard)/categories/create/page.tsx',
  ];

  try {
    for (const filePath of filesToCheck) {
      const fullPath = join(process.cwd(), filePath);
      
      if (!existsSync(fullPath)) {
        results.push({
          name: `文件存在性检查 - ${filePath}`,
          success: false,
          message: '文件不存在',
        });
        continue;
      }

      const content = readFileSync(fullPath, 'utf8');

      // 检查1：是否还有sonner导入
      const hasSonnerImport = content.includes("import { toast } from 'sonner'");
      results.push({
        name: `Sonner导入检查 - ${filePath}`,
        success: !hasSonnerImport,
        message: hasSonnerImport ? '仍使用sonner导入' : '已移除sonner导入',
        details: hasSonnerImport ? '发现: import { toast } from \'sonner\'' : undefined,
      });

      // 检查2：是否有useToast导入
      const hasUseToastImport = content.includes("import { useToast } from '@/hooks/use-toast'");
      results.push({
        name: `useToast导入检查 - ${filePath}`,
        success: hasUseToastImport,
        message: hasUseToastImport ? '正确导入useToast' : '缺少useToast导入',
        details: hasUseToastImport ? '发现: import { useToast } from \'@/hooks/use-toast\'' : undefined,
      });

      // 检查3：是否有useToast hook调用
      const hasUseToastCall = content.includes('const { toast } = useToast()');
      results.push({
        name: `useToast调用检查 - ${filePath}`,
        success: hasUseToastCall,
        message: hasUseToastCall ? '正确调用useToast hook' : '缺少useToast hook调用',
        details: hasUseToastCall ? '发现: const { toast } = useToast()' : undefined,
      });

      // 检查4：toast使用格式是否正确
      const hasCorrectToastUsage = content.includes('toast({') && 
                                   (content.includes('variant: \'success\'') || 
                                    content.includes('variant: \'destructive\''));
      results.push({
        name: `Toast使用格式检查 - ${filePath}`,
        success: hasCorrectToastUsage,
        message: hasCorrectToastUsage ? '使用正确的toast格式' : 'toast格式可能不正确',
        details: hasCorrectToastUsage ? '发现正确的toast({ variant: ... })格式' : undefined,
      });

      // 检查5：是否有错误的toast调用（如toast.success, toast.error）
      const hasIncorrectToastCalls = content.includes('toast.success') || 
                                     content.includes('toast.error') ||
                                     content.includes('toast.info');
      results.push({
        name: `错误Toast调用检查 - ${filePath}`,
        success: !hasIncorrectToastCalls,
        message: hasIncorrectToastCalls ? '发现错误的toast调用' : '无错误的toast调用',
        details: hasIncorrectToastCalls ? '发现: toast.success/error/info等调用' : undefined,
      });
    }

    // 检查useToast hook文件是否存在
    const useToastPath = join(process.cwd(), 'hooks/use-toast.ts');
    const useToastExists = existsSync(useToastPath);
    results.push({
      name: 'useToast Hook文件检查',
      success: useToastExists,
      message: useToastExists ? 'useToast hook文件存在' : 'useToast hook文件不存在',
    });

    if (useToastExists) {
      const useToastContent = readFileSync(useToastPath, 'utf8');
      const exportsUseToast = useToastContent.includes('export { useToast, toast }');
      results.push({
        name: 'useToast导出检查',
        success: exportsUseToast,
        message: exportsUseToast ? 'useToast正确导出' : 'useToast导出可能有问题',
      });
    }

    // 检查Toaster组件配置
    const layoutPath = join(process.cwd(), 'app/layout.tsx');
    if (existsSync(layoutPath)) {
      const layoutContent = readFileSync(layoutPath, 'utf8');
      const hasToasterImport = layoutContent.includes("import { Toaster } from '@/components/ui/toaster'");
      const hasToasterComponent = layoutContent.includes('<Toaster />');
      
      results.push({
        name: 'Toaster组件导入检查',
        success: hasToasterImport,
        message: hasToasterImport ? 'Toaster组件正确导入' : 'Toaster组件导入缺失',
      });

      results.push({
        name: 'Toaster组件使用检查',
        success: hasToasterComponent,
        message: hasToasterComponent ? 'Toaster组件正确使用' : 'Toaster组件使用缺失',
      });
    }

    // 输出结果
    console.log('📊 测试结果汇总:\n');
    
    let successCount = 0;
    let totalCount = results.length;

    results.forEach(result => {
      const icon = result.success ? '✅' : '❌';
      console.log(`${icon} ${result.name}: ${result.message}`);
      if (result.details) {
        console.log(`   📝 ${result.details}`);
      }
      if (result.success) successCount++;
    });

    console.log(`\n📈 总体结果: ${successCount}/${totalCount} 项检查通过`);

    if (successCount === totalCount) {
      console.log('\n🎉 所有Toast导入修复检查通过！');
      console.log('\n✨ 修复总结:');
      console.log('   ✅ 所有文件已移除sonner导入');
      console.log('   ✅ 所有文件已正确导入useToast');
      console.log('   ✅ 所有文件已正确调用useToast hook');
      console.log('   ✅ 所有toast使用格式正确');
      console.log('   ✅ 无错误的toast调用方式');
      console.log('   ✅ Toaster组件配置正确');
    } else {
      console.log('\n⚠️  部分检查未通过，请查看上述详情进行修复。');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testToastImportFixes();
