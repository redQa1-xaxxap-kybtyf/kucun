#!/usr/bin/env node
/**
 * 修复数据库中所有应该使用TEXT类型的VARCHAR字段
 * 解决SQLite到MySQL迁移时的字段长度限制问题
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const sql = `
  ALTER TABLE sales_order_items
    MODIFY COLUMN specification TEXT NULL,
    MODIFY COLUMN remarks TEXT NULL;

  ALTER TABLE inbound_records
    MODIFY COLUMN remarks TEXT NULL;

  ALTER TABLE outbound_records
    MODIFY COLUMN notes TEXT NULL;

  ALTER TABLE inventory_adjustments
    MODIFY COLUMN notes TEXT NULL;

  ALTER TABLE payment_records
    MODIFY COLUMN remarks TEXT NULL;

  ALTER TABLE factory_shipment_orders
    MODIFY COLUMN remarks TEXT NULL;

  ALTER TABLE factory_shipment_order_items
    MODIFY COLUMN specification TEXT NULL,
    MODIFY COLUMN remarks TEXT NULL;

  ALTER TABLE return_orders
    MODIFY COLUMN reason TEXT NULL,
    MODIFY COLUMN remarks TEXT NULL;

  ALTER TABLE refund_records
    MODIFY COLUMN reason TEXT NOT NULL,
    MODIFY COLUMN remarks TEXT NULL;

  ALTER TABLE categories
    MODIFY COLUMN description TEXT NULL;

  ALTER TABLE products
    MODIFY COLUMN images TEXT NULL,
    MODIFY COLUMN description TEXT NULL;

  ALTER TABLE sales_orders
    MODIFY COLUMN remarks TEXT NULL;

  ALTER TABLE sales_order_fee_items
    MODIFY COLUMN remarks TEXT NULL;
`;

async function fixTextFields() {
  try {
    console.log('连接数据库...');

    // 分批执行SQL语句
    const queries = sql.split(';').filter(q => q.trim());

    console.log(`执行 ${queries.length} 个ALTER TABLE语句...`);

    for (const query of queries) {
      if (query.trim()) {
        console.log(`执行: ${query.trim().split('\n')[0]}...`);
        await prisma.$executeRawUnsafe(query.trim());
      }
    }

    console.log('✅ 所有字段已成功修改为TEXT类型');
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixTextFields();
