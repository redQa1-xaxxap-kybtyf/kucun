# 阶段3：费用回填到应付款操作指南

## 概述

`scripts/backfill-expenses-to-payables.ts` 脚本用于将历史已审批费用批量关联到应付款记录，实现应付账款与费用的完整集成。

## 功能特性

✅ **智能合并**：按供应商+来源（sourceType+sourceId）自动合并费用到应付款
✅ **安全预览**：支持 dry-run 模式，预览操作而不实际执行
✅ **批量处理**：可自定义批次大小，避免内存溢出
✅ **详细报告**：生成 CSV 格式的对账报告，包含所有操作详情
✅ **容错机制**：支持遇到错误继续处理，不中断整个流程
✅ **自动验证**：完成后自动抽样验证数据一致性（≥30条）

## 使用方式

### 1. 预览模式（推荐先运行）

```bash
npx tsx scripts/backfill-expenses-to-payables.ts --dry-run
```

**输出示例：**

```
🚀 开始费用回填到应付款...

📦 找到 125 条符合条件的费用记录

📦 处理批次 1/2 (1-100/125)
  ✅ FY202501-0001: created → FY202501-PAY-0001
  🔗 FY202501-0002: merged → FY202501-PAY-0001
  ⏭️  FY202501-0003: skipped → FY202501-PAY-0002
  ...

============================================================
📊 回填统计摘要
============================================================
模式: 🔍 预览模式（Dry Run）
总费用记录数: 125
已处理: 125
  ✅ 创建新应付款: 45
  🔗 合并到现有应付款: 75
  ⏭️  跳过（已关联）: 3
  ❌ 失败: 2
============================================================
```

### 2. 实际执行（确认无误后）

```bash
npx tsx scripts/backfill-expenses-to-payables.ts
```

### 3. 自定义批次大小

```bash
# 每批处理50条（默认100条）
npx tsx scripts/backfill-expenses-to-payables.ts --batch-size=50
```

### 4. 导出 CSV 报告

```bash
npx tsx scripts/backfill-expenses-to-payables.ts --export-csv
```

**CSV 报告位置：** `E:\kucun\claudedocs\backfill-report-{timestamp}.csv`

**CSV 格式：**

```csv
费用ID,费用编号,费用金额,供应商ID,操作结果,应付款ID,应付款编号,错误信息
cm62a5vup0001,FY202501-0001,1500.00,supplier-001,created,payable-001,FY202501-PAY-0001,
cm62a5vup0002,FY202501-0002,800.00,supplier-001,merged,payable-001,FY202501-PAY-0001,
cm62a5vup0003,FY202501-0003,2000.00,supplier-002,failed,,,金额超过限制
```

### 5. 容错模式（遇到错误继续）

```bash
npx tsx scripts/backfill-expenses-to-payables.ts --continue-on-error
```

### 6. 完整命令组合

```bash
# 预览模式 + 导出报告 + 自定义批次
npx tsx scripts/backfill-expenses-to-payables.ts --dry-run --export-csv --batch-size=50

# 执行模式 + 容错 + 导出报告
npx tsx scripts/backfill-expenses-to-payables.ts --continue-on-error --export-csv
```

## 处理逻辑

### 筛选条件

脚本仅处理满足以下**所有**条件的费用记录：

1. ✅ `status = 'approved'`（已审批）
2. ✅ `payableId = null`（未关联应付款）
3. ✅ `expenseAmount > 0`（金额大于0）
4. ✅ `supplierId != null`（有关联供应商）

### 合并策略（merge）

按以下维度分组合并费用到应付款：

- **supplierId**：相同供应商
- **sourceType**：相同来源类型（sales_order/factory_shipment/purchase_order/other）
- **sourceId**：相同来源ID

**示例：**

```
费用1：供应商A + 销售订单001 + 金额1000 → 应付款PAY-001（新建）
费用2：供应商A + 销售订单001 + 金额500  → 应付款PAY-001（合并，累加金额）
费用3：供应商A + 销售订单002 + 金额800  → 应付款PAY-002（新建）
```

### 幂等性保证

- 重复运行脚本不会产生重复应付款
- 已关联应付款的费用会被跳过（action: 'skipped'）
- 使用 expenseId 去重，避免重复合并

## 数据验证

### 自动抽样验证

执行完成后，脚本会自动：

1. 随机抽取最多 30 条记录
2. 验证费用的 `payableId` 是否正确关联
3. 输出验证结果

**验证通过示例：**

```
🔍 验证数据一致性...
抽样验证 30 条记录...
  ✅ 抽样验证通过 (30/30)
```

**验证失败示例：**

```
🔍 验证数据一致性...
抽样验证 30 条记录...
  ❌ 验证失败: FY202501-0005 的 payableId 不匹配
  ❌ 验证失败: 2/30 条记录不一致
```

### 手动验证查询

