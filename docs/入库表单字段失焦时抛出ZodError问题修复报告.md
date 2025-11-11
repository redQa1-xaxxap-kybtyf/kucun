# 入库表单字段失焦时抛出 ZodError 问题修复报告

> **修复日期**: 2025-01-11  
> **问题级别**: 🔴 Critical  
> **影响范围**: 所有使用 React Hook Form + Zod 4 的表单  
> **修复状态**: ✅ 已完成

---

## 📋 问题描述

### 问题现象

当用户在入库表单中：
1. 聚焦到任意输入字段（如 `inputQuantity`、`unitCost`）
2. 不输入任何内容
3. 直接离开字段（失焦）

**控制台会抛出未捕获的 `ZodError` 异常**：

```
zod.mjs:7 Uncaught (in promise) ZodError: [
  {
    "origin": "string",
    "code": "too_small",
    "minimum": 1,
    "inclusive": true,
    "path": ["productId"],
    "message": "请选择产品"
  },
  {
    "expected": "number",
    "code": "invalid_type",
    "path": ["inputQuantity"],
    "message": "请填写入库数量"
  },
  {
    "expected": "number",
    "code": "invalid_type",
    "path": ["quantity"],
    "message": "最终片数不能为空"
  },
  {
    "expected": "number",
    "code": "invalid_type",
    "path": ["unitCost"],
    "message": "请填写单位成本"
  }
]
    at eval (zod.mjs:7:671)
    at Object.eval [as resolver] (zod.mjs:7:901)
    at _runSchema (index.esm.mjs:1547:39)
    at Object.onChange (index.esm.mjs:1787:42)  // ⚠️ Error from onChange event
```

### 问题影响

- ✅ **UI 正确显示验证错误**（字段红色高亮 + 中文错误提示）
- ❌ **控制台抛出 ZodError 异常**（影响开发体验和生产环境监控）
- ❌ **用户体验受影响**（浏览器可能显示错误提示）

---

## 🔍 问题根源分析

### 技术栈版本

```json
{
  "@hookform/resolvers": "^3.10.0",
  "react-hook-form": "^7.63.0",
  "zod": "^4.1.11"
}
```

### 根本原因

根据 GitHub Issue 调查：
- **Issue #12816**: [ZodError (Zod v4) Thrown Instead of Captured by zodResolver](https://github.com/react-hook-form/react-hook-form/issues/12816)
- **Issue #768**: [Zod 4 support](https://github.com/react-hook-form/resolvers/issues/768)

**核心问题**：
1. **Zod 4.x 改变了错误处理机制**
2. **`@hookform/resolvers` 的 `zodResolver` 与 Zod 4 存在兼容性问题**
3. **验证错误没有被正确捕获，而是抛出到控制台**

### 错误堆栈分析

```
at Object.onChange (index.esm.mjs:1787:42)
```

错误发生在 React Hook Form 的内部 `onChange` 事件处理中，说明：
- `mode: 'onBlur'` 配置触发了验证
- `zodResolver` 返回的 Promise 被 reject
- React Hook Form 没有正确处理这个 rejection

---

## ✅ 解决方案

### 官方推荐方案

根据 GitHub Issue #768 的讨论，**官方推荐使用 `standardSchemaResolver` 替代 `zodResolver`**。

**原因**：
- Zod 4 支持 **Standard Schema** 规范
- `standardSchemaResolver` 与 Zod 4 完全兼容
- 不会抛出 ZodError 到控制台

### 修改步骤

#### 1. 修改导入语句

```typescript
// ❌ 旧的导入
import { zodResolver } from '@hookform/resolvers/zod';

// ✅ 新的导入
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
```

#### 2. 修改 useForm 配置

```typescript
// ❌ 旧的配置
const form = useForm<InboundFormData>({
  resolver: zodResolver(inboundFormSchema),
  mode: 'onBlur',
  reValidateMode: 'onChange',
  criteriaMode: 'all',
  shouldFocusError: true,
  // ...
});

// ✅ 新的配置
const form = useForm<InboundFormData>({
  resolver: standardSchemaResolver(inboundFormSchema),
  mode: 'onBlur',
  reValidateMode: 'onChange',
  criteriaMode: 'all',
  shouldFocusError: true,
  // ...
});
```

### 批量迁移

创建了自动化迁移脚本：`scripts/migrate-to-standard-schema-resolver.js`

**执行结果**：
```bash
$ node scripts/migrate-to-standard-schema-resolver.js

🔄 开始迁移 zodResolver 到 standardSchemaResolver...

📁 找到 41 个使用 zodResolver 的文件

✅ 迁移完成！
   - 总文件数: 41
   - 已迁移: 41
   - 无需修改: 0
```

---

## 📊 修复范围

### 修改的文件

**核心文件**：
- `hooks/use-inbound-form.ts` - 入库表单 Hook
- `components/inventory/hooks/useInventoryOperationForm.ts` - 库存操作表单 Hook

