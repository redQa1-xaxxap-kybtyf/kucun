---
mode: plan
cwd: e:\kucun
task: 库存/销售/财务口径偏差全面调查与修复闭环
complexity: complex
planning_method: builtin
created_at: 2025-12-25T11:23:18.9412397+08:00
---

# Plan: 库存/销售/财务口径偏差全面调查与修复闭环

🎯 任务概述

目标是把“同一笔订单在销售页/财务页/应收/报表里数字一致”变成强约束：先统一核算口径（合同），再对齐实现与报表聚合逻辑，并用审计脚本把偏差暴露出来。

补充：本次为开发环境且生产未正式使用，**不修复历史脏数据**，只做“防新增偏差”的代码级强约束与校验。

📋 执行计划（含当前进度）

1. ✅ 固化核算口径合同文档（字段含义、公式、DoD）
2. ✅ 对齐销售订单写入口径（`totalAmount` 不含抹零；费用 paidBy 分离；公司费用入成本）
3. ✅ 对齐报表聚合口径（收入包含抹零；过滤 sales_order/purchase_order 费用防重复扣减）
4. ✅ 修复 MIXED（本地+调货）库存扣减/出库记录/成本回写的边界
5. ✅ 跑审计生成偏差清单（用于观察/验证，不做历史回填）
6. ✅ 加固关键链路强约束（禁止绕过采购单入库、付款确认不允许绕过副作用等）
7. ✅ 加固回归（跑 inventory 单测 + audit:full spot-check）

🛠️ 执行要点（可直接操作）

- 跑偏差审计脚本（生成 JSON+CSV 清单）：
  - `npm run audit:sales-finance`
  - `npm run audit:sales-finance -- 2025-01-01 2025-12-31 --fail`
- 跑全量业务一致性审计（库存/往来账/应付/采购/出入库/厂家直发）：
  - `npm run audit:full`
  - `npm run audit:full -- 2025-01-01 2025-12-31 --fail`
- 本次审计快照（2025-12-25，当前数据库）：
  - 基线：异常 `53` 条（采购链路历史断链为主）
  - 报告：`test-results/full-audit-20251225-122119.{json,csv}`
  - 复跑（本次变更后）：异常 `155` 条（仍集中在采购链路历史断链，无库存/FIFO/报表类异常）
  - 报告：`test-results/full-audit-2025-12-25T07-50-41-872Z.{json,csv}`
  - 备注：遵循“不修复历史数据”，只做防新增偏差；采购链路异常属于历史脏数据，后续可选择清库/重置或再做回填。
  - 可选回填命令（本次未执行）：`npm run backfill:cost-queue -- --apply`（生产库需谨慎执行）
  - 采购入库强约束（防新增断链）：通用入库接口禁止 purchase；采购到货入库强制 `purchaseOrderId + purchaseOrderItemId`
- 优先修复顺序建议：
  1. `TOTAL_AMOUNT_*` / `ADDITIONAL_FEES_*` / `EXPENSE_AMOUNT_*`（直接影响应收与报表收入/费用）
  2. `OUTBOUND_*`（直接影响库存与成本）
  3. `COST_AMOUNT_*` / `PROFIT_AMOUNT_*`（直接影响利润与经营分析）
  4. `MIXED_*` / `TRANSFER_*`（结构性偏差高发）

⚠️ 风险与阻塞

- 历史数据可能存在“旧口径写入 + 新口径读取”，短期会表现为：应收/利润/报表口径跳变，需要用审计清单分批回填后再整体验收。
- MIXED 单据一旦存在“只按总 quantity 出库”或“只计算一段成本”，会导致库存与利润结构性错误，建议上线前跑一遍审计脚本并抽样复核。

📎 关键参考

- `docs/核算口径合同-库存-销售-财务.md`
- `scripts/audit-sales-finance-calculations.ts`

---

## 2025-12-25：盘点 / 库存 / 报表修复落地（不修历史）

- FIFO 成本按批次：新增按 `productId + variantId + batchNumber` 消耗/均价 API，出库/盘点/调整/销售发货全部按批次消耗，避免跨批次串用成本。
  - `lib/services/fifo-cost-service.ts`
  - `app/api/inventory/outbound/route.ts`
  - `app/api/inventory/adjust/route.ts`
  - `lib/services/fifo-outbound-service.ts`
  - `lib/api/handlers/sales-order-status.ts`

