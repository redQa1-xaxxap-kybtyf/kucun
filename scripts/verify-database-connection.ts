/**
 * 验证数据库连接和类型
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 验证数据库连接...\n');

  try {
    // 1. 获取数据库版本信息
    const versionResult = await prisma.$queryRaw<Array<{ version: string }>>`
      SELECT VERSION() as version
    `;
    console.log('✅ 数据库类型: MySQL');
    console.log(`✅ 数据库版本: ${versionResult[0].version}\n`);

    // 2. 获取当前数据库名
    const dbResult = await prisma.$queryRaw<Array<{ database: string }>>`
      SELECT DATABASE() as \`database\`
    `;
    console.log(`✅ 当前数据库: ${dbResult[0].database}\n`);

    // 3. 统计表数量
    const tablesResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `;
    console.log(`✅ 表数量: ${tablesResult[0].count}\n`);

    // 4. 列出所有表
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      ORDER BY table_name
    `;

    console.log('📋 数据库表列表:');
    tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.table_name}`);
    });

    console.log('\n✅ 数据库连接验证成功!');
    console.log('✅ 健康检查工具正在检查 MySQL 数据库!');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
