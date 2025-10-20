#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 分析VARCHAR字段长度风险
 * 识别哪些字段可能在实际使用中遇到长度限制问题
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 高风险字段：这些字段可能会存储较长内容
const HIGH_RISK_PATTERNS = [
  { pattern: /address/i, reason: '地址可能很长，特别是详细地址' },
  { pattern: /description/i, reason: '描述字段通常需要较长文本' },
  { pattern: /remarks?/i, reason: '备注字段用户可能输入大量文本' },
  { pattern: /notes?/i, reason: '笔记字段可能包含详细信息' },
  { pattern: /reason/i, reason: '原因说明可能需要详细解释' },
  { pattern: /message/i, reason: '消息内容可能较长' },
  { pattern: /content/i, reason: '内容字段通常较长' },
  { pattern: /specification/i, reason: '规格说明可能很详细' },
  { pattern: /info/i, reason: '信息字段可能包含JSON或长文本' },
  { pattern: /data/i, reason: '数据字段可能存储JSON' },
  { pattern: /metadata/i, reason: '元数据通常是JSON格式' },
  { pattern: /user_agent/i, reason: 'User Agent字符串可能很长' },
  { pattern: /url/i, reason: 'URL可能超过191字符' },
  { pattern: /selector/i, reason: 'CSS选择器可能很复杂' },
  { pattern: /location/i, reason: '位置信息可能包含详细地址' },
];

// 中等风险字段：这些字段可能偶尔超过限制
const MEDIUM_RISK_PATTERNS = [
  {
    pattern: /name/i,
    maxLength: 150,
    reason: '名称通常不会太长，但150字符可能不够',
  },
  { pattern: /number/i, maxLength: 100, reason: '编号字段100字符应该足够' },
  { pattern: /code/i, maxLength: 100, reason: '代码字段100字符应该足够' },
  { pattern: /bank_info/i, reason: '银行信息可能包含多行' },
];

// 低风险但需注意的字段
const LOW_RISK_PATTERNS = [
  { pattern: /status/i, maxLength: 32, reason: '状态字段32字符足够' },
  { pattern: /type/i, maxLength: 64, reason: '类型字段64字符通常足够' },
  { pattern: /role/i, maxLength: 32, reason: '角色字段32字符足够' },
  { pattern: /phone/i, maxLength: 50, reason: '手机号50字符足够' },
  {
    pattern: /email/i,
    maxLength: 191,
    reason: 'Email 191字符可能不够（RFC允许254）',
  },
];

