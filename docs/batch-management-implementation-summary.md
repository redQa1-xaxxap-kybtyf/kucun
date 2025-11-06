# 批次管理功能实施总结

**实施日期**: 2025-01-05  
**状态**: ✅ 已完成阶段 1-3  
**版本**: v1.0

---

## 📋 需求回顾

### 业务需求

在"仓库进货"(采购订单入库)时,支持批次管理功能:

1. **批次号管理**: 用户手动输入或选择批次号(不自动生成)
2. **批次匹配**: 自动查询是否存在匹配的现有批次
3. **匹配条件**: 相同供应商 + 相同产品编码 + 相同产品ID + 相同规格
4. **用户选择**: 合并到现有批次 或 创建新批次

---

## ✅ 已完成的工作

### 1. 数据库层 (Database Layer)

#### 1.1 Schema 修改

**文件**: `prisma/schema.prisma`

**修改内容**:

```prisma
model PurchaseOrderItem {
  // ... 其他字段

  // ✅ 新增: 批次管理
  batchNumber String? @map("batch_number") @db.VarChar(100)

  // ✅ 新增: 批次号索引
  @@index([batchNumber], map: "idx_purchase_order_items_batch")
}
```

#### 1.2 数据库迁移

**迁移文件**: `prisma/migrations/20251105065454_add_batch_number_to_purchase_order_items/migration.sql`

**执行状态**: ✅ 已成功执行

**SQL 内容**:

```sql
-- AlterTable
ALTER TABLE `purchase_order_items`
  ADD COLUMN `batch_number` VARCHAR(100) NULL;

-- CreateIndex
CREATE INDEX `idx_purchase_order_items_batch`
  ON `purchase_order_items`(`batch_number`);
```

---

### 2. 类型定义层 (Type Definitions)

#### 2.1 批次类型定义

**文件**: `lib/types/batch.ts` (新建)

**内容**:

```typescript
// 现有批次信息
export interface ExistingBatch {
  batchNumber: string;
  productId: string;
  productCode: string;
  productName: string;
  specification: string | null;
  supplierId: string;
  supplierName: string;
  quantity: number;
  unitCost: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// 批次匹配查询参数
export interface BatchMatchQuery {
  productId: string;
  productCode: string;
  supplierId: string;
  specification?: string;
}

// 批次匹配结果
export interface BatchMatchResult {
  hasMatch: boolean;
  batches: ExistingBatch[];
  count: number;
}
```

#### 2.2 Zod 验证 Schema

**文件**: `lib/validations/purchase-order.ts`

**修改内容**:

```typescript
export const purchaseOrderItemSchema = z.object({
  // ... 其他字段

  // ✅ 新增: 批次号验证
  batchNumber: z
    .string()
    .max(100, '批次号不能超过100个字符')
    .optional()
    .or(z.literal('')),
});
```

---

### 3. API 层 (API Layer)

#### 3.1 批次匹配 API

**文件**: `app/api/batches/match/route.ts` (新建)

**端点**: `GET /api/batches/match`

**查询参数**:

- `productId` (必需): 产品ID
- `productCode` (必需): 产品编码
- `supplierId` (必需): 供应商ID
- `specification` (可选): 规格

**返回格式**:

```typescript
{
  data: {
    hasMatch: boolean;
    batches: ExistingBatch[];
    count: number;
  },
  error: null
}
```

**核心逻辑**:

1. 验证查询参数
2. 查询 `inventory` 表,匹配条件:
   - 相同 `productId`
   - `batchNumber` 不为空
   - `quantity > 0`
   - 相同 `productCode`
   - 相同 `specification` (如果提供)
3. 查询 `purchase_order_items` 获取供应商信息
4. 过滤出相同供应商的批次
5. 返回匹配结果

---

### 4. UI 组件层 (UI Components)

#### 4.1 批次选择器组件

**文件**: `components/batches/batch-selector.tsx` (新建)

**功能特性**:

- ✅ 自动查询匹配批次 (使用 TanStack Query)
- ✅ 显示现有批次列表 (批次号、库存、成本、日期)
- ✅ 支持选择现有批次
- ✅ 支持手动输入新批次号
- ✅ 显示匹配批次数量徽章
- ✅ 两种模式切换: 选择模式 / 手动输入模式

**Query Key**:

```typescript
['batches', 'match', productId, productCode, supplierId, specification];
```

**Props**:

```typescript
interface BatchSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  productId?: string;
  productCode?: string;
  supplierId?: string;
  specification?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}
```

#### 4.2 采购订单表格集成

**文件**: `components/purchase-orders/purchase-order-items-table.tsx`

**修改内容**:

1. ✅ 导入 `BatchSelector` 组件
2. ✅ 添加"批次号"列头
3. ✅ 在规格列和数量列之间插入批次选择器单元格
4. ✅ 传递必要的 props: `productId`, `productCode`, `supplierId`, `specification`

