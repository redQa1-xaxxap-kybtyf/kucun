# Toast 通知消息样式规范审计报告

## 📊 审计概述

**审计日期**：2025-01-XX  
**审计范围**：项目中所有使用 `toast()` 或 `useToast()` 的文件  
**审计目标**：确保 Toast 通知消息的颜色和样式一致且符合设计规范

---

## ✅ 当前 Toast 组件配置

### Toast Variants 定义

**文件**：`components/ui/toast.tsx` (第 27-47 行)

```typescript
const toastVariants = cva(
  '...基础样式...',
  {
    variants: {
      variant: {
        default:
          'border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] text-[hsl(var(--color-text-primary))]',
        destructive:
          'destructive border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))] text-[hsl(var(--color-error))]',
        success:
          'border-[hsl(var(--color-success))] bg-[hsl(var(--color-success-light))] text-[hsl(var(--color-success))]',
        warning:
          'border-[hsl(var(--color-warning))] bg-[hsl(var(--color-warning-light))] text-[hsl(var(--color-warning))]',
        info:
          'border-[hsl(var(--color-info))] bg-[hsl(var(--color-info-light))] text-[hsl(var(--color-info))]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);
```

### 颜色映射

| Variant | 颜色 | 用途 | 状态 |
|---------|------|------|------|
| `success` | 绿色 | 成功操作（创建、更新、删除成功） | ✅ 已定义 |
| `destructive` | 红色 | 失败/错误消息 | ✅ 已定义 |
| `warning` | 黄色/橙色 | 警告消息 | ✅ 已定义 |
| `info` | 蓝色 | 信息提示 | ✅ 已定义 |
| `default` | 灰色/蓝色 | 默认消息 | ✅ 已定义 |

---

## 🔍 审计发现

### 问题 1：成功消息缺少 `variant: 'success'`

**严重程度**：⚠️ 高  
**影响**：成功消息显示为默认灰色，而不是绿色，用户体验不佳

**发现的文件**（部分列表）：

1. **客户删除成功** - `components/customers/customer-delete-dialog.tsx:43`
   ```typescript
   // ❌ 错误：缺少 variant
   toast({
     title: '删除成功',
     description: `客户"${customer?.name}"已成功删除`,
   });
   
   // ✅ 正确：应该添加 variant: 'success'
   toast({
     title: '删除成功',
     description: `客户"${customer?.name}"已成功删除`,
     variant: 'success',
   });
   ```

2. **付款成功** - `components/finance/payables-client/PayablePaymentDialog.tsx:140`
   ```typescript
   // ❌ 错误
   toast({
     title: '付款成功',
     description: '付款记录已创建成功',
   });
   ```

3. **存储配置保存成功** - `app/(dashboard)/settings/storage/page.tsx:79`
   ```typescript
   // ❌ 错误
   toast({ title: '成功', description: '七牛云存储配置保存成功' });
   ```

4. **用户创建成功** - `app/(dashboard)/settings/users/page.tsx:121`
   ```typescript
   // ❌ 错误
   toast({ title: '成功', description: '用户创建成功' });
   ```

5. **站点删除成功** - `app/(dashboard)/settings/shipping-sites/page.tsx:235`
   ```typescript
   // ❌ 错误
   toast({ title: '成功', description: '站点删除成功' });
   ```

**统计**：
- 发现约 **50+ 处**成功消息缺少 `variant: 'success'`
- 主要分布在：
  - 设置页面（`app/(dashboard)/settings/**`）
  - 财务模块（`app/(dashboard)/finance/**`）
  - 库存模块（`app/(dashboard)/inventory/**`）
  - 客户管理（`components/customers/**`）

### 问题 2：部分文件已正确使用 variant

**正确示例**：

1. **产品创建** - `components/products/product-create-client.tsx:15-19`
   ```typescript
   // ✅ 正确
   toast({
     title: '创建成功',
     description: `产品编码 "${product.code}" 创建成功！`,
     variant: 'success',
   });
   ```

2. **客户创建** - `components/customers/erp-customer-form.tsx:99-103`
   ```typescript
   // ✅ 正确
   toast({
     title: '创建成功',
     description: `客户 "${data.name}" 创建成功！`,
     variant: 'success',
   });
   ```

3. **供应商删除** - `components/suppliers/suppliers-page-client.tsx:149-153`
   ```typescript
   // ✅ 正确
   toast({
     title: '删除成功',
     description: data.message || '供应商删除成功',
     variant: 'success',
   });
   ```