async function analyzeVarcharRisks() {
  console.log('🔍 分析VARCHAR字段长度风险\n');

  const query = `
    SELECT
      TABLE_NAME,
      COLUMN_NAME,
      COLUMN_TYPE,
      CHARACTER_MAXIMUM_LENGTH,
      IS_NULLABLE,
      COLUMN_COMMENT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND DATA_TYPE = 'varchar'
    ORDER BY TABLE_NAME, CHARACTER_MAXIMUM_LENGTH
  `;

  const fields = await prisma.$queryRawUnsafe(query);

  const risks = {
    high: [],
    medium: [],
    low: [],
    safe: [],
  };

  fields.forEach(field => {
    const fieldName = field.COLUMN_NAME;
    const _tableName = field.TABLE_NAME;
    const length = field.CHARACTER_MAXIMUM_LENGTH;

    // 检查高风险模式
    const highRisk = HIGH_RISK_PATTERNS.find(p => p.pattern.test(fieldName));
    if (highRisk) {
      risks.high.push({
        ...field,
        risk: 'HIGH',
        reason: highRisk.reason,
      });
      return;
    }

    // 检查中等风险模式
    const mediumRisk = MEDIUM_RISK_PATTERNS.find(p => {
      if (!p.pattern.test(fieldName)) return false;
      if (p.maxLength && length >= p.maxLength) return false;
      return true;
    });
    if (mediumRisk) {
      risks.medium.push({
        ...field,
        risk: 'MEDIUM',
        reason: mediumRisk.reason,
      });
      return;
    }

    // 检查低风险模式
    const lowRisk = LOW_RISK_PATTERNS.find(p => {
      if (!p.pattern.test(fieldName)) return false;
      if (p.maxLength && length >= p.maxLength) return false;
      return true;
    });
    if (lowRisk) {
      risks.low.push({
        ...field,
        risk: 'LOW',
        reason: lowRisk.reason,
      });
      return;
    }

    // 其他字段
    risks.safe.push(field);
  });

  // 输出高风险字段
  if (risks.high.length > 0) {
    console.log(`🔴 高风险字段 (${risks.high.length}个) - 建议改为TEXT类型:\n`);
    risks.high.forEach(field => {
      console.log(`   ❌ ${field.TABLE_NAME}.${field.COLUMN_NAME}`);
      console.log(`      类型: ${field.COLUMN_TYPE}`);
      console.log(`      原因: ${field.reason}`);
      console.log(`      建议: 改为 TEXT 类型\n`);
    });
  }

  // 输出中等风险字段
  if (risks.medium.length > 0) {
    console.log(`🟡 中等风险字段 (${risks.medium.length}个) - 需要评估:\n`);
    risks.medium.forEach(field => {
      console.log(`   ⚠️  ${field.TABLE_NAME}.${field.COLUMN_NAME}`);
      console.log(`      类型: ${field.COLUMN_TYPE}`);
      console.log(`      原因: ${field.reason}`);
      console.log(`      建议: 考虑扩展到VARCHAR(255)或更长\n`);
    });
  }

  // 统计信息
  console.log(`\n📊 统计总结:`);
  console.log(`   🔴 高风险字段: ${risks.high.length} 个 (建议立即修复)`);
  console.log(`   🟡 中等风险字段: ${risks.medium.length} 个 (建议评估)`);
  console.log(`   🟢 低风险字段: ${risks.low.length} 个 (可以保持)`);
  console.log(`   ✅ 安全字段: ${risks.safe.length} 个`);

  // 生成修复SQL
  if (risks.high.length > 0) {
    console.log(`\n💡 修复SQL脚本:\n`);
    console.log(`-- 将高风险VARCHAR字段改为TEXT类型`);
    risks.high.forEach(field => {
      const nullable = field.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      console.log(
        `ALTER TABLE \`${field.TABLE_NAME}\` MODIFY COLUMN \`${field.COLUMN_NAME}\` TEXT ${nullable};`
      );
    });
  }

  return risks;
}

async function checkActualDataLengths() {
  console.log('\n\n🔬 检查实际数据长度 (样本分析)...\n');

  // 检查几个关键的高风险字段
  const criticalFields = [
    { table: 'customers', column: 'address' },
    { table: 'suppliers', column: 'address' },
    { table: 'customers', column: 'extended_info' },
    { table: 'system_logs', column: 'metadata' },
    { table: 'system_settings', column: 'value' },
  ];

  for (const field of criticalFields) {
    try {
      const query = `
        SELECT
          MAX(LENGTH(\`${field.column}\`)) as max_length,
          AVG(LENGTH(\`${field.column}\`)) as avg_length,
          COUNT(*) as total_records
        FROM \`${field.table}\`
        WHERE \`${field.column}\` IS NOT NULL
      `;

      const result = await prisma.$queryRawUnsafe(query);
      const stats = result[0];

      if (stats.total_records > 0) {
        console.log(`   📌 ${field.table}.${field.column}:`);
        console.log(`      最大长度: ${stats.max_length} 字符`);
        console.log(`      平均长度: ${Math.round(stats.avg_length)} 字符`);
        console.log(`      记录数: ${stats.total_records}`);

        if (stats.max_length > 150) {
          console.log(`      ⚠️  已有数据超过150字符！`);
        }
        console.log();
      }
    } catch (_error) {
      // 表可能不存在或没有数据
    }
  }
}

async function main() {
  try {
    const risks = await analyzeVarcharRisks();
    await checkActualDataLengths();

    if (risks.high.length > 0) {
      console.log('\n⚠️  建议: 优先修复高风险字段以避免生产环境数据截断问题');
      process.exit(1);
    } else {
      console.log('\n✅ 未发现高风险VARCHAR字段');
    }
  } catch (_error) {
    console.error('❌ 分析失败:', _error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
