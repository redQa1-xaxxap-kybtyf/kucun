/**
 * 分类管理测试报告生成器
 *
 * 功能:
 * - 分析测试结果
 * - 生成详细的HTML报告
 * - 提供修复建议
 * - 创建趋势分析
 *
 * @author Claude
 * @date 2025-11-05
 */

const fs = require('fs');
const path = require('path');

class CategoryTestReportGenerator {
  constructor() {
    this.reportData = {
      testRun: {
        timestamp: new Date().toISOString(),
        environment: this.detectEnvironment(),
        version: '1.0.0',
      },
      summary: {},
      categories: {},
      issues: [],
      recommendations: [],
      trends: [],
    };
  }

  detectEnvironment() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
    };
  }

  async generateReport(testResults, additionalContext = {}) {
    console.log('📊 生成测试报告...');

    // 处理测试结果
    this.processTestResults(testResults);

    // 分析问题
    this.analyzeIssues();

    // 生成修复建议
    this.generateRecommendations();

    // 创建HTML报告
    const htmlReport = this.generateHtmlReport();

    // 创建JSON报告
    const jsonReport = this.generateJsonReport();

    // 创建Markdown报告
    const markdownReport = this.generateMarkdownReport();

    return {
      html: htmlReport,
      json: jsonReport,
      markdown: markdownReport,
      summary: this.reportData.summary,
    };
  }

  processTestResults(testResults) {
    const { total, passed, failed, skipped, errors, details } = testResults;

    this.reportData.summary = {
      totalTests: total,
      passedTests: passed,
      failedTests: failed,
      skippedTests: skipped,
      passRate: total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0',
      failRate: total > 0 ? ((failed / total) * 100).toFixed(1) : '0.0',
      criticalIssues: 0,
      warnings: 0,
      info: 0,
    };

    // 处理分类结果
    Object.entries(details).forEach(([category, stats]) => {
      this.reportData.categories[category] = {
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        passRate:
          stats.total > 0
            ? ((stats.passed / stats.total) * 100).toFixed(1)
            : '0.0',
        issues: [],
      };
    });

    // 处理错误
    errors.forEach(error => {
      this.reportData.categories[error.category].issues.push(error);

      // 分类问题严重程度
      if (this.isCriticalIssue(error)) {
        this.reportData.summary.criticalIssues++;
      } else if (this.isWarningIssue(error)) {
        this.reportData.summary.warnings++;
      } else {
        this.reportData.summary.info++;
      }
    });
  }

  isCriticalIssue(error) {
    const criticalKeywords = [
      '事务回滚失败',
      '数据不一致',
      '并发操作',
      '外键约束',
      '级联删除',
      '循环引用',
    ];

    return criticalKeywords.some(
      keyword =>
        error.error.toLowerCase().includes(keyword.toLowerCase()) ||
        error.name.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  isWarningIssue(error) {
    const warningKeywords = ['性能', '缓存', '重复', '格式', '边界'];

    return warningKeywords.some(
      keyword =>
        error.error.toLowerCase().includes(keyword.toLowerCase()) ||
        error.name.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  analyzeIssues() {
    const issues = this.reportData.summary;

    // 数据完整性问题
    const integrityIssues = this.reportData.categories.integrity?.issues || [];
    if (integrityIssues.length > 0) {
      this.reportData.issues.push({
        type: 'data_integrity',
        severity: 'high',
        count: integrityIssues.length,
        description: '数据完整性检查发现问题',
        examples: integrityIssues.slice(0, 3),
      });
    }

    // 并发安全问题
    const consistencyIssues =
      this.reportData.categories.consistency?.issues || [];
    if (consistencyIssues.length > 0) {
      this.reportData.issues.push({
        type: 'concurrency_safety',
        severity: 'high',
        count: consistencyIssues.length,
        description: '并发操作存在安全问题',
        examples: consistencyIssues.slice(0, 3),
      });
    }

    // 边界条件问题
    const boundaryIssues = this.reportData.categories.boundary?.issues || [];
    if (boundaryIssues.length > 0) {
      this.reportData.issues.push({
        type: 'boundary_conditions',
        severity: 'medium',
        count: boundaryIssues.length,
        description: '边界条件处理不当',
        examples: boundaryIssues.slice(0, 3),
      });
    }

    // 同步问题
    const syncIssues = this.reportData.categories.sync?.issues || [];
    if (syncIssues.length > 0) {
      this.reportData.issues.push({
        type: 'data_sync',
        severity: 'medium',
        count: syncIssues.length,
        description: '数据同步存在问题',
        examples: syncIssues.slice(0, 3),
      });
    }

    // 错误恢复问题
    const recoveryIssues = this.reportData.categories.recovery?.issues || [];
    if (recoveryIssues.length > 0) {
      this.reportData.issues.push({
        type: 'error_recovery',
        severity: 'high',
        count: recoveryIssues.length,
        description: '错误恢复机制不完善',
        examples: recoveryIssues.slice(0, 3),
      });
    }
  }

  generateRecommendations() {
    const issues = this.reportData.issues;

    // 数据完整性建议
    if (issues.some(i => i.type === 'data_integrity')) {
      this.reportData.recommendations.push({
        priority: 'high',
        category: '数据完整性',
        title: '实施数据完整性约束',
        description: '添加数据库约束和应用层验证',
        actions: [
          '在数据库层面添加唯一约束',
          '实现应用层的数据验证',
          '定期运行数据完整性检查',
          '建立数据监控机制',
        ],
        codeExample: `
-- 数据库约束示例
ALTER TABLE categories
ADD CONSTRAINT unique_name_per_parent
UNIQUE (name, parent_id);

-- 添加检查约束
ALTER TABLE categories
ADD CONSTRAINT check_valid_status
CHECK (status IN ('active', 'inactive'));
        `,
      });
    }

    // 并发安全建议
    if (issues.some(i => i.type === 'concurrency_safety')) {
      this.reportData.recommendations.push({
        priority: 'high',
        category: '并发安全',
        title: '加强并发操作控制',
        description: '实现适当的锁机制和事务控制',
        actions: [
          '使用数据库事务确保原子性',
          '实现乐观锁或悲观锁',
          '添加重试机制',
          '限制并发操作数量',
        ],
        codeExample: `
// 事务示例
await prisma.$transaction(async (tx) => {
  // 检查是否存在冲突
  const existing = await tx.category.findFirst({
    where: { name: params.name, parentId: params.parentId }
  });

  if (existing) {
    throw new Error('名称已存在');
  }

  // 创建新记录
  return await tx.category.create({ data: params });
});
        `,
      });
    }

    // 边界条件建议
    if (issues.some(i => i.type === 'boundary_conditions')) {
      this.reportData.recommendations.push({
        priority: 'medium',
        category: '边界条件',
        title: '完善边界条件处理',
        description: '加强输入验证和边界检查',
        actions: [
          '添加严格的输入验证',
          '实现层级深度限制检查',
          '完善错误处理机制',
          '添加单元测试覆盖边界条件',
        ],
        codeExample: `
// 边界检查示例
function validateCategoryDepth(parentId, currentDepth = 0) {
  const MAX_DEPTH = 3;

  if (currentDepth >= MAX_DEPTH) {
    throw new Error(\`分类层级不能超过\${MAX_DEPTH}级\`);
  }

  // 递归检查父级深度
  if (parentId) {
    return validateCategoryDepth(parentId.parentId, currentDepth + 1);
  }
}
        `,
      });
    }

    // 缓存同步建议
    if (issues.some(i => i.type === 'data_sync')) {
      this.reportData.recommendations.push({
        priority: 'medium',
        category: '数据同步',
        title: '优化缓存同步机制',
        description: '确保缓存与数据库数据一致性',
        actions: [
          '实现缓存失效策略',
          '添加缓存一致性检查',
          '使用缓存预热机制',
          '监控缓存命中率',
        ],
        codeExample: `
// 缓存失效示例
async function invalidateCategoryCache(categoryId) {
  const keys = [
    \`category:\${categoryId}\`,
    'categories:list',
    'categories:tree'
  ];

  await Promise.all(
    keys.map(key => cache.del(key))
  );

  // 重新验证缓存
  await verifyCacheConsistency(categoryId);
}
        `,
      });
    }

    // 错误恢复建议
    if (issues.some(i => i.type === 'error_recovery')) {
      this.reportData.recommendations.push({
        priority: 'high',
        category: '错误恢复',
        title: '完善错误恢复机制',
        description: '实现健壮的错误处理和恢复策略',
        actions: [
          '实现事务回滚机制',
          '添加操作日志记录',
          '实现数据备份策略',
          '建立监控和告警机制',
        ],
        codeExample: `
// 错误恢复示例
async function safeCategoryOperation(operation) {
  const startTime = Date.now();

  try {
    const result = await operation();

    // 记录成功日志
    await logOperation({
      type: 'category_operation',
      status: 'success',
      duration: Date.now() - startTime
    });

    return result;
  } catch (error) {
    // 记录错误日志
    await logOperation({
      type: 'category_operation',
      status: 'failed',
      error: error.message,
      duration: Date.now() - startTime
    });

    // 触发恢复流程
    await triggerRecoveryProcess(error);

    throw error;
  }
}
        `,
      });
    }

    // 通用建议
    this.reportData.recommendations.push({
      priority: 'medium',
      category: '监控和告警',
      title: '建立完善的监控体系',
      description: '实现系统监控和自动告警',
      actions: [
        '添加性能监控指标',
        '实现错误率监控',
        '建立告警机制',
        '定期进行系统健康检查',
      ],
    });

    this.reportData.recommendations.push({
      priority: 'low',
      category: '文档和测试',
      title: '完善文档和测试覆盖',
      description: '提高代码质量和可维护性',
      actions: [
        '编写详细的API文档',
        '增加单元测试覆盖率',
        '建立集成测试',
        '定期进行代码审查',
      ],
    });
  }

  generateHtmlReport() {
    const { summary, categories, issues, recommendations, testRun } =
      this.reportData;

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>分类管理测试报告</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 2rem; }
        .header .meta { margin-top: 10px; opacity: 0.9; }
        .content { padding: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; font-size: 2rem; }
        .summary-card .label { color: #666; font-size: 0.9rem; }
        .pass { color: #28a745; }
        .fail { color: #dc3545; }
        .skip { color: #ffc107; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .issues { margin-top: 20px; }
        .issue { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin-bottom: 10px; }
        .issue.high { background: #f8d7da; border-color: #f5c6cb; }
        .issue.medium { background: #fff3cd; border-color: #ffeaa7; }
        .issue.low { background: #d1ecf1; border-color: #bee5eb; }
        .recommendations { margin-top: 20px; }
        .recommendation { background: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; padding: 15px; margin-bottom: 15px; }
        .recommendation.high { border-left: 4px solid #28a745; }
        .recommendation.medium { border-left: 4px solid #ffc107; }
        .recommendation.low { border-left: 4px solid #17a2b8; }
        .code { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 15px; font-family: 'Courier New', monospace; font-size: 0.9rem; overflow-x: auto; }
        .progress-bar { background: #e9ecef; border-radius: 4px; height: 20px; margin: 10px 0; }
        .progress-fill { background: #28a745; height: 100%; border-radius: 4px; transition: width 0.3s ease; }
        .category-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-top: 15px; }
        .category-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; }
        .category-card h4 { margin: 0 0 10px 0; color: #495057; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 分类管理测试报告</h1>
            <div class="meta">
                <div>测试时间: ${new Date(testRun.timestamp).toLocaleString('zh-CN')}</div>
                <div>环境: Node.js ${testRun.environment.nodeVersion} | ${testRun.environment.platform}</div>
            </div>
        </div>

        <div class="content">
            <!-- 测试概览 -->
            <div class="section">
                <h2>📊 测试概览</h2>
                <div class="summary">
                    <div class="summary-card">
                        <h3 class="pass">${summary.passTests}</h3>
                        <div class="label">通过测试</div>
                    </div>
                    <div class="summary-card">
                        <h3 class="fail">${summary.failedTests}</h3>
                        <div class="label">失败测试</div>
                    </div>
                    <div class="summary-card">
                        <h3 class="skip">${summary.skippedTests}</h3>
                        <div class="label">跳过测试</div>
                    </div>
                    <div class="summary-card">
                        <h3>${summary.passRate}%</h3>
                        <div class="label">通过率</div>
                    </div>
                </div>

                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${summary.passRate}%"></div>
                </div>
            </div>

            <!-- 分类统计 -->
            <div class="section">
                <h2>📈 分类测试统计</h2>
                <div class="category-stats">
                    ${Object.entries(categories)
                      .map(
                        ([category, stats]) => `
                        <div class="category-card">
                            <h4>${category.toUpperCase()}</h4>
                            <div>通过: ${stats.passed}/${stats.total}</div>
                            <div>通过率: ${stats.passRate}%</div>
                            ${stats.issues.length > 0 ? `<div style="color: #dc3545;">问题: ${stats.issues.length}</div>` : ''}
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>

            <!-- 发现的问题 -->
            <div class="section">
                <h2>⚠️ 发现的问题</h2>
                <div class="issues">
                    ${
                      issues.length > 0
                        ? issues
                            .map(
                              issue => `
                        <div class="issue ${issue.severity}">
                            <h4>${issue.description}</h4>
                            <p><strong>严重程度:</strong> ${issue.severity}</p>
                            <p><strong>数量:</strong> ${issue.count}</p>
                            ${
                              issue.examples && issue.examples.length > 0
                                ? `
                                <p><strong>示例:</strong></p>
                                <ul>
                                    ${issue.examples.map(ex => `<li>${ex.name}: ${ex.error}</li>`).join('')}
                                </ul>
                            `
                                : ''
                            }
                        </div>
                    `
                            )
                            .join('')
                        : '<p>✅ 未发现严重问题</p>'
                    }
                </div>
            </div>

            <!-- 修复建议 -->
            <div class="section">
                <h2>💡 修复建议</h2>
                <div class="recommendations">
                    ${recommendations
                      .map(
                        rec => `
                        <div class="recommendation ${rec.priority}">
                            <h4>${rec.title}</h4>
                            <p><strong>优先级:</strong> ${rec.priority}</p>
                            <p><strong>类别:</strong> ${rec.category}</p>
                            <p>${rec.description}</p>
                            <p><strong>建议行动:</strong></p>
                            <ul>
                                ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                            </ul>
                            ${
                              rec.codeExample
                                ? `
                                <p><strong>代码示例:</strong></p>
                                <div class="code">${rec.codeExample}</div>
                            `
                                : ''
                            }
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  generateJsonReport() {
    return JSON.stringify(this.reportData, null, 2);
  }

  generateMarkdownReport() {
    const { summary, categories, issues, recommendations, testRun } =
      this.reportData;

    return `# 分类管理测试报告

## 测试概览

- **测试时间**: ${new Date(testRun.timestamp).toLocaleString('zh-CN')}
- **环境**: Node.js ${testRun.environment.nodeVersion} | ${testRun.environment.platform}
- **总测试数**: ${summary.totalTests}
- **通过测试**: ${summary.passedTests}
- **失败测试**: ${summary.failedTests}
- **跳过测试**: ${summary.skippedTests}
- **通过率**: ${summary.passRate}%

## 分类测试统计

| 类别 | 通过/总数 | 通过率 | 问题数 |
|------|-----------|--------|--------|
${Object.entries(categories)
  .map(
    ([category, stats]) =>
      `| ${category.toUpperCase()} | ${stats.passed}/${stats.total} | ${stats.passRate}% | ${stats.issues.length} |`
  )
  .join('\n')}

## 发现的问题

${
  issues.length > 0
    ? issues
        .map(
          issue => `
### ${issue.description}

- **严重程度**: ${issue.severity}
- **数量**: ${issue.count}
- **类型**: ${issue.type}

${
  issue.examples && issue.examples.length > 0
    ? `
**示例**:
${issue.examples.map(ex => `- ${ex.name}: ${ex.error}`).join('\n')}
`
    : ''
}
`
        )
        .join('\n')
    : '✅ 未发现严重问题'
}

## 修复建议

${recommendations
  .map(
    rec => `
### ${rec.title}

**优先级**: ${rec.priority}
**类别**: ${rec.category}

${rec.description}

**建议行动**:
${rec.actions.map(action => `- ${action}`).join('\n')}

${
  rec.codeExample
    ? `
**代码示例**:
\`\`\`
${rec.codeExample}
\`\`\`
`
    : ''
}
`
  )
  .join('\n')}

## 总结

${
  summary.passRate >= 90
    ? '🎉 系统质量良好，建议继续监控'
    : summary.passRate >= 70
      ? '⚠️ 系统存在一些问题，建议优先处理高优先级问题'
      : '🚨 系统存在较多问题，需要立即处理'
}
`;
  }
}

// 导出类
module.exports = CategoryTestReportGenerator;

// 如果直接运行此脚本
if (require.main === module) {
  // 示例用法
  const generator = new CategoryTestReportGenerator();

  // 模拟测试结果
  const mockTestResults = {
    total: 25,
    passed: 20,
    failed: 3,
    skipped: 2,
    errors: [
      {
        category: 'integrity',
        name: '分类编码唯一性检查',
        error: '发现重复编码: TEST001',
      },
      {
        category: 'consistency',
        name: '并发创建分类一致性测试',
        error: '只有 4/5 请求成功',
      },
    ],
    details: {
      integrity: { total: 5, passed: 4, failed: 1 },
      consistency: { total: 5, passed: 3, failed: 2 },
      boundary: { total: 5, passed: 5, failed: 0 },
      sync: { total: 5, passed: 4, failed: 1 },
      recovery: { total: 5, passed: 4, failed: 1 },
    },
  };

  generator
    .generateReport(mockTestResults)
    .then(reports => {
      // 保存报告
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      fs.writeFileSync(
        `./test-results/category-test-report-${timestamp}.html`,
        reports.html
      );
      fs.writeFileSync(
        `./test-results/category-test-report-${timestamp}.json`,
        reports.json
      );
      fs.writeFileSync(
        `./test-results/category-test-report-${timestamp}.md`,
        reports.markdown
      );

      console.log('📄 测试报告已生成');
      console.log(`📊 通过率: ${reports.summary.passRate}%`);
      console.log(
        `⚠️  发现问题: ${reports.summary.criticalIssues + reports.summary.warnings} 个`
      );
    })
    .catch(error => {
      console.error('生成报告失败:', error);
    });
}
