#!/usr/bin/env node

/**
 * Prisma Schema 关系定义完整性检测脚本
 *
 * 功能：
 * 1. 扫描所有模型中的外键字段（以 Id 结尾）
 * 2. 验证每个外键是否有对应的 @relation 定义
 * 3. 验证目标模型是否有反向关系
 * 4. 检测命名关系的一致性
 *
 * 使用：
 * - npm run validate:schema
 * - node scripts/validate-prisma-relations.js
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 读取 Prisma Schema 文件
function readSchema() {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');

  if (!fs.existsSync(schemaPath)) {
    log('❌ 错误：找不到 prisma/schema.prisma 文件', 'red');
    process.exit(1);
  }

  return fs.readFileSync(schemaPath, 'utf-8');
}

// 解析模型定义
function parseModels(schemaContent) {
  const models = [];
  const lines = schemaContent.split('\n');

  let currentModel = null;
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber++;
    const trimmedLine = line.trim();

    // 检测模型开始
    const modelMatch = trimmedLine.match(/^model\s+(\w+)\s*{/);
    if (modelMatch) {
      currentModel = {
        name: modelMatch[1],
        startLine: lineNumber,
        fields: [],
        relations: [],
        foreignKeys: [],
      };
      continue;
    }

    // 检测模型结束
    if (trimmedLine === '}' && currentModel) {
      currentModel.endLine = lineNumber;
      models.push(currentModel);
      currentModel = null;
      continue;
    }

    // 解析字段
    if (
      currentModel &&
      trimmedLine &&
      !trimmedLine.startsWith('//') &&
      !trimmedLine.startsWith('@@')
    ) {
      // 外键字段（以 Id 结尾）
      const foreignKeyMatch = trimmedLine.match(/^(\w+Id)\s+(\w+)(\?)?/);
      if (foreignKeyMatch) {
        currentModel.foreignKeys.push({
          fieldName: foreignKeyMatch[1],
          fieldType: foreignKeyMatch[2],
          isOptional: !!foreignKeyMatch[3],
          lineNumber,
          line: trimmedLine,
        });
      }

      // 关系字段（包含 @relation）
      const relationMatch = trimmedLine.match(
        /^(\w+)\s+(\w+)(\?)?(\[\])?\s+@relation/
      );
      let matchedRelationDefinition = false;
      if (relationMatch) {
        const relationNameMatch = trimmedLine.match(/@relation\("([^"]+)"/);
        const fieldsMatch = trimmedLine.match(/fields:\s*\[([^\]]+)\]/);
        const referencesMatch = trimmedLine.match(/references:\s*\[([^\]]+)\]/);
        const isArrayRelation = !!relationMatch[4];
        const hasFields = !!fieldsMatch;
        const hasReferences = !!referencesMatch;
        const isReverseRelation =
          isArrayRelation && (!hasFields || !hasReferences);

        currentModel.relations.push({
          fieldName: relationMatch[1],
          targetModel: relationMatch[2],
          isOptional: !!relationMatch[3],
          isArray: !!relationMatch[4],
          relationName: relationNameMatch ? relationNameMatch[1] : null,
          foreignKeyFields: fieldsMatch
            ? fieldsMatch[1].split(',').map(f => f.trim())
            : [],
          references: referencesMatch
            ? referencesMatch[1].split(',').map(r => r.trim())
            : [],
          lineNumber,
          line: trimmedLine,
          isReverse: isReverseRelation,
        });

        matchedRelationDefinition = true;
      }

      // 反向关系字段（数组类型，不包含 @relation 或只有命名关系）
      // 注意：不要重复添加已经在上面 relationMatch 中匹配的关系
      if (
        !matchedRelationDefinition &&
        !trimmedLine.includes('fields:') &&
        !trimmedLine.includes('references:')
      ) {
        const reverseRelationMatch = trimmedLine.match(
          /^(\w+)\s+(\w+)\[\](?:\s+@relation\("([^"]+)"\))?$/
        );
        if (reverseRelationMatch) {
          currentModel.relations.push({
            fieldName: reverseRelationMatch[1],
            targetModel: reverseRelationMatch[2],
            isOptional: false,
            isArray: true,
            relationName: reverseRelationMatch[3] || null,
            foreignKeyFields: [],
            references: [],
            lineNumber,
            line: trimmedLine,
            isReverse: true,
          });
        }
      }
    }
  }

  return models;
}

// 验证关系定义
function validateRelations(models) {
  const issues = [];
  const modelMap = new Map(models.map(m => [m.name, m]));

  // 特殊外键字段白名单（这些字段可能是多态关系或特殊用途，不需要标准关系定义）
  const specialForeignKeys = new Set([
    'orderId', // 可能是多态关系（不同类型的订单）
    'referenceId', // 通用引用字段
    'sourceId', // 通用来源字段
    'relatedId', // 通用关联字段
    'entityId', // 通用实体字段
    'siteId', // 可能是字符串类型的站点ID
  ]);

  // 1. 检查每个外键是否有对应的关系定义
  for (const model of models) {
    for (const foreignKey of model.foreignKeys) {
      // 跳过白名单中的特殊字段
      if (specialForeignKeys.has(foreignKey.fieldName)) {
        continue;
      }

      // 推断目标模型名称（移除 Id 后缀）
      const expectedModelName = foreignKey.fieldName.replace(/Id$/, '');
      const capitalizedModelName =
        expectedModelName.charAt(0).toUpperCase() + expectedModelName.slice(1);

      // 查找对应的关系定义
      const relation = model.relations.find(
        r =>
          r.foreignKeyFields.includes(foreignKey.fieldName) ||
          r.fieldName.toLowerCase() === expectedModelName.toLowerCase()
      );

      if (!relation) {
        // 检查目标模型是否存在
        if (!modelMap.has(capitalizedModelName)) {
          // 如果目标模型不存在，可能是特殊字段，跳过
          continue;
        }

        issues.push({
          type: 'missing_forward_relation',
          model: model.name,
          foreignKey: foreignKey.fieldName,
          expectedRelationName: expectedModelName,
          expectedTargetModel: capitalizedModelName,
          lineNumber: foreignKey.lineNumber,
          severity: 'error',
        });
      }
    }
  }

  // 2. 检查每个前向关系是否在目标模型中有反向关系
  for (const model of models) {
    for (const relation of model.relations) {
      // 跳过反向关系
      if (relation.isReverse || relation.isArray) continue;

      const targetModel = modelMap.get(relation.targetModel);
      if (!targetModel) {
        issues.push({
          type: 'target_model_not_found',
          model: model.name,
          relation: relation.fieldName,
          targetModel: relation.targetModel,
          lineNumber: relation.lineNumber,
          severity: 'error',
        });
        continue;
      }

      // 查找反向关系
      const reverseRelation = targetModel.relations.find(r => {
        // 如果使用命名关系，必须匹配名称
        if (relation.relationName) {
          return (
            r.relationName === relation.relationName &&
            r.targetModel === model.name
          );
        }
        // 否则，查找指向当前模型的数组关系
        return r.isArray && r.targetModel === model.name && !r.relationName;
      });

      if (!reverseRelation) {
        issues.push({
          type: 'missing_reverse_relation',
          model: model.name,
          relation: relation.fieldName,
          targetModel: relation.targetModel,
          relationName: relation.relationName,
          lineNumber: relation.lineNumber,
          severity: 'error',
        });
      }
    }
  }

  // 3. 检查命名关系的一致性
  const namedRelations = new Map();
  for (const model of models) {
    for (const relation of model.relations) {
      if (relation.relationName) {
        const key = relation.relationName;
        if (!namedRelations.has(key)) {
          namedRelations.set(key, []);
        }
        namedRelations.get(key).push({
          model: model.name,
          relation: relation.fieldName,
          targetModel: relation.targetModel,
          isArray: relation.isArray,
          lineNumber: relation.lineNumber,
        });
      }
    }
  }

  // 验证命名关系必须成对出现
  for (const [relationName, relations] of namedRelations) {
    if (relations.length !== 2) {
      issues.push({
        type: 'named_relation_mismatch',
        relationName,
        relations,
        severity: 'warning',
      });
    }
  }

  return issues;
}

// 格式化输出问题
function reportIssues(issues, models) {
  if (issues.length === 0) {
    log('\n✅ Prisma Schema 关系定义检查通过', 'green');
    log(`- 检查了 ${models.length} 个模型`, 'cyan');

    const totalForeignKeys = models.reduce(
      (sum, m) => sum + m.foreignKeys.length,
      0
    );
    const totalRelations = models.reduce(
      (sum, m) => sum + m.relations.length,
      0
    );

    log(`- 验证了 ${totalForeignKeys} 个外键字段`, 'cyan');
    log(`- 验证了 ${totalRelations} 个关系定义`, 'cyan');
    log('- 所有关系定义完整\n', 'cyan');
    return true;
  }

  log(`\n❌ Prisma Schema 关系定义检查失败\n`, 'red');
  log(`发现 ${issues.length} 个问题：\n`, 'yellow');

  let errorCount = 0;
  let warningCount = 0;

  issues.forEach((issue, index) => {
    if (issue.severity === 'error') errorCount++;
    if (issue.severity === 'warning') warningCount++;

    const prefix = issue.severity === 'error' ? '❌' : '⚠️';

    if (issue.type === 'missing_forward_relation') {
      log(
        `${index + 1}. ${prefix} ${issue.model} 模型 (line ${issue.lineNumber})`,
        'yellow'
      );
      log(`   - 外键字段 '${issue.foreignKey}' 缺少 @relation 定义`, 'red');
      log(
        `   - 建议添加: ${issue.expectedRelationName} ${issue.expectedTargetModel}${issue.isOptional ? '?' : ''} @relation(fields: [${issue.foreignKey}], references: [id], onDelete: Restrict, onUpdate: Cascade)`,
        'cyan'
      );
      log('');
    } else if (issue.type === 'missing_reverse_relation') {
      log(`${index + 1}. ${prefix} ${issue.targetModel} 模型`, 'yellow');
      log(`   - 缺少来自 ${issue.model}.${issue.relation} 的反向关系`, 'red');

      if (issue.relationName) {
        log(
          `   - 建议添加: ${issue.model.toLowerCase()}s ${issue.model}[] @relation("${issue.relationName}")`,
          'cyan'
        );
      } else {
        log(
          `   - 建议添加: ${issue.model.toLowerCase()}s ${issue.model}[]`,
          'cyan'
        );
      }
      log('');
    } else if (issue.type === 'target_model_not_found') {
      log(
        `${index + 1}. ${prefix} ${issue.model} 模型 (line ${issue.lineNumber})`,
        'yellow'
      );
      log(
        `   - 关系 '${issue.relation}' 指向不存在的模型 '${issue.targetModel}'`,
        'red'
      );
      log('');
    } else if (issue.type === 'named_relation_mismatch') {
      log(
        `${index + 1}. ${prefix} 命名关系 "${issue.relationName}" 不匹配`,
        'yellow'
      );
      log(
        `   - 找到 ${issue.relations.length} 个使用此名称的关系（应该是 2 个）`,
        'red'
      );
      issue.relations.forEach(r => {
        log(
          `     - ${r.model}.${r.relation} → ${r.targetModel} (line ${r.lineNumber})`,
          'cyan'
        );
      });
      log('');
    }
  });

  log(`\n总计: ${errorCount} 个错误, ${warningCount} 个警告\n`, 'yellow');
  log('请修复以上问题后再提交代码。\n', 'red');

  return false;
}

// 主函数
function main() {
  log('\n🔍 开始检查 Prisma Schema 关系定义...\n', 'blue');

  const schemaContent = readSchema();
  const models = parseModels(schemaContent);
  const issues = validateRelations(models);
  const success = reportIssues(issues, models);

  process.exit(success ? 0 : 1);
}

// 运行
main();
