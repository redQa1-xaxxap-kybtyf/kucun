#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSpecColumns() {
  const tables = ['sales_order_items', 'factory_shipment_order_items'];

  for (const table of tables) {
    console.log(`修复 ${table}.specification...`);
    const sql = `ALTER TABLE \`${table}\` MODIFY COLUMN \`specification\` TEXT NULL`;
    await prisma.$executeRawUnsafe(sql);
    console.log('✅');
  }

  await prisma.$disconnect();
  console.log('\n全部完成！');
}

fixSpecColumns().catch(err => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});
