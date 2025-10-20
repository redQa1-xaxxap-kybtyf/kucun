#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 分析有索引的字段，决定是否需要保留索引
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const INDEXED_FIELDS = [
  {
    table: 'inbound_records',
    column: 'reason',
    indexes: ['idx_inbound_records_reason', 'idx_inbound_records_reason_date'],
    purpose: '入库原因过滤查询',
    recommendation: 'KEEP_VARCHAR',
    analysis:
      'reason是枚举值(purchase/return/transfer/surplus/other)，长度固定，建议保持VARCHAR并扩展到255',
  },
  {
    table: 'inventory',
    column: 'location',
    indexes: ['idx_inventory_location'],
    purpose: '按存储位置查询库存',
    recommendation: 'CONSIDER_DROP_INDEX',
    analysis:
      'location字段可能需要存储详细位置信息。如果不经常作为精确查询条件，可以删除索引改为TEXT',
  },
  {
    table: 'inventory_adjustments',
    column: 'reason',
    indexes: ['idx_inventory_adjustments_reason'],
    purpose: '按调整原因过滤',
    recommendation: 'KEEP_VARCHAR',
    analysis: 'reason是枚举值，建议保持VARCHAR(255)',
  },
  {
    table: 'login_attempts',
    column: 'ip_address',
    indexes: ['idx_login_attempts_ip'],
    purpose: '按IP地址查询登录记录（安全审计）',
    recommendation: 'KEEP_VARCHAR',
    analysis: 'IP地址固定格式，最长45字符(IPv6)，建议保持VARCHAR(45)',
  },
  {
    table: 'outbound_records',
    column: 'reason',
    indexes: [
      'idx_outbound_records_reason',
      'idx_outbound_records_order_reason',
      'idx_outbound_records_reason_date',
    ],
    purpose: '出库原因过滤查询（多个复合索引）',
    recommendation: 'KEEP_VARCHAR',
    analysis:
      'reason是枚举值，大量索引表明这是高频查询字段，建议保持VARCHAR(255)',
  },
];

async function checkFieldUsage() {
  console.log('📊 分析有索引字段的实际使用情况\n');
  console.log(`${'═'.repeat(80)}\n`);

  for (const field of INDEXED_FIELDS) {
    console.log(`🔍 ${field.table}.${field.column}`);
    console.log(`   用途: ${field.purpose}`);
    console.log(`   索引: ${field.indexes.join(', ')}`);
    console.log(`   分析: ${field.analysis}`);

    // 检查实际数据长度
    try {
      const stats = await prisma.$queryRawUnsafe(`
        SELECT
          MAX(LENGTH(\`${field.column}\`)) as max_length,
          AVG(LENGTH(\`${field.column}\`)) as avg_length,
          COUNT(DISTINCT \`${field.column}\`) as distinct_count,
          COUNT(*) as total_count
        FROM \`${field.table}\`
        WHERE \`${field.column}\` IS NOT NULL
      `);

      if (stats[0].total_count > 0) {
        console.log(`   数据统计:`);
        console.log(`      - 最大长度: ${stats[0].max_length} 字符`);
        console.log(
          `      - 平均长度: ${Math.round(stats[0].avg_length)} 字符`
        );
        console.log(`      - 不同值数量: ${stats[0].distinct_count} 个`);
        console.log(`      - 总记录数: ${stats[0].total_count} 条`);

        // 基于distinct_count判断是否是枚举类型
        const cardinalityRatio = stats[0].distinct_count / stats[0].total_count;
        if (cardinalityRatio < 0.1) {
          console.log(`      - ✓ 低基数字段（枚举类型），适合使用VARCHAR+索引`);
        } else {
          console.log(`      - ⚠️ 高基数字段，索引效果可能不佳`);
        }
      }
    } catch (_error) {
      console.log(`   数据统计: 无法获取（表可能为空）`);
    }

    console.log(`   建议: ${field.recommendation}`);
    console.log(`\n${'─'.repeat(80)}\n`);
  }
}

async function generateRecommendation() {
  console.log('💡 修复建议\n');
  console.log(`${'═'.repeat(80)}\n`);

  console.log('方案一：保守方案（推荐）\n');
  console.log('对于reason字段（枚举类型）：');
  console.log('  - 保持VARCHAR，但扩展长度到255字符');
  console.log('  - 保留索引以支持高效查询');
  console.log('  - reason字段通常是固定的枚举值，不会超长\n');

  console.log('SQL脚本:');
  console.log('```sql');
  console.log('-- 扩展reason字段长度');
  console.log(
    'ALTER TABLE `inbound_records` MODIFY COLUMN `reason` VARCHAR(255) NOT NULL;'
  );
  console.log(
    'ALTER TABLE `inventory_adjustments` MODIFY COLUMN `reason` VARCHAR(255) NOT NULL;'
  );
  console.log(
    'ALTER TABLE `outbound_records` MODIFY COLUMN `reason` VARCHAR(255) NOT NULL;'
  );
  console.log('');
  console.log('-- 调整IP地址字段');
  console.log(
    'ALTER TABLE `login_attempts` MODIFY COLUMN `ip_address` VARCHAR(45) NOT NULL; -- IPv6最大长度'
  );
  console.log('```\n');

  console.log(`${'─'.repeat(80)}\n`);
  console.log('方案二：激进方案（如果确定不需要索引）\n');
  console.log('删除索引，改为TEXT类型：\n');

  console.log('SQL脚本:');
  console.log('```sql');
  console.log('-- 删除索引');
  console.log('DROP INDEX idx_inbound_records_reason ON inbound_records;');
  console.log('DROP INDEX idx_inbound_records_reason_date ON inbound_records;');
  console.log('DROP INDEX idx_inventory_location ON inventory;');
  console.log(
    'DROP INDEX idx_inventory_adjustments_reason ON inventory_adjustments;'
  );
  console.log('DROP INDEX idx_login_attempts_ip ON login_attempts;');
  console.log('DROP INDEX idx_outbound_records_reason ON outbound_records;');
  console.log(
    'DROP INDEX idx_outbound_records_order_reason ON outbound_records;'
  );
  console.log(
    'DROP INDEX idx_outbound_records_reason_date ON outbound_records;'
  );
  console.log('');
  console.log('-- 改为TEXT');
  console.log(
    'ALTER TABLE `inbound_records` MODIFY COLUMN `reason` TEXT NOT NULL;'
  );
  console.log('ALTER TABLE `inventory` MODIFY COLUMN `location` TEXT NULL;');
  console.log(
    'ALTER TABLE `inventory_adjustments` MODIFY COLUMN `reason` TEXT NOT NULL;'
  );
  console.log(
    'ALTER TABLE `login_attempts` MODIFY COLUMN `ip_address` TEXT NOT NULL;'
  );
  console.log(
    'ALTER TABLE `outbound_records` MODIFY COLUMN `reason` TEXT NOT NULL;'
  );
  console.log('```\n');

  console.log('⚠️ 警告: 删除索引会影响查询性能！请评估实际查询需求。\n');
}

async function main() {
  try {
    await checkFieldUsage();
    await generateRecommendation();
  } catch (_error) {
    console.error('❌ 分析失败:', _error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
