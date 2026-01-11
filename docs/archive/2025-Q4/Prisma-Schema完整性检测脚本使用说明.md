# Prisma Schema 完整性检测脚本使用说明

> **创建日期**: 2025-01-11  
> **脚本位置**: `scripts/validate-prisma-relations.js`  
> **目的**: 自动检测 Prisma Schema 中缺失的关系定义，防止运行时 PrismaClientValidationError

---

## 📋 背景

在项目开发过程中，我们遇到了**三次相同模式的问题**：

| 序号 | 问题                      | 缺失的关系                                                                   | 错误信息                                        |
| ---- | ------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| 1    | **价格历史 API 500 错误** | `CustomerProductPrice` 缺少 `customer`、`product` 关系                       | `Unknown field 'customer' for select statement` |
| 2    | **入库记录查询错误**      | `InboundRecord` 缺少 `user`、`variant`、`batchSpecification` 关系            | `Unknown field 'user' for select statement`     |
| 3    | **库存调整记录查询错误**  | `InventoryAdjustment` 缺少 `product`、`variant`、`operator`、`approver` 关系 | `Unknown field 'product' for select statement`  |

**共同特征**：

- Prisma Schema 中有外键字段（如 `productId`、`userId`），但缺少对应的 `@relation` 定义
- API 代码使用 `select` 或 `include` 查询关联数据时失败
- 运行时抛出 `PrismaClientValidationError`

**解决方案**：创建自动化检测脚本，在开发阶段就发现这类问题。

---

## 🚀 快速开始

### 运行脚本

```bash
# 方式 1: 使用 npm 脚本
npm run validate:schema

# 方式 2: 直接运行
node scripts/validate-prisma-relations.js
```

### 集成到开发流程

脚本已集成到 `npm run lint` 命令中：

```bash
# 运行 lint 会自动先检查 Schema
npm run lint

# 输出示例：
# 🔍 开始检查 Prisma Schema 关系定义...
# ✅ Prisma Schema 关系定义检查通过
# - 检查了 25 个模型
# - 验证了 87 个外键字段
# - 验证了 156 个关系定义
# - 所有关系定义完整
```

---

## 🔍 检测功能

### 1. 外键字段检测

**检测逻辑**：

- 扫描所有模型中以 `Id` 结尾的字段（如 `productId`、`userId`、`customerId`）
- 验证每个外键字段是否有对应的 `@relation` 定义
- 推断目标模型名称（移除 `Id` 后缀并首字母大写）
- 检查目标模型是否存在

**示例**：

```prisma
// ❌ 错误：缺少关系定义
model InventoryAdjustment {
  productId String @map("product_id") @db.Char(36)
  // 缺少: product Product @relation(...)
}

// ✅ 正确：有完整的关系定义
model InventoryAdjustment {
  productId String @map("product_id") @db.Char(36)
  product   Product @relation(fields: [productId], references: [id], onDelete: Restrict, onUpdate: Cascade)
}
```

### 2. 反向关系检测

**检测逻辑**：

- 对于每个前向关系（包含 `fields` 和 `references`），检查目标模型是否有反向关系
- 验证命名关系的一致性（如 `@relation("RelationName")`）
- 确保反向关系是数组类型（如 `InventoryAdjustment[]`）

**示例**：

```prisma
// ❌ 错误：Product 模型缺少反向关系
model InventoryAdjustment {
  productId String  @map("product_id") @db.Char(36)
  product   Product @relation(fields: [productId], references: [id])
}

model Product {
  id String @id @default(uuid()) @db.Char(36)
  // 缺少: inventoryAdjustments InventoryAdjustment[]
}

// ✅ 正确：有完整的反向关系
model InventoryAdjustment {
  productId String  @map("product_id") @db.Char(36)
  product   Product @relation(fields: [productId], references: [id])
}

model Product {
  id                   String                @id @default(uuid()) @db.Char(36)
  inventoryAdjustments InventoryAdjustment[]
}
```

### 3. 命名关系检测

**检测逻辑**：

- 检测使用命名关系的字段（如 `@relation("InventoryAdjustmentOperator")`）
- 验证命名关系必须成对出现（一个前向关系 + 一个反向关系）
- 确保命名关系的一致性

**示例**：

```prisma
// ✅ 正确：命名关系成对出现
model InventoryAdjustment {
  operatorId String @map("operator_id") @db.Char(36)
  operator   User   @relation("InventoryAdjustmentOperator", fields: [operatorId], references: [id])
}

model User {
  id                  String                @id @default(uuid()) @db.Char(36)
  operatedAdjustments InventoryAdjustment[] @relation("InventoryAdjustmentOperator")
}
```

### 4. 特殊字段白名单

脚本会跳过以下特殊外键字段（这些字段可能是多态关系或特殊用途）：

- `orderId` - 可能是多态关系（不同类型的订单）
- `referenceId` - 通用引用字段
- `sourceId` - 通用来源字段
- `relatedId` - 通用关联字段
- `entityId` - 通用实体字段
- `siteId` - 可能是字符串类型的站点ID

---

## 📊 输出示例

### 成功示例

```
🔍 开始检查 Prisma Schema 关系定义...

✅ Prisma Schema 关系定义检查通过
- 检查了 25 个模型
- 验证了 87 个外键字段
- 验证了 156 个关系定义
- 所有关系定义完整
```

### 失败示例

