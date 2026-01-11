---
mode: report
cwd: e:\kucun
task: 上线前全量检查（工程门禁 + 业务一致性）
created_at: 2025-12-25
---

# 上线前全量检查报告（2025-12-25）

## 结论

- 业务一致性：`audit:full` 异常 **0**，可视为“口径一致性/链路完整性”在当前开发库通过。
- 工程构建：`next build` 在 **4GB** 堆内存下会 OOM；将构建内存提升到 **8GB** 后可稳定完成构建。
- 工程门禁：`type-check`、关键库存单测通过；但 `lint` 与 `format:check` 仍会失败（大量告警/未格式化文件）。

## 已执行检查与产物

### 业务一致性（通过）

- 全量审计：`npm run audit:full`
  - 产物：`test-results/full-audit-2025-12-25T09-36-20-078Z.csv`
  - 产物：`test-results/full-audit-2025-12-25T09-36-20-078Z.json`
  - 日志：`test-results/audit-full-20251225-173619.log`

### TypeScript（通过）

- 类型检查：`npm run type-check`
  - 日志：`test-results/type-check-20251225-172807.log`
  - 说明：根 `tsconfig.json` 已排除 `kucunxcx/`（小程序目录不纳入本仓的 `tsc --noEmit` 门禁）

### 测试（通过）

- 库存相关单测：`npm test -- __tests__/unit/inventory --runInBand`
  - 日志：`test-results/unit-inventory-20251225-173551.log`
  - 备注：Jest 仍提示 open handles（非失败），建议后续用 `--detectOpenHandles` 定位并逐个清理（典型是 DB/Redis 连接未断开）

### 构建（通过但需注意）

- 生产构建：`npm run build`
  - ✅ 通过（需要 8GB 堆内存）
  - 日志：`test-results/next-build-20251225-173924.log`
  - 已落地：
    - `package.json`：`build` 默认改为 `--max-old-space-size=8192`
    - `next.config.ts`：生产环境禁用 `optimizePackageImports`；并将 `bullmq/qiniu/vm2` 加入 `serverExternalPackages`，减少打包警告与 bundle 体积
  - ⚠️ 风险：
    - 构建阶段出现大量 Redis 警告（提供了密码但 Redis default 用户不需要密码），说明构建期存在 Redis 客户端初始化/连接行为或配置不一致；生产环境建议修正 `REDIS_PASSWORD` 或避免构建期触达 Redis。

### Prisma Schema（通过）

- `npm run validate:schema` 在 lint 前置步骤中已通过（见 `test-results/lint-20251225-173749.log`）

### Lint / Format（未通过）

- ESLint：`npm run lint`
  - 结果：未通过（大量规则告警，含 `max-lines(-per-function)`、`no-console`、`no-explicit-any` 等）
  - 日志：`test-results/lint-20251225-173749.log`
- Prettier：`npm run format:check`
  - 结果：未通过（约 200+ 文件未格式化）
  - 日志：`test-results/format-check-20251225-174212.log`
  - 已落地：`.prettierignore` 增加 `tmp-run.cjs`，避免 Prettier 因临时脚本语法报错而中断检查

## 上线前建议（可执行）

1. 资源门槛确认：CI/生产构建机需支持 `NODE_OPTIONS=--max-old-space-size=8192`（或提供等价内存）以保证 `next build` 稳定。
2. Redis 配置治理：检查 `.env.production` 与生产 Redis 账号策略；若 Redis 无密码，移除密码配置；若需要密码，确保 server 端连接使用正确账号/密码组合，避免构建期“隐式连接”造成不确定性。
3. 门禁策略决策：
   - 若 `lint`/`format:check` 作为上线硬门禁：需要集中治理（先 `npm run format`，再分批处理 ESLint 规则告警或调整规则为 warning 不阻断）。
   - 若暂不作为硬门禁：在 release note 里记录为“技术债”，并约定治理窗口与负责人。

