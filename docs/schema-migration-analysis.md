# Schema 和 Validations 目录差异分析报告

> 生成时间: 2025-10-03
> 目的: 统一 `lib/schemas/` 和 `lib/validations/` 目录，实现单一真理源（Single Source of Truth）

## 📊 执行摘要

### 当前状态

- **lib/schemas/** 目录包含 7 个文件
- **lib/validations/** 目录包含 22 个文件
- **发现重复**: 2 个模块存在功能重复（category, supplier）
- **独立模块**: 5 个模块仅存在于 schemas 目录

### 建议行动

1. **合并重复模块**: category, supplier
2. **迁移独立模块**: address, factory-shipment, layout, settings, sales-order
3. **删除 lib/schemas/ 目录**
4. **更新所有导入引用**（约 15 个文件）

---

## 📁 详细文件对比

### 1. Category（分类）- ⚠️ 存在重复

#### lib/schemas/category.ts

- **行数**: 221 行
- **Schema 定义**:
  - `CreateCategorySchema`
  - `UpdateCategorySchema`
  - `CategoryQuerySchema`
  - `BatchDeleteCategoriesSchema`
- **额外功能**:
  - 工具函数: `validateCategoryName`, `validateCategoryCode`, `generateCategoryCodeSuggestion`
  - 树结构函数: `buildCategoryTree`, `flattenCategoryTree`, `getCategoryPath`
  - 验证函数: `validateCategoryDepth`, `checkCircularReference`

#### lib/validations/category.ts

- **行数**: 114 行
- **Schema 定义**:
  - `CreateCategorySchema` ✅
  - `UpdateCategorySchema` ✅
  - `CategoryQuerySchema` ✅
  - `BatchDeleteCategoriesSchema` ✅
- **差异**:
  - 缺少工具函数和树结构处理函数
  - Schema 定义基本一致，但细节略有不同

#### 合并策略

```
目标文件: lib/validations/category.ts
操作:
1. 保留 lib/validations/category.ts 的 Schema 定义（更符合项目规范）
2. 从 lib/schemas/category.ts 迁移工具函数到 lib/utils/category-utils.ts
3. 删除 lib/schemas/category.ts
```

---

### 2. Supplier（供应商）- ⚠️ 存在重复

#### lib/schemas/supplier.ts

- **行数**: 164 行
- **Schema 定义**:
  - `CreateSupplierSchema`
  - `UpdateSupplierSchema`
  - `SupplierQuerySchema`
  - `BatchDeleteSuppliersSchema`
  - `BatchUpdateSupplierStatusSchema`
- **额外功能**:
  - 格式化函数: `formatSupplierStatus`, `formatSupplierPhone`, `formatSupplierAddress`
  - 验证函数: `validateSupplierName`

#### lib/validations/ 目录

- **不存在** supplier.ts 文件

#### 合并策略

```
目标文件: lib/validations/supplier.ts（新建）
操作:
1. 将 lib/schemas/supplier.ts 重命名为 lib/validations/supplier.ts
2. 格式化函数迁移到 lib/utils/supplier-utils.ts
3. 更新所有导入引用
```

---

### 3. Address（地址）- ✅ 仅存在于 schemas

#### lib/schemas/address.ts

- **行数**: 179 行
- **Schema 定义**:
  - `AddressSchema`
  - `OptionalAddressSchema`
  - `AddressStringSchema`
  - `MixedAddressSchema`
- **额外功能**:
  - 验证工具: `addressValidation` 对象（6个方法）
  - 常量: `ADDRESS_FIELD_LABELS`

#### 迁移策略

```
目标文件: lib/validations/address.ts（新建）
操作:
1. 将 lib/schemas/address.ts 移动到 lib/validations/address.ts
2. 保持所有功能不变
3. 更新导入引用（预计 0-2 个文件）
```

---

### 4. Factory Shipment（厂家发货）- ✅ 仅存在于 schemas

#### lib/schemas/factory-shipment.ts

- **行数**: 288 行
- **Schema 定义**:
  - `factoryShipmentStatusSchema`
  - `factoryShipmentOrderItemSchema`
  - `createFactoryShipmentOrderSchema`
  - `updateFactoryShipmentOrderSchema`
  - `factoryShipmentOrderListParamsSchema`
  - `updateFactoryShipmentOrderStatusSchema`
- **引用位置**:
  - `lib/api/factory-shipments.ts`
  - `app/api/factory-shipments/route.ts`
  - `app/api/factory-shipments/[id]/route.ts`
  - `app/api/factory-shipments/[id]/status/route.ts`
  - `components/factory-shipments/factory-shipment-order-form.tsx`
  - `components/factory-shipments/form-sections/item-list-section.tsx`

#### 迁移策略

```
目标文件: lib/validations/factory-shipment.ts（新建）
操作:
1. 将 lib/schemas/factory-shipment.ts 移动到 lib/validations/factory-shipment.ts
2. 更新 6 个文件的导入引用
```

---

### 5. Layout（布局）- ✅ 仅存在于 schemas

#### lib/schemas/layout.ts

- **行数**: 272 行
- **Schema 定义**: 13 个 Schema
  - `NavigationItemSchema`, `UserInfoSchema`, `NotificationItemSchema`
  - `SidebarStateSchema`, `BreadcrumbItemSchema`, `PageMetadataSchema`
  - `RouteConfigSchema`, `LayoutConfigSchema`, `QuickActionSchema`
  - `DeviceTypeSchema`, `LayoutVariantSchema`, `FormDataSchema`
  - `ApiResponseSchema`, `ErrorInfoSchema`
- **额外功能**:
  - 验证工具函数（14个）
  - 批量验证函数（5个）

#### 迁移策略

```
目标文件: lib/validations/layout.ts（新建）
操作:
1. 将 lib/schemas/layout.ts 移动到 lib/validations/layout.ts
2. 检查并更新导入引用（预计 0-3 个文件）
```

---

### 6. Settings（系统设置）- ✅ 仅存在于 schemas

#### lib/schemas/settings.ts

- **行数**: 437 行
- **Schema 定义**: 20+ 个 Schema
  - 基本设置: `BasicSettingsSchema`, `UserSettingsSchema`
  - 存储设置: `StorageSettingsSchema`, `QiniuStorageConfigSchema`
  - 日志设置: `LogSettingsSchema`, `SystemLogFiltersSchema`
  - 用户管理: `CreateUserSchema`, `UpdateUserSchema`, `UserListQuerySchema`
- **引用位置**: 需要检查

#### 迁移策略

```
目标文件: lib/validations/settings.ts（新建）
操作:
1. 将 lib/schemas/settings.ts 移动到 lib/validations/settings.ts
2. 检查并更新导入引用
```

---

### 7. Sales Order（销售订单）- ✅ 仅存在于 schemas

#### lib/schemas/sales-order.ts

- **行数**: 72 行
- **Schema 定义**:
  - `SalesOrderItemSchema`
  - `CreateSalesOrderSchema`
- **对应文件**: lib/validations/sales-order.ts 已存在

#### 合并策略

```
目标文件: lib/validations/sales-order.ts
操作:
1. 对比两个文件的差异
2. 合并到 lib/validations/sales-order.ts
3. 删除 lib/schemas/sales-order.ts
```

---

## 🔍 引用分析

### lib/schemas/category.ts 引用位置

1. `app/(dashboard)/categories/create/page.tsx`
2. `app/(dashboard)/categories/[id]/edit/page.tsx`
3. `app/api/categories/[id]/route.ts`

### lib/schemas/factory-shipment.ts 引用位置

1. `lib/api/factory-shipments.ts`
2. `app/api/factory-shipments/route.ts`
3. `app/api/factory-shipments/[id]/route.ts`
4. `app/api/factory-shipments/[id]/status/route.ts`
5. `components/factory-shipments/factory-shipment-order-form.tsx`
6. `components/factory-shipments/form-sections/item-list-section.tsx`

### lib/schemas/supplier.ts 引用位置

1. `app/api/suppliers/route.ts`
2. `app/api/suppliers/[id]/route.ts`
3. `app/api/suppliers/batch/route.ts`
4. `app/(dashboard)/suppliers/create/page.tsx`
5. `app/(dashboard)/suppliers/[id]/edit/page.tsx`

### lib/schemas/sales-order.ts 引用位置

1. `components/sales-orders/sales-order-form.tsx`
2. `components/sales-orders/order-items-editor.tsx`
3. `components/sales-orders/unified-product-input.tsx`
4. `components/sales-orders/enhanced-product-input.tsx`

---

## 📋 迁移优先级

### 第一批（低风险，无重复）

1. ✅ **address.ts** - 独立模块，预计 0-2 个引用
2. ✅ **layout.ts** - 独立模块，预计 0-3 个引用

### 第二批（中等风险，有引用）

3. ⚠️ **factory-shipment.ts** - 6 个已知引用
4. ⚠️ **settings.ts** - 需要检查引用数量

### 第三批（需要合并）

5. 🔴 **category.ts** - 存在重复，需要合并 + 3 个引用
6. 🔴 **supplier.ts** - 需要新建 + 检查引用
7. 🔴 **sales-order.ts** - 需要合并两个文件

---

## ✅ 执行检查清单

- [ ] 第一批迁移完成（address, layout）
- [ ] 第二批迁移完成（factory-shipment, settings）
- [ ] 第三批合并完成（category, supplier, sales-order）
- [ ] 所有导入引用已更新
- [ ] 运行 `npm run lint` 通过
- [ ] 运行 `npm run type-check` 通过
- [ ] 删除 `lib/schemas/` 目录
- [ ] 更新文档和注释

---

## 📝 下一步行动

1. **获取用户确认**：是否开始执行迁移计划
2. **第一批迁移**：从低风险的 address 和 layout 开始
3. **验证测试**：每批迁移后运行 lint 和 type-check
4. **逐步推进**：确保每一步都可控且可回滚
