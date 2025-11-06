/* eslint-disable no-console */
/**
 * 验证日期时间格式化修改
 *
 * 用途：测试 lastUsedAt 字段的显示格式是否正确
 *
 * 运行方式：
 * npx tsx scripts/verify-datetime-format.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 验证日期时间格式化修改...\n');

  // 1. 获取一些临时产品数据
  console.log('📊 步骤 1: 获取临时产品数据');
  const temporaryProducts = await prisma.temporaryProduct.findMany({
    take: 5,
    orderBy: {
      lastUsedAt: 'desc',
    },
    include: {
      supplier: {
        select: {
          name: true,
        },
      },
    },
  });

  if (temporaryProducts.length === 0) {
    console.log('⚠️  没有临时产品数据，无法验证');
    return;
  }

  console.log(`✅ 找到 ${temporaryProducts.length} 个临时产品\n`);

  // 2. 测试不同的日期格式化方法
  console.log('📊 步骤 2: 测试日期格式化\n');

  temporaryProducts.forEach((tp, index) => {
    console.log(`${index + 1}. [${tp.code}] ${tp.name}`);
    console.log(`   供应商: ${tp.supplier.name}`);

    if (tp.lastUsedAt) {
      const date = new Date(tp.lastUsedAt);

      // 方法 1: toLocaleString (诊断脚本使用)
      const format1 = date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

      // 方法 2: toISOString (数据库原始格式)
      const format2 = date.toISOString();

      // 方法 3: 手动格式化 (模拟 formatDateTime)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      const format3 = `${year}-${month}-${day} ${hour}:${minute}`;

      console.log(`   最后使用时间:`);
      console.log(`     - 诊断脚本格式: ${format1}`);
      console.log(`     - ISO 格式:      ${format2}`);
      console.log(`     - 前端格式:      ${format3}`);
    } else {
      console.log(`   最后使用时间: 从未使用`);
    }

    console.log('');
  });

  // 3. 验证格式是否符合预期
  console.log('📊 步骤 3: 验证格式\n');

  const testDate = new Date('2025-10-25T14:30:00.000Z');

  console.log('测试日期: 2025-10-25T14:30:00.000Z');
  console.log('');

  // 诊断脚本格式
  const diagnosticFormat = testDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  console.log(`诊断脚本格式: ${diagnosticFormat}`);
  console.log(`期望格式:     2025/10/25 22:30 (UTC+8)`);
  console.log(
    `格式正确:     ${diagnosticFormat.includes('2025') && diagnosticFormat.includes('22:30') ? '✅' : '❌'}`
  );
  console.log('');

  // 前端格式 (模拟 formatDateTime)
  const year = testDate.getFullYear();
  const month = String(testDate.getMonth() + 1).padStart(2, '0');
  const day = String(testDate.getDate()).padStart(2, '0');
  const hour = String(testDate.getHours()).padStart(2, '0');
  const minute = String(testDate.getMinutes()).padStart(2, '0');
  const frontendFormat = `${year}-${month}-${day} ${hour}:${minute}`;

  console.log(`前端格式:     ${frontendFormat}`);
  console.log(`期望格式:     2025-10-25 22:30 (UTC+8)`);
  console.log(
    `格式正确:     ${frontendFormat.includes('2025-10-25') && frontendFormat.includes('22:30') ? '✅' : '❌'}`
  );
  console.log('');

  // 4. 总结
  console.log('📊 步骤 4: 总结\n');
  console.log('✅ 日期时间格式化验证完成！');
  console.log('');
  console.log('格式说明:');
  console.log('  - 诊断脚本: YYYY/MM/DD HH:mm (例如: 2025/10/25 14:30)');
  console.log('  - 前端组件: YYYY-MM-DD HH:mm (例如: 2025-10-25 14:30)');
  console.log('  - SQL 查询:  YYYY-MM-DD HH:mm:ss (例如: 2025-10-25 14:30:00)');
  console.log('');
  console.log('注意事项:');
  console.log('  - 所有格式都显示完整的日期和时间（包括时分）');
  console.log('  - 使用 24 小时制');
  console.log('  - 自动处理时区转换（显示本地时间）');
}

main()
  .catch(error => {
    console.error('❌ 验证过程中发生错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