```
🔍 开始检查 Prisma Schema 关系定义...

❌ Prisma Schema 关系定义检查失败

发现 3 个问题：

1. ❌ InventoryAdjustment 模型 (line 480)
   - 外键字段 'productId' 缺少 @relation 定义
   - 建议添加: product Product @relation(fields: [productId], references: [id], onDelete: Restrict, onUpdate: Cascade)

2. ❌ InventoryAdjustment 模型 (line 485)
   - 外键字段 'operatorId' 缺少 @relation 定义
   - 建议添加: operator User @relation(fields: [operatorId], references: [id], onDelete: Restrict, onUpdate: Cascade)

3. ❌ Product 模型 (line 134)
   - 缺少来自 InventoryAdjustment 的反向关系
   - 建议添加: inventoryAdjustments InventoryAdjustment[]

总计: 3 个错误, 0 个警告

请修复以上问题后再提交代码。
```

---

## 🛠️ 集成到 CI/CD

### GitHub Actions

```yaml
name: Prisma Schema Validation

on: [push, pull_request]

jobs:
  validate-schema:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run validate:schema
```

### Git Hooks (Husky)

```json
// package.json
{
  "scripts": {
    "pre-commit": "npm run validate:schema && lint-staged"
  }
}
```

### Pre-push Hook

```json
// package.json
{
  "scripts": {
    "pre-push": "npm run validate:schema && npm run type-check && npm run lint"
  }
}
```

---

## 📝 常见问题

### Q1: 脚本报告了误报怎么办？

**A**: 如果某个外键字段确实不需要关系定义（如多态关系），可以将其添加到白名单：

```javascript
// scripts/validate-prisma-relations.js
const specialForeignKeys = new Set([
  'orderId',
  'referenceId',
  'yourSpecialFieldId', // 添加你的特殊字段
]);
```

### Q2: 如何处理多态关系？

**A**: 多态关系（一个外键可能指向多个不同的模型）通常使用以下模式：

```prisma
model Transaction {
  id            String  @id @default(uuid())
  referenceType String  // 'SalesOrder' | 'ReturnOrder' | 'PaymentRecord'
  referenceId   String  // 不需要 @relation 定义

  // 不使用标准关系，而是在应用层处理
}
```

这种情况下，`referenceId` 应该添加到白名单中。

### Q3: 脚本检测到的问题都必须修复吗？

**A**:

- **Error 级别**：必须修复，否则可能导致运行时错误
- **Warning 级别**：建议修复，但不会阻止提交

### Q4: 如何临时跳过检测？

**A**: 如果需要临时跳过检测（不推荐），可以：

```bash
# 跳过 Schema 验证，直接运行 ESLint
npx eslint .

# 或者修改 package.json 临时移除 validate:schema
```

---

## 🎯 最佳实践

### 1. 创建新模型时的检查清单

- [ ] 所有外键字段都有对应的 `@relation` 定义
- [ ] 所有关联模型都有反向关系定义
- [ ] 运行 `npm run validate:schema` 验证 Schema 完整性
- [ ] 运行 `npx prisma format` 格式化 Schema
- [ ] 运行 `npx prisma validate` 验证 Schema 语法

### 2. 修改现有模型时的注意事项

- 添加新的外键字段时，立即添加关系定义
- 删除关系时，同时删除反向关系
- 修改关系名称时，确保前向和反向关系一致

### 3. 代码审查要点

- 检查 PR 中的 Schema 变更
- 确认所有新增的外键都有关系定义
- 验证 `npm run validate:schema` 通过

---

## 🔧 脚本维护

### 更新白名单

如果项目中有新的特殊外键字段，需要更新白名单：

```javascript
// scripts/validate-prisma-relations.js (line 160-167)
const specialForeignKeys = new Set([
  'orderId',
  'referenceId',
  'sourceId',
  'relatedId',
  'entityId',
  'siteId',
  'yourNewSpecialField', // 添加新字段
]);
```

### 扩展检测规则

如果需要添加新的检测规则，可以在 `validateRelations` 函数中添加：

```javascript
// 4. 添加新的检测规则
for (const model of models) {
  // 你的检测逻辑
}
```

---

## 📚 参考资源

### 相关文档

- `docs/价格历史API-500错误修复报告.md` - 第一次遇到关系定义缺失问题
- `docs/入库记录查询Prisma验证错误修复报告.md` - 第二次遇到关系定义缺失问题
- `docs/库存调整记录查询Prisma验证错误修复报告.md` - 第三次遇到关系定义缺失问题

### Prisma 官方文档

- [Prisma Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)
- [One-to-Many Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations/one-to-many-relations)
- [Self-Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations/self-relations)

### 项目规范

- **数据定义**: Prisma 为数据库结构，Zod 为接口契约
- **关系定义**: 使用 Prisma 标准的 `@relation` 语法
- **命名规范**: 使用驼峰命名法，反向关系使用复数形式

---

## ✅ 总结

### 脚本功能

- ✅ 自动检测缺失的前向关系定义
- ✅ 自动检测缺失的反向关系定义
- ✅ 验证命名关系的一致性
- ✅ 提供详细的错误信息和修复建议
- ✅ 支持白名单机制处理特殊字段
- ✅ 集成到 lint 流程，确保代码质量

### 预期效果

- 🎯 在开发阶段就发现 Schema 问题
- 🎯 防止运行时 PrismaClientValidationError
- 🎯 提高代码质量和团队协作效率
- 🎯 减少因 Schema 问题导致的 Bug

### 使用建议

- 💡 每次修改 Schema 后运行 `npm run validate:schema`
- 💡 在 Git pre-commit 钩子中自动运行
- 💡 在 CI/CD 流程中添加检查步骤
- 💡 定期审查白名单，确保合理性

---

**创建时间**: 2025-01-11  
**维护人员**: 开发团队  
**版本**: 1.0.0