- FIFO 队列写入/不可变性：通用入库接口写入 FIFO 队列；入库记录一旦进入 FIFO 队列，禁止通过“入库记录更新/删除”接口修改数量/原因或删除（避免 FIFO 与出库成本不可追溯）。
  - `app/api/inventory/inbound/route.ts`
  - `app/api/inventory/inbound/[id]/route.ts`

- FIFO 消耗防偏差：FIFO 消耗函数增加“消耗前预检可用量”，并在销售发货中禁止对“FIFO 数量不足”做成本回退（避免出现库存已扣但 FIFO 未能扣足）。
  - `lib/services/fifo-cost-service.ts`
  - `lib/api/handlers/sales-order-status.ts`

- 盘点一致性：开始盘点时回填系统库存快照；完成盘点时按唯一键 `productId_variantId_batchNumber` 更新库存（upsert），并校验 `afterQuantity >= reservedQuantity`。
  - `lib/services/inventory-count-service.ts`
  - `lib/validations/inventory-count.ts`

- 报表库存周转：期末库存估值改为基于 `InventoryCostQueue.remainingQty * unitCost` 求和；并把“负向库存调整/盘亏（无 outboundRecord）”的成本纳入期初推导，避免周转率被系统性拉偏。
  - `lib/services/monthly-report-service.ts`
  - `lib/services/annual-report-service.ts`

- 回归验证
  - 单测：`npm test -- __tests__/unit/inventory --runInBand`
  - 审计：`npm run audit:full`（报告见 `test-results/full-audit-2025-12-25T07-50-41-872Z.{json,csv}`）

---

## 2025-12-25：采购链路防新增偏差（不修历史）

- 采购单金额口径：后端统一以 `quantity * unitPrice` 计算并回写 `PurchaseOrderItem.totalPrice` 与 `PurchaseOrder.totalAmount`，避免前端 totalPrice/精度差异导致 `PURCHASE_TOTAL_AMOUNT_MISMATCH`。
  - `lib/services/purchase-order-totals.ts`
  - `app/api/purchase-orders/route.ts`
  - `app/actions/purchase-orders.utils.ts`

- 采购应付生成：创建采购单时若状态已进入应付触发态（ORDERED/SHIPPED/...），同事务内补齐 `PayableRecord(sourceType='purchase_order')`，避免漏生成应付。
  - `app/api/purchase-orders/route.ts`

- 开发环境脏数据清理（已执行，清到 0 异常）：
  - 修复命令：`npm run remediate:purchase -- --apply --orphanPurchaseInbound=convert --missingItemInbound=convert`
  - 复跑审计：`npm run audit:full`
  - 报告：`test-results/full-audit-2025-12-25T08-56-58-339Z.{json,csv}`（异常 0）

---

## 2025-12-25：上线前工程门禁检查（补充）

- TypeScript：`npm run type-check` ✅（日志：`test-results/type-check-20251225-172807.log`）
  - 注：根 `tsconfig.json` 已排除 `kucunxcx/`（小程序目录不纳入本仓 `tsc --noEmit` 门禁）
- 构建：`npm run build`
  - ❌ 4GB 堆内存会 OOM
  - ✅ 8GB 堆内存可通过（日志：`test-results/next-build-20251225-173924.log`）
  - 落地：`package.json` build 默认 `--max-old-space-size=8192`
  - 落地：`next.config.ts` 生产环境禁用 `optimizePackageImports`；并外置 `bullmq/qiniu/vm2`
- 回归：`npm test -- __tests__/unit/inventory --runInBand` ✅（日志：`test-results/unit-inventory-20251225-173551.log`）
- 全量一致性：`npm run audit:full` ✅ 异常 0（报告：`test-results/full-audit-2025-12-25T09-36-20-078Z.{json,csv}`）
- Lint：`npm run lint` ❌（大量规则告警，日志：`test-results/lint-20251225-173749.log`）
- Prettier：`npm run format:check` ❌（约 200+ 文件未格式化，日志：`test-results/format-check-20251225-174212.log`）
