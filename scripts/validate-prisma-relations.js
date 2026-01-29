/**
 * Prisma 关系约束自检脚本
 *
 * 目标：
 * - 在 lint 之前快速检测 schema 是否存在「有外键字段但缺少 @relation 定义」的问题
 * - 尽量复现/保留原始版本中“关系约束自检”的核心能力，避免再次出现线上 PrismaClientValidationError
 *
 * 检查内容（当前实现的核心部分）：
 * 1. 运行 `npx prisma validate` 做语法级校验
 * 2. 解析 `prisma/schema.prisma`：
 *    - 找出所有以 `Id` 结尾的字段（如 customerId、userId）
 *    - 跳过白名单中的通用字段（orderId、referenceId 等）
 *    - 检查这些字段是否出现在当前模型的 `@relation(fields: [...])` 定义里
 *    - 若不存在，则认为缺少关系定义，报错并给出修复建议
 *
 * 说明：
 * - 为了控制复杂度，目前只做「前向关系」检查，不对反向关系/命名关系做严格校验
 * - 这样可以覆盖绝大多数“schema 少字段 / 少 @relation” 的真实问题，同时避免脚本误报阻塞上线
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PRISMA_SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma');

// 与文档中描述一致的特殊外键白名单（多态/通用引用字段）
const SPECIAL_FOREIGN_KEYS = new Set([
  'orderId',
  'referenceId',
  'sourceId',
  'relatedId',
  'entityId',
  'siteId',
]);

/**
 * 运行 `npx prisma validate` 做基础语法/数据库兼容性校验
 */
function runPrismaValidate() {
  try {
    console.log('🔍 [prisma] Running `npx prisma validate` ...');
    execSync('npx prisma validate', { stdio: 'inherit' });
    console.log('✅ [prisma] Prisma schema validate passed.');
  } catch (error) {
    console.error('❌ [prisma] Prisma schema validate failed.');
    if (error && typeof error.status === 'number') {
      process.exit(error.status);
    }
    process.exit(1);
  }
}

/**
 * 解析 schema.prisma，返回模型列表
 */
function parsePrismaModels(schemaText) {
  const models = [];
  const lines = schemaText.split(/\r?\n/);

  let currentModel = null;

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.startsWith('model ')) {
      const match = line.match(/^model\s+(\w+)\s*{/);
      if (match) {
        currentModel = {
          name: match[1],
          startLine: i + 1,
          fields: [],
        };
        models.push(currentModel);
      }
      continue;
    }

    if (!currentModel) continue;

    if (line.startsWith('}')) {
      currentModel = null;
      continue;
    }

    // 跳过模型级别属性和注释
    if (!line || line.startsWith('//') || line.startsWith('@@')) {
      continue;
    }

    // 粗略解析字段定义：name type [attributes...]
    const fieldMatch = rawLine.match(/^\s*(\w+)\s+([^\s]+)\s*(.*)$/);
    if (!fieldMatch) continue;

    const [, fieldName, fieldType, attrRaw] = fieldMatch;
    const attributes = attrRaw || '';

    currentModel.fields.push({
      name: fieldName,
      type: fieldType,
      attributes,
      line: i + 1,
    });
  }

  return models;
}

/**
 * 检测缺少 @relation 的外键字段
 */
function validateRelations(models) {
  const issues = [];

  for (const model of models) {
    // 找出当前模型中通过 @relation(fields: [...]) 声明过的外键字段
    const relatedFields = new Set();

    for (const field of model.fields) {
      if (!field.attributes.includes('@relation')) continue;

      const relationMatch = field.attributes.match(
        /@relation\([^)]*fields\s*:\s*\[([^\]]+)]/
      );
      if (!relationMatch) continue;

      const fieldsList = relationMatch[1]
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      for (const f of fieldsList) {
        relatedFields.add(f);
      }
    }

    // 找出以 Id 结尾的字段，检查是否被 @relation 使用
    for (const field of model.fields) {
      const { name, type, attributes } = field;

      // 排除 id 主键本身以及白名单中的字段
      if (!name.endsWith('Id')) continue;
      if (name === 'id') continue;
      // 排除主键字段（如 runId @id），避免误报
      if (attributes.includes('@id')) continue;
      if (SPECIAL_FOREIGN_KEYS.has(name)) continue;

      // 只检查标量外键字段（String / Int / BigInt 等），忽略关系字段本身
      if (attributes.includes('@relation')) continue;

      // 如果该字段没有出现在任何 @relation(fields: [...]) 中，则认为可能缺少关系定义
      if (!relatedFields.has(name)) {
        issues.push({
          level: 'error',
          model: model.name,
          field: name,
          type,
          line: field.line,
          message:
            '外键字段看起来缺少 @relation 定义（未在任何 @relation(fields: [...]) 中出现）',
        });
      }
    }
  }

  return issues;
}

function printReport(models, issues) {
  const foreignKeyCandidates = models.reduce((count, model) => {
    return (
      count +
      model.fields.filter(
        f =>
          f.name.endsWith('Id') &&
          f.name !== 'id' &&
          !SPECIAL_FOREIGN_KEYS.has(f.name)
      ).length
    );
  }, 0);

  if (issues.length === 0) {
    console.log('\n✅ Prisma Schema 关系定义检查通过');
    console.log(`- 检查了 ${models.length} 个模型`);
    console.log(`- 验证了 ${foreignKeyCandidates} 个外键候选字段`);
    console.log('- 所有外键字段都在 @relation(fields: [...]) 中声明\n');
    return;
  }

  const errorCount = issues.filter(i => i.level === 'error').length;

  console.error('\n❌ Prisma Schema 关系定义检查失败');
  console.error(`\n发现 ${errorCount} 个可能缺失的关系定义：\n`);

  issues.forEach((issue, index) => {
    console.error(
      `${index + 1}. ❌ ${issue.model} 模型 (line ${issue.line}) - 字段 "${issue.field}"`
    );
    console.error(`   - ${issue.message}`);
    console.error('   - 建议：在同一模型中添加对应的关系字段，例如：');
    console.error(
      `     ${issue.field.replace(
        /Id$/,
        ''
      )} SomeModel @relation(fields: [${issue.field}], references: [id])`
    );
    console.error('');
  });

  console.error(
    `总计: ${errorCount} 个错误。请修复以上问题后再运行 npm run validate:schema / npm run lint。\n`
  );

  process.exit(1);
}

function main() {
  runPrismaValidate();

  if (!fs.existsSync(PRISMA_SCHEMA_PATH)) {
    console.warn(
      `⚠️  未找到 ${PRISMA_SCHEMA_PATH}，仅执行了 prisma validate，跳过关系自检。`
    );
    return;
  }

  const schemaText = fs.readFileSync(PRISMA_SCHEMA_PATH, 'utf8');
  const models = parsePrismaModels(schemaText);
  const issues = validateRelations(models);
  printReport(models, issues);
}

main();
