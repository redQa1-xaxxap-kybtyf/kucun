# 厂家发货表单 Unit 字段验证错误修复

> 修复 Zod 验证错误：unit 字段只接受 "片" 或 "件"，拒绝其他单位值

## 🐛 问题描述

### 错误信息

```json
[
  {
    "code": "invalid_union",
    "errors": [
      [
        {
          "code": "invalid_value",
          "values": ["片", "件"],
          "path": [],
          "message": "Invalid option: expected one of \"片\"|\"件\""
        }
      ]
    ],
    "path": ["items", 0, "unit"],
    "message": "Invalid input"
  }
]
```

### 问题原因

在验证逻辑重构过程中，`lib/validations/factory-shipment/schemas.ts` 中的 `unit` 字段验证定义不正确：

```typescript
// ❌ 错误的实现
unit: z.enum(['片', '件']).optional().or(z.literal('片')),
```

**问题分析：**

1. **类型定义不一致**
   - `lib/types/factory-shipment.ts` 中定义：`unit: string`（允许任意字符串）
   - Zod schema 定义：只接受 `'片'` 或 `'件'`
   - 导致类型不匹配

2. **业务逻辑错误**
   - `unit` 字段的值来自产品数据，可能是任意单位（箱、个、吨、米等）
   - 限制为只接受 `'片'` 或 `'件'` 会拒绝其他合法的单位值

3. **Zod 语法问题**
   - `.optional().or(z.literal('片'))` 的逻辑不清晰
   - 应该使用 `.default('片')` 或 `.or(z.literal(''))`

## ✅ 修复方案

### 修复代码

```typescript
// ✅ 正确的实现（参考销售订单）
// 保留原有的unit字段用于兼容性（从产品数据获取，允许任意字符串）
unit: z.string().max(20, '单位不能超过20个字符').optional().or(z.literal('')),
```

### 修复位置

**文件：** `lib/validations/factory-shipment/schemas.ts`  
**行号：** 第 119 行

### 修复对比

```diff
  specification: z
    .string()
    .max(200, '规格不能超过200个字符')
    .optional()
    .or(z.literal('')),
- unit: z.enum(['片', '件']).optional().or(z.literal('片')),
+ // 保留原有的unit字段用于兼容性（从产品数据获取，允许任意字符串）
+ unit: z.string().max(20, '单位不能超过20个字符').optional().or(z.literal('')),
  piecesPerUnit: z
    .number()
    .int('每件片数必须为整数')
    .min(1, '每件片数必须大于0')
    .max(100000, '每件片数不能超过100000')
    .optional(),
```

## 🎯 修复效果

### 修复前

- ❌ 只接受 `'片'` 或 `'件'`
- ❌ 拒绝其他单位（箱、个、吨、米等）
- ❌ 与类型定义不一致
- ❌ 与业务逻辑不符

### 修复后

- ✅ 接受任意字符串单位（最长 20 个字符）
- ✅ 支持从产品数据获取的任意单位
- ✅ 与类型定义一致
- ✅ 符合业务逻辑

## 📋 测试验证

### 单元测试

创建了完整的单元测试：`lib/validations/factory-shipment/__tests__/unit-field-validation.test.ts`

**测试覆盖：**

1. ✅ 应该接受的单位值
   - "片"、"件"（常用单位）
   - "箱"、"个"、"吨"、"米"（从产品数据获取）
   - 空字符串、undefined（可选字段）

2. ❌ 应该拒绝的单位值
   - 超过 20 个字符的单位
   - null 值

3. 🔄 与其他字段的兼容性
   - unit 与 piecesPerUnit 的配合

4. 📝 实际使用场景
   - 玻璃产品（片）
   - 包装箱（箱）
   - 原材料（吨）
   - 手工产品（使用 manualUnit）

### 运行测试

```bash
# 运行单元测试
npm test lib/validations/factory-shipment/__tests__/unit-field-validation.test.ts

# 运行 ESLint 检查
npx eslint lib/validations/factory-shipment/schemas.ts --ext .ts

# 运行 TypeScript 类型检查
npm run type-check
```

## 🔍 根本原因分析

### 为什么会出现这个问题？

1. **重构过程中的疏忽**
   - 在将验证逻辑从单文件拆分为模块化结构时
   - 没有仔细对比销售订单的实现
   - 错误地将 `unit` 字段限制为枚举类型

2. **缺少参考文档**
   - 重构时没有明确的字段验证规范
   - 没有说明哪些字段应该是枚举，哪些应该是字符串

3. **缺少单元测试**
   - 重构后没有立即添加单元测试
   - 导致问题在运行时才被发现

## 📚 经验教训

### 1. 重构时必须参考现有实现

在重构验证逻辑时，应该：

- ✅ 仔细对比销售订单的实现（已验证的最佳实践）
- ✅ 逐字段检查验证规则是否一致
- ✅ 特别注意枚举类型 vs 字符串类型的区别

### 2. 类型定义与验证规则必须一致

- ✅ TypeScript 类型定义：`unit: string`
- ✅ Zod schema 验证：`z.string().max(20)`
- ❌ 不要出现类型定义是 `string`，验证规则是 `enum` 的情况

### 3. 重构后立即添加单元测试

- ✅ 为每个验证函数添加单元测试
- ✅ 覆盖正常情况和边界情况
- ✅ 在提交代码前运行所有测试

### 4. 字段验证规则的选择标准

**使用 `z.enum()` 的场景：**

- 字段值是固定的几个选项（如 status、ownership）
- 值由系统控制，不从外部数据获取

**使用 `z.string()` 的场景：**

- 字段值来自外部数据（如产品数据）
- 值可能有多种可能性，无法穷举
- 需要灵活性和扩展性

## 🔄 后续改进

### 1. 更新最佳实践文档

在 `docs/rules/form-development-best-practices.md` 中添加：

```markdown
### 字段验证规则选择指南

**枚举类型（z.enum）：**

- 系统控制的固定选项
- 示例：status、ownership、deliveryStatus

**字符串类型（z.string）：**

- 从外部数据获取的值
- 示例：unit、productCode、displayName
```

### 2. 添加 PR Review 检查项

在 `docs/rules/pr-review-checklist.md` 中添加：

```markdown
### 验证规则一致性

- [ ] TypeScript 类型定义与 Zod schema 验证规则一致
- [ ] 枚举类型用于系统控制的固定选项
- [ ] 字符串类型用于外部数据或可扩展字段
- [ ] 所有验证规则有对应的单元测试
```

### 3. 创建验证规则检查工具

考虑创建一个 ESLint 插件或脚本，自动检查：

- TypeScript 类型定义与 Zod schema 的一致性
- 枚举类型的使用是否合理
- 字符串类型是否有长度限制

## 📖 参考资源

- [销售订单验证实现](../../lib/validations/sales-order/schemas.ts) - 第 123 行
- [厂家发货类型定义](../../lib/types/factory-shipment.ts) - 第 216 行
- [表单开发最佳实践](./rules/form-development-best-practices.md)
- [Zod 官方文档 - String](https://zod.dev/?id=strings)
- [Zod 官方文档 - Enums](https://zod.dev/?id=enums)

---

**修复时间：** 2025-11-10  
**修复负责人：** Augment Agent  
**验证状态：** ✅ ESLint 通过，单元测试已创建
