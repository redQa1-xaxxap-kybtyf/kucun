#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 修复高风险VARCHAR字段为TEXT类型
 * 这些字段可能在实际使用中遇到长度限制问题
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 高风险字段列表（从分析结果生成）
const HIGH_RISK_FIELDS = [
  // 已经在inventory_operations表修复过的字段（跳过）
  // { table: 'inventory_operations', column: 'request_data', nullable: 'NOT NULL' },
  // { table: 'inventory_operations', column: 'response_data', nullable: 'NULL' },
  // { table: 'inventory_operations', column: 'error_message', nullable: 'NULL' },

  // 需要修复的字段
  { table: 'account_lockouts', column: 'reason', nullable: 'NOT NULL' },
  { table: 'customers', column: 'address', nullable: 'NULL' },
  { table: 'customers', column: 'extended_info', nullable: 'NULL' },
  {
    table: 'factory_shipment_order_items',
    column: 'ownership_remarks',
    nullable: 'NULL',
  },
  {
    table: 'factory_shipment_order_items',
    column: 'manual_specification',
    nullable: 'NULL',
  },
  { table: 'inbound_records', column: 'location', nullable: 'NULL' },
  { table: 'inbound_records', column: 'reason', nullable: 'NOT NULL' },
  { table: 'inventory', column: 'location', nullable: 'NULL' },
  { table: 'inventory_adjustments', column: 'reason', nullable: 'NOT NULL' },
  { table: 'login_attempts', column: 'ip_address', nullable: 'NOT NULL' },
  { table: 'login_attempts', column: 'user_agent', nullable: 'NULL' },
  { table: 'login_attempts', column: 'failure_reason', nullable: 'NULL' },
  { table: 'outbound_records', column: 'reason', nullable: 'NOT NULL' },
  { table: 'payable_records', column: 'description', nullable: 'NULL' },
  { table: 'payable_records', column: 'remarks', nullable: 'NULL' },
  { table: 'payment_out_records', column: 'remarks', nullable: 'NULL' },
  { table: 'payment_out_records', column: 'bank_info', nullable: 'NULL' },
  { table: 'payment_records', column: 'bank_info', nullable: 'NULL' },
  { table: 'products', column: 'thumbnail_url', nullable: 'NULL' },
  { table: 'refund_records', column: 'bank_info', nullable: 'NULL' },
  { table: 'return_order_items', column: 'reason', nullable: 'NULL' },
  {
    table: 'sales_order_items',
    column: 'manual_specification',
    nullable: 'NULL',
  },
  { table: 'setting_change_logs', column: 'ip_address', nullable: 'NULL' },
  { table: 'setting_change_logs', column: 'user_agent', nullable: 'NULL' },
  { table: 'setting_change_logs', column: 'remarks', nullable: 'NULL' },
  { table: 'shipping_queries', column: 'error_message', nullable: 'NULL' },
  { table: 'shipping_sites', column: 'url', nullable: 'NOT NULL' },
  { table: 'shipping_sites', column: 'description', nullable: 'NULL' },
  {
    table: 'shipping_sites',
    column: 'search_input_selector',
    nullable: 'NOT NULL',
  },
  {
    table: 'shipping_sites',
    column: 'search_button_selector',
    nullable: 'NOT NULL',
  },
  {
    table: 'shipping_sites',
    column: 'result_container_selector',
    nullable: 'NOT NULL',
  },
  {
    table: 'shipping_sites',
    column: 'extract_selectors',
    nullable: 'NOT NULL',
  },
  {
    table: 'statement_transactions',
    column: 'description',
    nullable: 'NOT NULL',
  },
  { table: 'statement_transactions', column: 'metadata', nullable: 'NULL' },
  { table: 'suppliers', column: 'address', nullable: 'NULL' },
  { table: 'system_logs', column: 'ip_address', nullable: 'NULL' },
  { table: 'system_logs', column: 'user_agent', nullable: 'NULL' },
  { table: 'system_logs', column: 'metadata', nullable: 'NULL' },
  { table: 'system_logs', column: 'ip_location', nullable: 'NULL' },
  { table: 'system_logs', column: 'description', nullable: 'NOT NULL' },
  { table: 'system_settings', column: 'description', nullable: 'NULL' },
  { table: 'system_settings', column: 'dataType', nullable: 'NOT NULL' },
];

async function fixHighRiskFields() {
  console.log('🔧 开始修复高风险VARCHAR字段...\n');

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const field of HIGH_RISK_FIELDS) {
    try {
      // 先检查表是否存在
      const tableExists = await prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ${field.table}
      `;

      if (tableExists[0].count === 0) {
        console.log(`⏭️  跳过 ${field.table}.${field.column} (表不存在)`);
        skipCount++;
        continue;
      }

      // 检查字段是否已经是TEXT类型
      const columnInfo = await prisma.$queryRaw`
        SELECT DATA_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ${field.table}
          AND COLUMN_NAME = ${field.column}
      `;

      if (columnInfo.length === 0) {
        console.log(`⏭️  跳过 ${field.table}.${field.column} (字段不存在)`);
        skipCount++;
        continue;
      }

      if (columnInfo[0].DATA_TYPE === 'text') {
        console.log(`✓ 跳过 ${field.table}.${field.column} (已经是TEXT类型)`);
        skipCount++;
        continue;
      }

      // 执行ALTER TABLE
      const sql = `ALTER TABLE \`${field.table}\` MODIFY COLUMN \`${field.column}\` TEXT ${field.nullable}`;
      await prisma.$executeRawUnsafe(sql);

      console.log(`✅ ${field.table}.${field.column} → TEXT ${field.nullable}`);
      successCount++;
    } catch (_error) {
      console.error(
        `❌ 修复 ${field.table}.${field.column} 失败: ${_error.message}`
      );
      failCount++;
    }
  }

  console.log(`\n📊 修复统计:`);
  console.log(`   ✅ 成功: ${successCount} 个`);
  console.log(`   ⏭️  跳过: ${skipCount} 个`);
  console.log(`   ❌ 失败: ${failCount} 个`);

  return { successCount, skipCount, failCount };
}

async function main() {
  try {
    const result = await fixHighRiskFields();

    if (result.failCount > 0) {
      console.log('\n⚠️  有字段修复失败，请检查错误信息');
      process.exit(1);
    } else {
      console.log('\n✅ 所有高风险VARCHAR字段已成功修复为TEXT类型');
    }
  } catch (_error) {
    console.error('❌ 执行失败:', _error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