**代码示例**:

```typescript
<TableCell className="border-r">
  <FormField
    control={form.control}
    name={`items.${index}.batchNumber`}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <BatchSelector
            value={field.value}
            onValueChange={field.onChange}
            productId={form.watch(`items.${index}.productId`)}
            productCode={form.watch(`items.${index}.productCode`)}
            supplierId={form.watch(`items.${index}.supplierId`)}
            specification={form.watch(`items.${index}.specification`)}
            placeholder="选择或输入批次号"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</TableCell>
```

#### 4.3 采购订单表单更新

**文件**: `components/purchase-orders/purchase-order-form.tsx`

**修改内容**:

```typescript
const createEmptyItem = () => ({
  // ... 其他字段
  batchNumber: '', // ✅ 新增
});
```

---

## 🎯 核心技术实现

### 1. 批次匹配算法

**匹配条件** (所有条件必须同时满足):

```typescript
WHERE
  productId = :productId AND
  batchNumber IS NOT NULL AND
  quantity > 0 AND
  product.code = :productCode AND
  product.specification = :specification AND  // 如果提供
  supplier.id = :supplierId
```

### 2. 数据流

```
用户选择产品和供应商
    ↓
BatchSelector 自动触发查询
    ↓
GET /api/batches/match?productId=xxx&productCode=xxx&supplierId=xxx
    ↓
查询 inventory 表 + purchase_order_items 表
    ↓
返回匹配的批次列表
    ↓
用户选择现有批次 或 手动输入新批次号
    ↓
更新表单字段 batchNumber
    ↓
提交采购订单时保存批次号
```

### 3. 缓存策略

**TanStack Query 配置**:

```typescript
{
  queryKey: ['batches', 'match', productId, productCode, supplierId, specification],
  staleTime: 30 * 1000,  // 30秒缓存
  enabled: !!productId && !!productCode && !!supplierId,  // 条件查询
}
```

---

## 📊 测试验证

### 测试清单

- [x] 数据库迁移成功执行
- [x] TypeScript 类型检查通过 (新文件)
- [x] ESLint 检查通过 (0 errors, 5 warnings)
- [ ] 浏览器功能测试 (待用户验证)
  - [ ] 选择产品和供应商后,批次选择器显示
  - [ ] 如果存在匹配批次,显示批次列表
  - [ ] 可以选择现有批次
  - [ ] 可以手动输入新批次号
  - [ ] 提交采购订单时,批次号正确保存

---

## 🚀 下一步计划

### 短期任务

1. **用户验证**: 在浏览器中测试批次选择功能
2. **Bug 修复**: 根据测试结果修复问题
3. **性能优化**: 如果批次数量很多,考虑分页或虚拟滚动

### 中期任务

1. **批次详情页**: 创建批次详情查看页面
2. **批次历史**: 显示批次的进货和出货历史
3. **批次报表**: 批次库存报表、批次成本分析

### 长期任务

1. **批次追溯**: 完整的批次追溯功能 (从采购到销售)
2. **批次预警**: 库存不足、临期预警
3. **批次合并**: 支持批次合并操作

---

## 📝 技术债务

### 代码质量

- ⚠️ `BatchSelector` 组件函数过长 (211行,建议拆分)
- ⚠️ `GET /api/batches/match` 函数过长 (138行,建议拆分)
- ⚠️ 采购订单表格组件函数过长 (建议重构)

### 建议改进

1. **拆分 BatchSelector**: 提取子组件 `BatchList`, `BatchItem`, `ManualInput`
2. **拆分 API 函数**: 提取 `validateParams`, `queryInventory`, `querySuppliers`, `formatResult`
3. **重构表格组件**: 提取 `TableRow` 为独立组件

---

## 🎓 遵循的原则

### KISS (简单至上)

- ✅ 批次号由用户手动输入,不自动生成
- ✅ 匹配逻辑简单明确: 供应商 + 产品 + 规格
- ✅ UI 交互直观: 选择现有 或 输入新批次

### YAGNI (精益求精)

- ✅ 只实现当前需要的功能,不过度设计
- ✅ 不实现批次号自动生成规则
- ✅ 不实现复杂的批次合并逻辑

### DRY (杜绝重复)

- ✅ 批次类型定义集中在 `lib/types/batch.ts`
- ✅ 批次验证逻辑复用 Zod Schema
- ✅ 批次查询逻辑封装在 API 中

### SOLID

- ✅ **单一职责**: BatchSelector 只负责批次选择
- ✅ **开放/封闭**: 通过 props 扩展功能,不修改组件内部
- ✅ **依赖倒置**: 依赖抽象接口 (BatchMatchResult),不依赖具体实现

---

**实施完成时间**: 2025-01-05  
**总耗时**: 约 2 小时  
**状态**: ✅ 核心功能已完成,等待用户验证