```sql
-- 检查所有已审批费用的应付款关联情况
SELECT
  e.expenseNumber,
  e.expenseAmount,
  e.supplierId,
  e.payableId,
  p.payableNumber,
  p.payableAmount,
  p.status
FROM ExpenseRecord e
LEFT JOIN PayableRecord p ON e.payableId = p.id
WHERE e.status = 'approved'
  AND e.expenseAmount > 0
  AND e.supplierId IS NOT NULL
ORDER BY e.approvedAt DESC
LIMIT 50;

-- 检查应付款金额一致性
SELECT
  p.payableNumber,
  p.payableAmount AS "应付款金额",
  SUM(e.expenseAmount) AS "关联费用总额",
  p.payableAmount - SUM(e.expenseAmount) AS "差异"
FROM PayableRecord p
INNER JOIN ExpenseRecord e ON e.payableId = p.id
GROUP BY p.id, p.payableNumber, p.payableAmount
HAVING ABS(p.payableAmount - SUM(e.expenseAmount)) > 0.01
ORDER BY ABS(p.payableAmount - SUM(e.expenseAmount)) DESC;
```

## 错误处理

### 常见错误及解决方案

#### 1. 功能未启用

```
❌ 功能未启用: EXPENSE_TO_PAYABLE_ENABLED=false
```

**解决：** 在 `.env` 中设置 `EXPENSE_TO_PAYABLE_ENABLED=true`

#### 2. 供应商不存在

```
❌ FY202501-0005: 失败 - 供应商不存在
```

**解决：** 检查费用记录的 `supplierId` 是否有效，或使用 `--continue-on-error` 跳过

#### 3. 金额验证失败

```
❌ FY202501-0008: 失败 - 付款金额超过应付金额
```

**解决：** 检查应付款记录的 `remainingAmount` 是否足够

#### 4. 数据库连接失败

```
❌ 回填过程失败: PrismaClientKnownRequestError: ...
```

**解决：** 检查 `DATABASE_URL` 配置，确保数据库可访问

### 错误日志

所有错误都会记录到：

- **控制台输出**：实时显示错误信息
- **应用日志**：`logger.error('backfill', ...)`
- **CSV 报告**：包含错误详情

## 性能建议

### 数据量 < 1000 条

```bash
# 默认配置即可
npx tsx scripts/backfill-expenses-to-payables.ts
```

### 数据量 1000-10000 条

```bash
# 减小批次，避免内存压力
npx tsx scripts/backfill-expenses-to-payables.ts --batch-size=50
```

### 数据量 > 10000 条

```bash
# 分批执行，使用游标分页
# 修改脚本添加 --cursor 参数，或分时段执行
```

## 回滚方案

如果需要回滚回填操作：

### 方案1：软回滚（推荐）

```sql
-- 仅断开费用与应付款的关联，保留应付款记录
UPDATE ExpenseRecord
SET payableId = NULL
WHERE payableId IN (
  SELECT id FROM PayableRecord
  WHERE createdAt > '2025-11-22 00:00:00'  -- 回填开始时间
);
```

### 方案2：硬回滚（谨慎使用）

```sql
-- 删除回填创建的应付款记录（需先检查无关联付款）
BEGIN TRANSACTION;

-- 1. 断开费用关联
UPDATE ExpenseRecord
SET payableId = NULL
WHERE payableId IN (
  SELECT id FROM PayableRecord
  WHERE createdAt > '2025-11-22 00:00:00'
  AND NOT EXISTS (
    SELECT 1 FROM PaymentOutRecord
    WHERE payableRecordId = PayableRecord.id
  )
);

-- 2. 删除无付款关联的应付款
DELETE FROM PayableRecord
WHERE createdAt > '2025-11-22 00:00:00'
  AND NOT EXISTS (
    SELECT 1 FROM PaymentOutRecord
    WHERE payableRecordId = PayableRecord.id
  );

COMMIT;
```

## 前置检查清单

执行回填前，请确认：

- [ ] `EXPENSE_TO_PAYABLE_ENABLED=true` 已设置
- [ ] `EXPENSE_TO_PAYABLE_STRATEGY=merge` 已设置
- [ ] 数据库备份已完成
- [ ] 已在预览模式下运行并检查结果
- [ ] 已审查 CSV 报告，确认无异常
- [ ] 已通知相关人员暂停费用审批操作（避免并发冲突）
- [ ] 生产环境建议在低峰期执行

## 后续维护

### 定期监控

```sql
-- 检查未关联应付款的已审批费用数量
SELECT COUNT(*) AS "未关联费用数"
FROM ExpenseRecord
WHERE status = 'approved'
  AND payableId IS NULL
  AND expenseAmount > 0
  AND supplierId IS NOT NULL;
```

**预期结果：** 0（所有已审批费用应自动关联应付款）

### 异常排查

如果发现未关联费用持续增长：

1. 检查 `EXPENSE_TO_PAYABLE_ENABLED` 是否被意外禁用
2. 检查 `expense-service.ts` 中的集成逻辑是否正常
3. 查看应用日志中的警告信息

## 支持

如有问题，请联系技术支持团队并提供：

- 执行的完整命令
- 控制台输出
- CSV 报告文件
- 相关费用编号或应付款编号
