# TypeScript 类型检查个人执行手册

> 适用于“单人全栈 + AI 辅助”开发。核心目标：**阻止新增类型债务、逐步清掉历史报错**。

---

## 目标设定

- 短期：每次提交前 `npm run type-check` 必须通过。
- 中期：在 30 天内把 CI（或本地自动脚本）升级为强制项，确保任何分支都不再新增报错。
- 长期：逐步开启更严格的 TS 选项（`strict` 等），把旧债务减到 0。

---

## 三步落地计划

### Step 1：建立基线（今天完成）

1. 运行 `npm run type-check`，将完整报错保存为 `docs/quality/typecheck-baseline.log`。
2. 简要归类（inventory / finance / sales …），记录在 `docs/quality/typecheck-backlog.md`，方便后续逐项清理。

### Step 2：把 type-check 纳入日常工作流

每次提交代码前：

```bash
npm run type-check
npm run lint
npm run test   # 如当前改动相关
```

- **如果通过**：正常提交。
- **如果失败**：
  - 是自己刚改出来的报错 → 当场修复。
  - 是历史遗留 → 在 backlog 中登记（记录文件、错误信息、计划清理日期）。提交时说明“未新增报错，仅遗留问题”。

### Step 3：逐步收紧质量门槛

1. **自动化执行**：在 git hooks（如 Husky）里新增 `npm run type-check`；如果使用 CI，把它加入 pipeline。
2. **CI 变为硬门槛**：确认自己已没有新增报错后，将流水线脚本改成失败即终止。例如：
   ```yaml
   # .github/workflows/typecheck.yml
   jobs:
     typecheck:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: npm
         - run: npm ci
         - run: npm run type-check # 任意报错即失败
   ```
   或在自建 CI 中直接把 `npm run type-check` 放在关键步骤，去掉 `|| true`、`continue-on-error` 等容错配置。
3. **循环清债**：每开发一个功能或修复一批 bug 时，顺便解决该模块内的几条历史错误，保持稳步下降。

---

## 日常自检清单

- [ ] 提交前已执行并通过 `npm run type-check`。
- [ ] 若修改了接口 / DTO / Schema，同步更新 `lib/types/**`、`lib/validations/**` 以及相关文档。
- [ ] 新增的类型描述尽量来源于唯一真理源（例如后端契约或 shared 类型包），避免手写重复 interface。
- [ ] 在 commit/PR 描述中注明：`type-check: pass` 或 `type-check: fails because …（旧债编号）`。

---

## Backlog 模板（typecheck-backlog.md）

```
- [ ] inventory/page-client.tsx:72 — Property 'xxx' does not exist on type ...
      计划处理：2025-05-15
      备注：待统一调整 API 返回值后处理。
```

完成后勾选并写明解决手段，避免遗忘。

---

## 进阶强化

1. **唯一真理源**：逐步把接口定义集中到 shared 类型包，或使用 OpenAPI → TypeScript 生成的类型。
2. **收紧 tsconfig**：每清掉一批错误，就考虑开启新的严格选项（`strict` → `noImplicitAny` → `noUnusedLocals` …）。
3. **构建辅助脚本**：编写 `scripts/typecheck-summary.ts`，自动统计还剩多少条报错以及集中在哪些文件，便于 AI 或自己快速定位。
4. **AI 协同**：和 AI 协作时，在提示中明确“不可新增 any/ts-ignore，必须通过 type-check”，减少低质量自动补丁。

---

坚持执行以上流程，即使是一个人也能稳住类型质量，让技术债只减不增。\*\*\*