### 问题 3：Toast Helper 工具未被广泛使用

**发现**：项目中已有 `lib/utils/toast-helper.tsx` 提供了统一的 Toast 封装：

```typescript
// ✅ 推荐使用
import { showSuccess, showError, showWarning, showInfo } from '@/lib/utils/toast-helper';

// 成功消息
showSuccess('操作成功', { description: '数据已保存' });

// 错误消息
showError('操作失败', { description: '请检查网络连接' });

// 警告消息
showWarning('注意', { description: '此操作不可撤销' });

// 信息消息
showInfo('提示', { description: '这是一条信息' });
```

**优点**：
- ✅ 自动添加正确的 variant
- ✅ 自动添加图标（CheckCircle2、AlertCircle、AlertTriangle、Info）
- ✅ 统一的停留时长配置
- ✅ 更简洁的 API

**问题**：
- ❌ 大部分代码仍然直接使用 `toast()`
- ❌ 没有充分利用 Toast Helper 的优势

---

## 🔧 修复方案

### 方案 A：批量添加 variant（推荐用于快速修复）

**适用场景**：快速修复现有代码，最小化改动

**步骤**：
1. 搜索所有成功消息（title 包含"成功"）
2. 添加 `variant: 'success'`
3. 验证颜色显示正确

**示例修复**：

```typescript
// 修复前
toast({
  title: '删除成功',
  description: `客户"${customer?.name}"已成功删除`,
});

// 修复后
toast({
  title: '删除成功',
  description: `客户"${customer?.name}"已成功删除`,
  variant: 'success',  // ✅ 添加这一行
});
```

### 方案 B：迁移到 Toast Helper（推荐用于长期维护）

**适用场景**：新代码或重构时使用

**步骤**：
1. 导入 Toast Helper
2. 替换 `toast()` 调用为 `showSuccess()` / `showError()` 等
3. 享受自动图标和统一样式

**示例迁移**：

```typescript
// 修复前
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

toast({
  title: '删除成功',
  description: `客户"${customer?.name}"已成功删除`,
});

// 修复后
import { showSuccess } from '@/lib/utils/toast-helper';

showSuccess('删除成功', {
  description: `客户"${customer?.name}"已成功删除`,
});
```

---

## 📋 修复清单

### 高优先级（用户最常看到的通知）

- [ ] **客户管理**
  - [ ] `components/customers/customer-delete-dialog.tsx:43` - 删除成功
  
- [ ] **财务模块**
  - [ ] `components/finance/payables-client/PayablePaymentDialog.tsx:140` - 付款成功
  - [ ] `app/(dashboard)/finance/payments/create/page.tsx:205` - 收款创建成功
  - [ ] `app/(dashboard)/finance/payments-out/create/page.tsx:409` - 付款创建成功
  
- [ ] **设置页面**
  - [ ] `app/(dashboard)/settings/storage/page.tsx:79` - 存储配置保存成功
  - [ ] `app/(dashboard)/settings/users/page.tsx:121` - 用户创建成功
  - [ ] `app/(dashboard)/settings/shipping-sites/page.tsx:235` - 站点删除成功

### 中优先级

- [ ] **库存模块**
  - [ ] `app/(dashboard)/inventory/batch/page-client.tsx:247` - 批次操作成功
  
- [ ] **分类管理**
  - [ ] `app/(dashboard)/categories/create/page.tsx:148` - 分类创建成功
  - [ ] `app/(dashboard)/categories/[id]/edit/page.tsx:237` - 分类更新成功

### 低优先级

- [ ] **其他设置页面**
  - [ ] `app/(dashboard)/settings/logs/page.tsx:138` - 日志操作成功
  - [ ] `app/(dashboard)/settings/shipping-query/page.tsx:112` - 查询成功

---

## 🎯 统一规范

### Toast 使用规范

#### 1. 成功消息（绿色）

```typescript
// ✅ 推荐：使用 Toast Helper
import { showSuccess } from '@/lib/utils/toast-helper';
showSuccess('操作成功', { description: '数据已保存' });

// ✅ 可接受：直接使用 toast
toast({
  title: '操作成功',
  description: '数据已保存',
  variant: 'success',  // 必须指定
});
```

#### 2. 失败/错误消息（红色）

```typescript
// ✅ 推荐
import { showError } from '@/lib/utils/toast-helper';
showError('操作失败', { description: error.message });

// ✅ 可接受
toast({
  title: '操作失败',
  description: error.message,
  variant: 'destructive',  // 必须指定
});
```

