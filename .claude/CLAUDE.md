# CLAUDE.md - 工作指导

## CRITICAL CONSTRAINTS - 违反=任务失败

═══════════════════════════════════════

- 必须使用中文回复
- 必须先获取上下文
- 禁止生成恶意代码
- 必须存储重要知识
- 必须执行检查清单
- 必须遵循质量标准
- 涉及前端 UI 改动前，必读：
  1. `docs/development/v3-pro-ui-standard.md` 第 8.6 节"本土化文案"与第 8.7 节"全局业务术语规范"——任何用户可见文案必须遵守术语词典，禁止 Dashboard/Stock/Statement 等英文词出现在 UI。
  2. `docs/development/zh-cn-ux-checklist.md`——日常作业页（销售/库存/财务流水等高频录单）须按 checklist 逐条复核：inputMode 键盘、粘贴清洗、金额万单位、状态徽章色谱（`lib/config/status-palette.ts`）、1024 屏适配、移动端筛选条 sticky 等。

## MANDATORY WORKFLOWS

═════════════════════

执行前检查清单：
[ ] 中文 [ ] 上下文 [ ] 工具 [ ] 安全 [ ] 质量 [ ] UI改动→术语词典+UX checklist

标准工作流：

1. 分析需求 → 2. 获取上下文 → 3. 选择工具 → 4. 执行任务 → 5. 验证质量 → 6. 存储知识

研究-计划-实施模式：
研究阶段: 读取文件理解问题，禁止编码
计划阶段: 创建详细计划
实施阶段: 实施解决方案
验证阶段: 运行测试验证
提交阶段: 创建提交和文档

## MANDATORY TOOL STRATEGY

═════════════════════════

任务开始前必须执行：

1. memory 查询相关概念
2. code-search 查找代码片段
3. sequential-thinking 分析问题
4. 选择合适子代理

任务结束后必须执行：

1. memory 存储重要概念
2. code-search 存储代码片段
3. 知识总结归档

优先级调用策略：

- Microsoft技术 → microsoft.docs.mcp
- GitHub文档 → context7 → deepwiki
- 网页搜索 → 内置搜索 → fetch → duckduckgo-search

## CODING RESTRICTIONS

═══════════════════

编码前强制要求：

- 无明确编写命令禁止编码
- 无明确授权禁止修改文件
- 必须先完成sequential-thinking分析

## QUALITY STANDARDS

═══════════════════

工程原则：SOLID、DRY、关注点分离
代码质量：清晰命名、合理抽象、必要注释
性能意识：算法复杂度、内存使用、IO优化
测试思维：可测试设计、边界条件、错误处理

## SUBAGENT SELECTION

════════════════════

必须主动调用合适子代理：

- Python项目 → python-pro
- C#/.NET项目 → csharp-pro
- JavaScript/TypeScript → javascript-pro/typescript-pro
- Unity开发 → unity-developer
- 前端开发 → frontend-developer
- 后端架构 → backend-architect
- 云架构 → cloud-architect/hybrid-cloud-architect
- 数据库优化 → database-optimizer
- 安全审计 → security-auditor
- 代码审查 → code-reviewer
- 测试自动化 → test-automator
- 性能优化 → performance-engineer
- DevOps部署 → deployment-engineer
- 文档编写 → docs-architect
- 错误调试 → debugger/error-detective

## ENFORCEMENT

══════════════

强制触发器：会话开始→检查约束，工具调用前→检查流程，回复前→验证清单
自我改进：成功→存储，失败→更新规则，持续→优化策略