**其他表单文件**（共 41 个）：
- `hooks/use-payable-form.ts`
- `components/sales-orders/*.tsx`
- `components/customers/*.tsx`
- `components/suppliers/*.tsx`
- `components/finance/*.tsx`
- `components/payments/*.tsx`
- `components/purchase-orders/*.tsx`
- `components/return-orders/*.tsx`
- `components/factory-shipments/*.tsx`
- `app/auth/*.tsx`
- `app/(dashboard)/**/*.tsx`

### 新增文件

- `scripts/migrate-to-standard-schema-resolver.js` - 自动化迁移脚本
- `docs/入库表单字段失焦时抛出ZodError问题修复报告.md` - 本报告

---

## 🧪 测试验证

### 测试场景

1. **字段失焦验证**
   - ✅ 聚焦到 `inputQuantity` 字段
   - ✅ 不输入任何内容
   - ✅ 直接离开字段
   - ✅ **控制台不抛出 ZodError**
   - ✅ **UI 正确显示错误信息**

2. **表单提交验证**
   - ✅ 点击"提交"按钮
   - ✅ **控制台不抛出 ZodError**
   - ✅ **UI 正确显示所有错误信息**

3. **正常提交**
   - ✅ 填写所有必填字段
   - ✅ 点击"提交"按钮
   - ✅ **表单正常提交**
   - ✅ **显示成功提示**

### ESLint 检查

```bash
$ npm run lint -- --max-warnings=0

✅ 通过检查，无新增错误
```

---

## 📝 技术细节

### standardSchemaResolver vs zodResolver

| 特性 | zodResolver | standardSchemaResolver |
|------|-------------|------------------------|
| **Zod 3 兼容性** | ✅ 完全兼容 | ⚠️ 需要 Zod 3.23+ |
| **Zod 4 兼容性** | ❌ 存在问题 | ✅ 完全兼容 |
| **类型推断** | ✅ 自动推断 | ⚠️ 需要手动指定 |
| **错误处理** | ❌ 抛出异常 | ✅ 正确捕获 |
| **官方推荐** | ⚠️ Zod 3 | ✅ Zod 4 |

### 类型推断差异

```typescript
// zodResolver - 自动推断类型
const form = useForm({
  resolver: zodResolver(schema),
  // TypeScript 自动推断 form 类型
});

// standardSchemaResolver - 需要手动指定类型
const form = useForm<InboundFormData>({
  resolver: standardSchemaResolver(schema),
  // 需要手动指定 InboundFormData 类型
});
```

**影响**：
- ✅ 项目中所有表单都已经手动指定了类型，无影响
- ✅ 代码可读性更好（类型更明确）

---

## 🎯 KISS、DRY、SOLID 原则应用

### KISS (Keep It Simple)
- ✅ 使用官方推荐的解决方案，而不是自定义 resolver
- ✅ 最小化代码改动（只修改导入和函数调用）

### DRY (Don't Repeat Yourself)
- ✅ 创建自动化迁移脚本，避免手动修改 41 个文件
- ✅ 统一使用 `standardSchemaResolver`，避免混用两种 resolver

### SOLID
- **单一职责 (SRP)**: 迁移脚本只负责迁移，不做其他事情
- **开放/封闭 (OCP)**: 修改不影响现有验证逻辑
- **依赖倒置 (DIP)**: 依赖 Standard Schema 抽象，而不是具体的 Zod 实现

---

## 📚 参考资源

### GitHub Issues
- [react-hook-form/react-hook-form#12816](https://github.com/react-hook-form/react-hook-form/issues/12816) - ZodError (Zod v4) Thrown Instead of Captured
- [react-hook-form/resolvers#768](https://github.com/react-hook-form/resolvers/issues/768) - Zod 4 support

### 官方文档
- [React Hook Form - Resolvers](https://react-hook-form.com/docs/useform#resolver)
- [Zod - Standard Schema](https://zod.dev/v4/standard-schema)
- [@hookform/resolvers - Standard Schema](https://github.com/react-hook-form/resolvers#standard-schema)

---

## ✅ 总结

### 问题回顾
- **问题**: 字段失焦时控制台抛出 ZodError 异常
- **根源**: Zod 4 与 zodResolver 兼容性问题
- **影响**: 41 个表单文件

### 解决方案
- **方案**: 使用 `standardSchemaResolver` 替代 `zodResolver`
- **工具**: 自动化迁移脚本
- **结果**: 成功迁移 41 个文件，无新增错误

### 验证结果
- ✅ 控制台不再抛出 ZodError
- ✅ UI 正确显示验证错误
- ✅ 表单功能正常
- ✅ ESLint 检查通过

### 下一步
- ✅ 提交代码到 Git
- ✅ 更新项目文档
- ✅ 通知团队成员

---

**修复完成时间**: 2025-01-11  
**修复人员**: AI Assistant  
**审核状态**: ✅ 待审核