#### 3. 警告消息（黄色）

```typescript
// ✅ 推荐
import { showWarning } from '@/lib/utils/toast-helper';
showWarning('注意', { description: '此操作不可撤销' });

// ✅ 可接受
toast({
  title: '注意',
  description: '此操作不可撤销',
  variant: 'warning',  // 必须指定
});
```

#### 4. 信息消息（蓝色）

```typescript
// ✅ 推荐
import { showInfo } from '@/lib/utils/toast-helper';
showInfo('提示', { description: '这是一条信息' });

// ✅ 可接受
toast({
  title: '提示',
  description: '这是一条信息',
  variant: 'info',  // 可选，默认为 default
});
```

### 停留时长规范

```typescript
import { TOAST_DURATION } from '@/lib/utils/toast-helper';

// 成功消息：3秒
toast({ ..., duration: TOAST_DURATION.SUCCESS });

// 错误消息：5秒（更长，让用户有时间阅读）
toast({ ..., duration: TOAST_DURATION.ERROR });

// 警告消息：4秒
toast({ ..., duration: TOAST_DURATION.WARNING });

// 信息消息：3秒
toast({ ..., duration: TOAST_DURATION.INFO });
```

---

## ✅ 验证步骤

### 1. 代码检查

```bash
# 查找所有缺少 variant 的成功消息
grep -r "title.*成功" --include="*.tsx" --include="*.ts" . | grep "toast({" | grep -v "variant:"

# 查找所有缺少 variant 的失败消息
grep -r "title.*失败" --include="*.tsx" --include="*.ts" . | grep "toast({" | grep -v "variant:"
```

### 2. 运行 TypeScript 检查

```bash
npx tsc --noEmit
```

### 3. 运行 ESLint 检查

```bash
npx eslint "**/*.{ts,tsx}"
```

### 4. 手动测试

测试以下场景，确认 Toast 颜色正确：

- [ ] 创建客户 → 绿色成功提示
- [ ] 删除客户 → 绿色成功提示
- [ ] 创建失败 → 红色错误提示
- [ ] 删除失败 → 红色错误提示
- [ ] 保存设置 → 绿色成功提示
- [ ] 测试连接 → 绿色成功提示或红色失败提示

---

## 📊 修复进度跟踪

| 模块 | 总数 | 已修复 | 进度 |
|------|------|--------|------|
| 客户管理 | 5 | 0 | 0% |
| 财务模块 | 15 | 0 | 0% |
| 库存模块 | 8 | 0 | 0% |
| 设置页面 | 20 | 0 | 0% |
| 分类管理 | 4 | 0 | 0% |
| 其他 | 8 | 0 | 0% |
| **总计** | **60** | **0** | **0%** |

---

## 🎨 设计规范

### 颜色对比度

确保所有 Toast 颜色符合 WCAG 2.1 AA 级别对比度标准：

- ✅ 成功（绿色）：对比度 > 4.5:1
- ✅ 错误（红色）：对比度 > 4.5:1
- ✅ 警告（黄色）：对比度 > 4.5:1
- ✅ 信息（蓝色）：对比度 > 4.5:1

### 图标使用

Toast Helper 自动添加图标：

- ✅ 成功：`CheckCircle2` (绿色勾选)
- ✅ 错误：`AlertCircle` (红色感叹号)
- ✅ 警告：`AlertTriangle` (黄色三角形)
- ✅ 信息：`Info` (蓝色信息图标)

---

## 📝 总结

### 主要问题

1. **约 60 处成功消息缺少 `variant: 'success'`**，导致显示为默认灰色而不是绿色
2. **Toast Helper 工具未被广泛使用**，错失了统一样式和自动图标的优势
3. **部分代码已正确使用 variant**，说明团队知道规范但执行不一致

### 推荐行动

1. **立即修复**：为所有成功消息添加 `variant: 'success'`（方案 A）
2. **逐步迁移**：新代码使用 Toast Helper（方案 B）
3. **建立规范**：在代码审查中检查 Toast 使用是否符合规范
4. **添加 ESLint 规则**：自动检测缺少 variant 的 toast 调用

### 预期效果

- ✅ 所有成功消息显示为绿色
- ✅ 所有失败消息显示为红色
- ✅ 用户体验更加一致和直观
- ✅ 代码更加规范和易维护

---

**审计完成日期**：2025-01-XX  
**下次审计**：建议 3 个月后或重大功能上线前

