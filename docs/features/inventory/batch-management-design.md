# 批次管理优化方案

## ✅ 实施状态: 已完成阶段 1-3

**最后更新**: 2025-01-05

---

## 📋 需求分析

### 业务场景

- 仓库进货时,新到货的产品可能与现有库存属于同一批次或不同批次
- 需要支持批次级别的成本核算和库存管理
- 需要追溯每个批次的采购来源、成本、库存变化

### 现有系统分析

#### ✅ 已有功能

1. **成本核算**: 系统已区分裸价(`unitPrice`)和成本单价(`unitCost`)
2. **费用分摊**: 已有`allocatedExpense`字段记录分摊的费用
3. **库存批次**: `Inventory`表已有`batchNumber`字段和批次唯一约束
4. **批次规格**: 已有`BatchSpecification`表管理批次规格信息

#### ❌ 缺失功能

1. **采购订单与批次关联**: `PurchaseOrderItem`缺少批次号字段
2. **批次自动生成**: 没有批次号生成规则
3. **批次选择UI**: 没有批次选择器组件
4. **批次匹配逻辑**: 没有自动匹配现有批次的功能

---

## 🎯 优化方案

### 方案选择: **渐进式优化**

采用最小化改动的方式,在现有系统基础上增加批次支持,避免大规模重构。

---

## 📐 数据模型设计

### 1. 修改 `PurchaseOrderItem` 表

```prisma
model PurchaseOrderItem {
  id              String  @id @default(uuid()) @db.Char(36)
  purchaseOrderId String  @map("purchase_order_id") @db.Char(36)
  productId       String? @map("product_id") @db.Char(36)
  supplierId      String  @map("supplier_id") @db.Char(36)
  productCode     String  @map("product_code") @db.VarChar(100)

  // ✅ 新增: 批次管理字段
  batchNumber     String? @map("batch_number") @db.VarChar(100)
  batchId         String? @map("batch_id") @db.Char(36)  // 可选: 关联到独立的批次表

  // 产品信息
  displayName   String  @map("display_name")
  specification String? @db.Text
  unit          String  @default("piece")
  weight        Float?

  // 数量和价格
  quantity   Float @map("quantity")
  unitPrice  Float @map("unit_price")        // 裸价(供应商报价)
  totalPrice Float @map("total_price")       // 小计(裸价 × 数量)

  // 成本字段
  unitCost         Float? @map("unit_cost")         // 成本单价(含费用分摊)
  allocatedExpense Float? @default(0) @map("allocated_expense")  // 分摊的费用

  // ... 其他字段保持不变

  // ✅ 新增: 索引
  @@index([batchNumber], map: "idx_purchase_order_items_batch")
}
```

### 2. 批次号录入规则

**格式**: 自由输入（系统不强制格式，仅做去空格与长度校验）

**示例**:

- `供应商LOT号-20250105`
- `色号A-批次3`

**录入原则**:

1. 批次号以供应商提供的批次/色号为优先（便于追溯）
2. 同一产品+规格(variant)+批次号 视为同一批次库存
3. 生产日期仅作为辅助筛选条件，不会被系统推导为批次号写回

### 3. 批次匹配逻辑

**匹配条件**:

- 相同产品ID (`productId`)
- 相同供应商ID (`supplierId`)
- 相同采购单价 (`unitPrice`) - 允许±5%的误差
- 库存数量 > 0

**匹配结果**:

```typescript
interface ExistingBatch {
  batchNumber: string;
  supplierId: string;
  supplierName: string;
  unitCost: number;
  quantity: number;
  createdAt: Date;
  lastPurchaseDate: Date;
}
```

---

## 🔧 实施步骤

### 阶段 1: 数据库迁移 (1-2小时)

1. **创建 Prisma 迁移文件**

   ```bash
   npx prisma migrate dev --name add_batch_to_purchase_order_items
   ```

2. **迁移内容**:
   - 在`purchase_order_items`表增加`batch_number`字段
   - 添加索引`idx_purchase_order_items_batch`
   - 为现有数据生成默认批次号(可选)

3. **数据迁移策略**:
   - **方案 A**: 现有数据不生成批次号,保持`NULL`
   - **方案 B**: 为现有数据生成批次号,格式: `LEGACY-{订单号}-{行号}`

### 阶段 2: API 层实现 (2-3小时)

