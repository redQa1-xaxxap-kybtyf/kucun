# Schema 迁移执行计划

> 基于差异分析报告，制定详细的迁移步骤和验证方案

## 📊 迁移概览

### 总体目标
将 `lib/schemas/` 目录中的所有 Zod Schema 迁移到 `lib/validations/` 目录，实现单一真理源（Single Source of Truth）。

### 影响范围
- **文件数量**: 7 个 schema 文件需要迁移
- **引用文件**: 约 20 个文件需要更新导入路径
- **风险等级**: 中等（有自动化测试和 TypeScript 类型检查保护）

---

## 🎯 第一批迁移：低风险独立模块

### 1.1 迁移 address.ts

#### 当前状态
- **源文件**: `lib/schemas/address.ts` (179 行)
- **目标文件**: `lib/validations/address.ts` (新建)
- **引用文件**: 0 个（未被使用）

#### 执行步骤
```bash
# 1. 移动文件
mv lib/schemas/address.ts lib/validations/address.ts

# 2. 验证
npm run lint
npm run type-check
```

#### 验证清单
- [ ] 文件移动成功
- [ ] ESLint 检查通过
- [ ] TypeScript 编译通过
- [ ] 无导入错误

---

### 1.2 迁移 layout.ts

#### 当前状态
- **源文件**: `lib/schemas/layout.ts` (272 行)
- **目标文件**: `lib/validations/layout.ts` (新建)
- **引用文件**: 0 个（未被使用）

#### 执行步骤
```bash
# 1. 移动文件
mv lib/schemas/layout.ts lib/validations/layout.ts

# 2. 验证
npm run lint
npm run type-check
```

#### 验证清单
- [ ] 文件移动成功
- [ ] ESLint 检查通过
- [ ] TypeScript 编译通过
- [ ] 无导入错误

---

## 🎯 第二批迁移：中等风险有引用模块

### 2.1 迁移 factory-shipment.ts

#### 当前状态
- **源文件**: `lib/schemas/factory-shipment.ts` (288 行)
- **目标文件**: `lib/validations/factory-shipment.ts` (新建)
- **引用文件**: 6 个

#### 引用文件列表
1. `lib/api/factory-shipments.ts`
2. `app/api/factory-shipments/route.ts`
3. `app/api/factory-shipments/[id]/route.ts`
4. `app/api/factory-shipments/[id]/status/route.ts`
5. `components/factory-shipments/factory-shipment-order-form.tsx`
6. `components/factory-shipments/form-sections/item-list-section.tsx`

#### 执行步骤

**步骤 1: 移动文件**
```bash
mv lib/schemas/factory-shipment.ts lib/validations/factory-shipment.ts
```

**步骤 2: 更新导入引用（批量替换）**
```bash
# 使用 sed 或手动更新以下文件中的导入路径
# 从: @/lib/schemas/factory-shipment
# 到: @/lib/validations/factory-shipment
```

**步骤 3: 逐个文件验证**
- [ ] `lib/api/factory-shipments.ts` - 更新导入
- [ ] `app/api/factory-shipments/route.ts` - 更新导入
- [ ] `app/api/factory-shipments/[id]/route.ts` - 更新导入
- [ ] `app/api/factory-shipments/[id]/status/route.ts` - 更新导入
- [ ] `components/factory-shipments/factory-shipment-order-form.tsx` - 更新导入
- [ ] `components/factory-shipments/form-sections/item-list-section.tsx` - 更新导入

**步骤 4: 验证**
```bash
npm run lint
npm run type-check
```

---

### 2.2 迁移 settings.ts

#### 当前状态
- **源文件**: `lib/schemas/settings.ts` (437 行)
- **目标文件**: `lib/validations/settings.ts` (新建)
- **引用文件**: 需要检查（预计 0-3 个）

#### 执行步骤
```bash
# 1. 移动文件
mv lib/schemas/settings.ts lib/validations/settings.ts

# 2. 搜索引用
grep -r "from '@/lib/schemas/settings'" --include="*.ts" --include="*.tsx" .

# 3. 更新所有引用（如果有）

# 4. 验证
npm run lint
npm run type-check
```

---

## 🎯 第三批迁移：需要合并的模块

### 3.1 合并 supplier.ts

#### 当前状态
- **源文件**: `lib/schemas/supplier.ts` (164 行)
- **目标文件**: `lib/validations/supplier.ts` (新建)
- **引用文件**: 5 个
- **工具函数**: 需要迁移到 `lib/utils/supplier-utils.ts`

#### 工具函数迁移
需要将以下函数从 schema 迁移到 utils:
- `formatSupplierStatus()`
- `formatSupplierPhone()`
- `formatSupplierAddress()`
- `validateSupplierName()`

#### 执行步骤

**步骤 1: 检查 lib/utils/supplier-utils.ts**
```bash
# 查看是否已存在这些函数
cat lib/utils/supplier-utils.ts | grep -E "formatSupplierStatus|formatSupplierPhone"
```

**步骤 2: 移动 Schema 定义**
```bash
# 创建新文件，只包含 Zod Schema 定义
# 工具函数保留在 lib/schemas/supplier.ts 或移动到 lib/utils/supplier-utils.ts
```

**步骤 3: 更新引用文件**
- [ ] `app/api/suppliers/route.ts`
- [ ] `app/api/suppliers/[id]/route.ts`
- [ ] `app/api/suppliers/batch/route.ts`
- [ ] `app/(dashboard)/suppliers/create/page.tsx`
- [ ] `app/(dashboard)/suppliers/[id]/edit/page.tsx`

