# FIFO（先进先出）深度审计（2026-01）

## 结论（先说风险点）

当前 FIFO 体系总体具备“事务内出入库 + 成本队列消耗 + 缺口自动补齐”的闭环，但存在 4 类需要重点关注的问题：

1. **一致性边界**：系统只做“FIFO 缺口补齐”，不处理 FIFO 过量；一旦出现 `Σcost_queue.remainingQty > inventory.quantity`，需要人工/脚本介入。
2. **并发极限**：FIFO 消耗对单批次的并发重试次数有限，极端并发下存在“未成功消耗但游标前进导致误判库存不足”的理论风险。
3. **时间真源**：`inboundDate` 在不同链路来源不完全一致（应用侧 `new Date()` vs 记录 `createdAt`），多实例/时钟漂移会影响 FIFO 顺序稳定性。
4. **可追溯性**：出库记录只落汇总成本（unitCost/totalCost），未落“消耗明细”（对应哪些 inboundRecordId/数量/成本）；虽然已有 `fifo_consumption_ledger` 表，但当前未写入使用。

> 本次已落地两个“确定性 bug/风险”修复：入库记录更新的 `totalCost` 随数量联动、FIFO 缺口补齐的成本推断优先级（见“已落地修复”）。

---

## 数据模型与真源

### 关键表

- FIFO 成本队列：`InventoryCostQueue`（`prisma/schema.prisma:513`）
  - 关键字段：`remainingQty`（可用量）、`unitCost`（单位成本）、`inboundDate`（FIFO 排序关键）、`inboundRecordId`（追溯）
- 入库记录：`InboundRecord`（`prisma/schema.prisma:462`）
- 出库记录：`OutboundRecord`（`prisma/schema.prisma:545`）
- （未接入）FIFO 消耗台账：`FifoConsumptionLedger`（`prisma/schema.prisma:1639`）

### 业务不变量（建议写成“门禁 + 审计”）

1. **库存口径一致**：对同一 SKU（`productId+variantId+batchNumber`）
   - 期望：`Σ InventoryCostQueue.remainingQty == Inventory.quantity`
   - 审计脚本已有实现：`scripts/audit-full.ts:473`
2. **入库落队列**：业务入库（含盘盈/调整正向/采购到货）应写入 `InventoryCostQueue`
3. **出库消耗队列**：业务出库（含销售发货/盘亏/调整负向/手动出库）应消耗 `InventoryCostQueue`

---

## 关键链路复核（写/读/消耗）

### 入库（写入 FIFO）

- 通用入库 API：`app/api/inventory/inbound/route.ts:1`
  - 创建入库记录后 `addToFIFOQueue(...)`
- 采购到货入库（最小事务）：`lib/api/minimal-inbound-transaction.ts:1`
  - `inboundRecord.create` → `addToFIFOQueue` → `inventory` 更新
- 库存调整（盘盈/手动正向）：`app/api/inventory/adjust/route.ts:1`
- 盘点盘盈：`lib/services/inventory-count-service.ts:1`

### 出库（消耗 FIFO）

- 手动出库 API：`app/api/inventory/outbound/route.ts:1`
  - 强制批次出库（batch 必填），并在事务内：
    - `ensureFIFOQueueMatchesInventory(...)`
    - `consumeFIFOQueueByBatch(...)`
- 销售发货出库：`lib/api/handlers/sales-order-status.ts:616`
- 库存调整（盘亏/手动负向）：`app/api/inventory/adjust/route.ts:1`
- 盘点盘亏：`lib/services/inventory-count-service.ts:1`

---

## 已落地修复

1. **入库记录更新时 totalCost 未同步**
   - 问题：`unitCost` 为 Decimal，`typeof unitCost === 'number'` 永远为 false，导致数量更新后 `totalCost` 保持旧值
   - 修复：改用 `toNumber()` 转换 Decimal
   - 文件：`app/api/inventory/inbound/[id]/route.ts:272`

2. **FIFO 缺口补齐成本推断优先级**
   - 变更：当 FIFO 队列非空时，优先使用“现存 FIFO 队列加权平均成本”，队列为空才回退到 `unitCostHint`
   - 文件：`lib/services/fifo-cost-service.ts:102`

---

## 仍需重点关注的风险（建议优先级）

### P0（会导致偶发“库存不足/成本异常”的线上事故）

- **并发下可能“误跳过可用批次”**
  - 位置：`consumeFIFOQueue` / `consumeFIFOQueueByBatch`
  - 触发条件：同一批次被多个事务高并发消耗，单批次并发重试耗尽后继续推进游标
  - 建议整改：
    1. 提升重试次数 + 加入 jitter backoff；或
    2. 重构为“每次只取最老一条 findFirst 再 updateMany”的稳健实现（牺牲部分性能换正确性）
  - 参考：`lib/services/fifo-cost-service.ts:443`

### P1（会导致 FIFO 顺序/成本在多实例下不稳定）

- **inboundDate 真源不一致**
  - 现状：部分链路用 `new Date()`，补齐/回填链路用 `inboundRecord.createdAt`
  - 风险：多进程/多机器时间漂移会改变 FIFO 顺序
  - 建议整改：统一 `inboundDate = inboundRecord.createdAt`（以 DB 写入时间为准），并写单测固化
  - 参考：`lib/api/minimal-inbound-transaction.ts:1`、`app/api/inventory/inbound/route.ts:1`、`lib/services/fifo-cost-service.ts:254`

### P1（会导致审计/追溯成本高）

- **缺少“消耗明细落库”**
  - 现状：出库记录只有汇总成本；无法回答“这笔出库消耗了哪些入库批次”
  - 建议：写入 `FifoConsumptionLedger`，`businessKey` 建议用 `outboundRecordId`/`adjustmentNumber` 等幂等业务键
  - 参考：`prisma/schema.prisma:1639`

### P2（需要运营/数据治理策略）

- **仅补齐缺口，不处理 FIFO 过量**
  - 需要配套：`scripts/audit-full.ts` + `scripts/backfill-inventory-cost-queue-from-inbound.ts`
  - 建议：为“过量”提供专用修复脚本（按最晚入库批次回滚 remainingQty），并强制审批/只允许运营执行

---

## 推荐的验证手段（可执行）

- 全量一致性审计（含 FIFO vs Inventory）：`scripts/audit-full.ts:473`
- 从入库记录回填 FIFO 队列（谨慎，默认 dry-run）：`scripts/backfill-inventory-cost-queue-from-inbound.ts:1`
- 增量一致性规则（P1 告警）：`lib/consistency/rules/R2_FifoInventoryConsistencyRule.ts:1`