1. **更新 Zod Schema** (`lib/validations/purchase-order.ts`)

   ```typescript
   export const purchaseOrderItemSchema = z.object({
     // ... 现有字段
     batchNumber: z
       .string()
       .max(100, '批次号不能超过100个字符')
       .optional()
       .or(z.literal('')),
   });
   ```

2. **创建批次查询 API** (`app/api/batches/route.ts`)
   - `GET /api/batches?productId={id}&supplierId={id}` - 查询现有批次
   - `POST /api/batches/generate` - 生成新批次号

3. **更新采购订单创建逻辑** (`app/actions/purchase-orders.ts`)
   - 保存批次号到`purchase_order_items`表
   - 入库时更新`inventory`表的批次信息

### 阶段 3: UI 组件实现 (3-4小时)

1. **创建批次选择器组件** (`components/batches/batch-selector.tsx`)
   - 显示现有批次列表
   - 支持手动输入新批次号
   - 显示批次详情(供应商、成本、库存等)

2. **更新采购订单表格** (`components/purchase-orders/purchase-order-items-table.tsx`)
   - 增加"批次号"列
   - 集成批次选择器
   - 显示批次匹配提示

3. **批次信息展示**
   - 鼠标悬停显示批次详情
   - 批次匹配状态指示器(新批次/合并批次)

### 阶段 4: 测试与验证 (1-2小时)

1. **单元测试**
   - 批次号生成逻辑
   - 批次匹配算法
   - Zod Schema 验证

2. **集成测试**
   - 创建采购订单并指定批次
   - 查询现有批次
   - 批次合并场景

3. **E2E 测试**
   - 完整的采购流程
   - 批次选择交互
   - 库存更新验证

---

## 💡 关键决策点

### 决策 1: 批次号存储方式

**选项 A**: 只存储批次号字符串 (推荐)

- ✅ 简单直接,易于实现
- ✅ 与现有`Inventory`表设计一致
- ❌ 批次信息分散在多个表中

**选项 B**: 创建独立的`Batch`表

- ✅ 批次信息集中管理
- ✅ 便于扩展批次属性
- ❌ 需要额外的表和关联关系
- ❌ 增加系统复杂度

**建议**: 采用**选项 A**,与现有系统保持一致。

### 决策 2: 批次匹配策略

**自动匹配**: 系统根据规则自动建议批次

- ✅ 用户体验好
- ❌ 可能误匹配

**手动选择**: 用户完全手动选择或输入批次

- ✅ 灵活可控
- ❌ 用户操作繁琐

**建议**: **自动建议 + 手动确认**

- 系统自动匹配并高亮推荐批次
- 用户可以选择推荐批次或创建新批次
- 提供批次详情供用户判断

### 决策 3: 成本核算方式

**当前系统**: 裸价 + 费用分摊 = 成本单价

**保持不变**: 继续使用现有逻辑

- ✅ 无需修改成本核算代码
- ✅ 与现有数据兼容

**建议**: **保持现有成本核算方式**,只增加批次维度。

---

## 📊 影响范围分析

### 直接影响的模块

1. **采购订单模块**
   - 采购订单表单
   - 采购订单明细表格
   - 采购订单API

2. **库存模块**
   - 入库操作(需要关联批次)
   - 库存查询(按批次查询)
   - 库存调整(批次级别)

3. **销售订单模块** (间接影响)
   - 出库时需要指定批次
   - 成本核算需要使用批次成本

### 需要更新的文件

#### Prisma Schema

- `prisma/schema.prisma` - 增加批次字段

#### Zod Validation

- `lib/validations/purchase-order.ts` - 增加批次验证

#### API Routes

- `app/api/batches/route.ts` - 新建批次查询API
- `app/actions/purchase-orders.ts` - 更新创建逻辑

#### Components

- `components/batches/batch-selector.tsx` - 新建批次选择器
- `components/purchase-orders/purchase-order-items-table.tsx` - 增加批次列
- `components/purchase-orders/purchase-order-form.tsx` - 集成批次选择

#### Types

- `lib/types/batch.ts` - 新建批次类型定义
- `lib/types/purchase-order.ts` - 更新采购订单类型

---

## 🚀 下一步行动

请确认以下问题后,我将开始实施:

1. **批次号录入口径**: 是否确认“自由输入，不做强制格式”?
2. **现有数据处理**: 是否需要为现有采购订单生成批次号?
3. **批次匹配条件**: 是否采用"相同产品+相同供应商+相似单价"的匹配规则?
4. **实施优先级**: 是否按照上述阶段顺序实施?

确认后,我将立即开始实施!