**步骤 4: 验证**
```bash
npm run lint
npm run type-check
```

---

### 3.2 合并 category.ts

#### 当前状态
- **源文件**: `lib/schemas/category.ts` (221 行)
- **目标文件**: `lib/validations/category.ts` (114 行，已存在)
- **引用文件**: 3 个
- **工具函数**: 需要迁移到 `lib/utils/category-utils.ts`

#### 差异分析
`lib/schemas/category.ts` 比 `lib/validations/category.ts` 多了:
- 工具函数: `validateCategoryName`, `validateCategoryCode`, `generateCategoryCodeSuggestion`
- 树结构函数: `buildCategoryTree`, `flattenCategoryTree`, `getCategoryPath`
- 验证函数: `validateCategoryDepth`, `checkCircularReference`

#### 执行步骤

**步骤 1: 创建 lib/utils/category-utils.ts**
```typescript
// 将工具函数从 lib/schemas/category.ts 迁移到这里
export function validateCategoryName(name: string): boolean { ... }
export function validateCategoryCode(code: string): boolean { ... }
export function generateCategoryCodeSuggestion(name: string): string { ... }
export function buildCategoryTree(categories: any[]): any[] { ... }
export function flattenCategoryTree(tree: any[], level: number = 0): any[] { ... }
export function getCategoryPath(categories: any[], categoryId: string): string[] { ... }
export function validateCategoryDepth(...): boolean { ... }
export function checkCircularReference(...): boolean { ... }
```

**步骤 2: 更新 lib/validations/category.ts**
```typescript
// 确保 Schema 定义完整
// 如果 lib/schemas/category.ts 的 Schema 更完善，则合并
```

**步骤 3: 更新引用文件**
- [ ] `app/(dashboard)/categories/create/page.tsx`
- [ ] `app/(dashboard)/categories/[id]/edit/page.tsx`
- [ ] `app/api/categories/[id]/route.ts`

**步骤 4: 删除 lib/schemas/category.ts**
```bash
rm lib/schemas/category.ts
```

**步骤 5: 验证**
```bash
npm run lint
npm run type-check
```

---

### 3.3 合并 sales-order.ts

#### 当前状态
- **源文件**: `lib/schemas/sales-order.ts` (72 行)
- **目标文件**: `lib/validations/sales-order.ts` (368 行，已存在)
- **引用文件**: 4 个

#### 差异分析
`lib/schemas/sales-order.ts` 包含:
- 简化的 `SalesOrderItemSchema`
- 简化的 `CreateSalesOrderSchema`
- 计算函数: `calculateItemSubtotal`, `calculateOrderTotal`
- 默认值: `salesOrderFormDefaults`

`lib/validations/sales-order.ts` 包含:
- 完整的验证规则（更严格）
- 更多的 Schema 定义

#### 执行步骤

**步骤 1: 对比两个文件的 Schema 定义**
```bash
# 检查是否有冲突或遗漏
diff lib/schemas/sales-order.ts lib/validations/sales-order.ts
```

**步骤 2: 迁移计算函数到 lib/utils/**
```typescript
// lib/utils/sales-order-utils.ts
export function calculateItemSubtotal(quantity: number, unitPrice: number): number { ... }
export function calculateOrderTotal(items: SalesOrderItemData[]): number { ... }
```

**步骤 3: 合并默认值到 lib/validations/sales-order.ts**
```typescript
// 确保 salesOrderFormDefaults 存在于 lib/validations/sales-order.ts
```

**步骤 4: 更新引用文件**
- [ ] `components/sales-orders/sales-order-form.tsx`
- [ ] `components/sales-orders/order-items-editor.tsx`
- [ ] `components/sales-orders/unified-product-input.tsx`
- [ ] `components/sales-orders/enhanced-product-input.tsx`

**步骤 5: 删除 lib/schemas/sales-order.ts**
```bash
rm lib/schemas/sales-order.ts
```

**步骤 6: 验证**
```bash
npm run lint
npm run type-check
```

---

## 🗑️ 最终清理

### 删除 lib/schemas/ 目录

#### 执行步骤
```bash
# 1. 确认所有文件已迁移
ls lib/schemas/

# 2. 删除目录
rm -rf lib/schemas/

# 3. 最终验证
npm run lint
npm run type-check
npm run build  # 确保构建成功
```

---

## ✅ 完整验证清单

### 代码质量检查
- [ ] `npm run lint` 通过（无 Error）
- [ ] `npm run type-check` 通过
- [ ] `npm run build` 成功

### 功能验证
- [ ] 所有 API 路由正常工作
- [ ] 所有表单验证正常
- [ ] 所有页面正常渲染

### 文档更新
- [ ] 更新项目文档中的目录结构说明
- [ ] 更新开发指南中的 Schema 定义位置

---

## 🔄 回滚计划

如果迁移过程中出现问题，可以通过 Git 回滚：

```bash
# 查看修改
git status

# 回滚所有修改
git checkout .

# 或回滚特定文件
git checkout lib/schemas/
git checkout lib/validations/
```

---

## 📝 执行记录

### 第一批迁移
- [ ] address.ts - 完成时间: ____
- [ ] layout.ts - 完成时间: ____

### 第二批迁移
- [ ] factory-shipment.ts - 完成时间: ____
- [ ] settings.ts - 完成时间: ____

### 第三批迁移
- [ ] supplier.ts - 完成时间: ____
- [ ] category.ts - 完成时间: ____
- [ ] sales-order.ts - 完成时间: ____

### 最终清理
- [ ] 删除 lib/schemas/ 目录 - 完成时间: ____
- [ ] 最终验证通过 - 完成时间: ____

