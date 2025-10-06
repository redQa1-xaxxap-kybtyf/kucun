# 表单处理统一指南

> 项目中所有表单处理的统一规范和最佳实践

**版本**: 1.0.0  
**更新日期**: 2025-10-05  
**适用范围**: 全项目

---

## 📋 目录

1. [核心原则](#核心原则)
2. [快速开始](#快速开始)
3. [API 参考](#api-参考)
4. [使用场景](#使用场景)
5. [最佳实践](#最佳实践)
6. [常见问题](#常见问题)

---

## 🎯 核心原则

### 1. 统一的提交逻辑

所有表单提交都使用 `useFormSubmit` Hook，确保提交逻辑的一致性。

### 2. 自动化错误处理

自动处理错误、显示 Toast、设置错误状态，减少重复代码。

### 3. 类型安全

完整的 TypeScript 类型定义，确保类型安全。

### 4. 用户友好的反馈

自动显示成功/失败 Toast，提供清晰的用户反馈。

---

## 🚀 快速开始

### 安装

表单处理工具已内置，无需安装。

### 基本使用

```typescript
import { useFormSubmit } from '@/lib/hooks/use-form-submit';

const { handleSubmit, isSubmitting, error } = useFormSubmit({
  onSubmit: async (data) => {
    return await createProduct(data);
  },
  onSuccess: (product) => {
    router.push(`/products/${product.id}`);
  },
  successMessage: '产品创建成功',
  errorMessage: '产品创建失败',
});

// 在表单中使用
<form onSubmit={form.handleSubmit(handleSubmit)}>
  {error && <ErrorMessage message={error} />}
  <Button type="submit" disabled={isSubmitting}>
    {isSubmitting ? '提交中...' : '提交'}
  </Button>
</form>
```

---

## 📚 API 参考

### `useFormSubmit(options)`

统一的表单提交 Hook

**参数**:

```typescript
interface UseFormSubmitOptions<TData, TResult> {
  onSubmit: (data: TData) => Promise<TResult>;
  onSuccess?: (result: TResult) => void | Promise<void>;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  isValidation?: boolean;
}
```

**返回值**:

```typescript
interface UseFormSubmitReturn<TData> {
  handleSubmit: (data: TData) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
  setError: (error: string) => void;
}
```

**示例**:

```typescript
const { handleSubmit, isSubmitting, error } = useFormSubmit({
  onSubmit: async data => {
    return await createProduct(data);
  },
  successMessage: '创建成功',
  errorMessage: '创建失败',
});
```

---

### `useFormSubmitSimple(options)`

简化版表单提交 Hook，不显示 Toast

**示例**:

```typescript
const { handleSubmit, isSubmitting, error } = useFormSubmitSimple({
  onSubmit: async data => {
    return await updateProfile(data);
  },
});
```

---

### `useFormSubmitValidation(options)`

验证表单提交 Hook，专门用于表单验证错误处理

**示例**:

```typescript
const { handleSubmit, isSubmitting, error } = useFormSubmitValidation({
  onSubmit: async data => {
    return await validateAndSubmit(data);
  },
  successMessage: '验证通过',
});
```

---

### `useFormSubmitWithConfirm(options)`

带确认的表单提交 Hook

**示例**:

```typescript
const { handleSubmit, isSubmitting } = useFormSubmitWithConfirm({
  onSubmit: async data => {
    return await deleteProduct(data.id);
  },
  confirmMessage: '确定要删除这个产品吗？',
  successMessage: '产品已删除',
});
```

---

## 💡 使用场景

### 场景 1: 创建表单

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFormSubmit } from '@/lib/hooks/use-form-submit';

function CreateProductForm() {
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(productSchema),
  });

  const { handleSubmit, isSubmitting, error } = useFormSubmit({
    onSubmit: async (data) => {
      return await createProduct(data);
    },
    onSuccess: (product) => {
      router.push(`/products/${product.id}`);
    },
    successMessage: '产品创建成功',
    errorMessage: '产品创建失败',
  });

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)}>
      {error && <ErrorMessage message={error} />}

      <Input {...form.register('name')} />

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '创建中...' : '创建产品'}
      </Button>
    </form>
  );
}
```

---

### 场景 2: 更新表单

```typescript
const { handleSubmit, isSubmitting } = useFormSubmit({
  onSubmit: async data => {
    return await updateProduct(productId, data);
  },
  onSuccess: () => {
    router.push('/products');
  },
  successMessage: '产品更新成功',
  errorMessage: '产品更新失败',
});
```

---

### 场景 3: 删除确认

```typescript
const { handleSubmit, isSubmitting } = useFormSubmitWithConfirm({
  onSubmit: async data => {
    return await deleteProduct(data.id);
  },
  confirmMessage: '确定要删除这个产品吗？此操作不可撤销。',
  successMessage: '产品已删除',
  errorMessage: '删除失败',
});
```

---

### 场景 4: 不显示 Toast

```typescript
const { handleSubmit, isSubmitting, error } = useFormSubmitSimple({
  onSubmit: async data => {
    return await updateSettings(data);
  },
  onSuccess: () => {
    // 自定义成功处理
    console.log('设置已更新');
  },
});
```

---

### 场景 5: 表单验证

```typescript
const { handleSubmit, isSubmitting, error } = useFormSubmitValidation({
  onSubmit: async data => {
    return await validateAndSubmit(data);
  },
  successMessage: '验证通过',
  errorMessage: '验证失败',
});
```

---

## ✅ 最佳实践

### 1. 始终使用统一的表单提交 Hook

❌ **错误**:

```typescript
const onSubmit = async data => {
  setIsSubmitting(true);
  try {
    await createProduct(data);
    toast({ title: '成功' });
  } catch (error) {
    toast({ title: '失败', description: error.message });
  } finally {
    setIsSubmitting(false);
  }
};
```

✅ **正确**:

```typescript
const { handleSubmit, isSubmitting } = useFormSubmit({
  onSubmit: createProduct,
  successMessage: '创建成功',
  errorMessage: '创建失败',
});
```

---

### 2. 提供有意义的成功/失败消息

❌ **错误**:

```typescript
successMessage: '成功',
errorMessage: '失败',
```

✅ **正确**:

```typescript
successMessage: '产品创建成功',
errorMessage: '产品创建失败',
```

---

### 3. 在成功回调中处理导航

✅ **正确**:

```typescript
const { handleSubmit } = useFormSubmit({
  onSubmit: createProduct,
  onSuccess: product => {
    router.push(`/products/${product.id}`);
  },
});
```

---

### 4. 显示错误信息

✅ **正确**:

```typescript
const { handleSubmit, error } = useFormSubmit({
  onSubmit: createProduct,
});

return (
  <form onSubmit={form.handleSubmit(handleSubmit)}>
    {error && <ErrorMessage message={error} />}
    {/* 表单字段 */}
  </form>
);
```

---

### 5. 禁用提交按钮

✅ **正确**:

```typescript
const { handleSubmit, isSubmitting } = useFormSubmit({
  onSubmit: createProduct,
});

return (
  <Button type="submit" disabled={isSubmitting}>
    {isSubmitting ? '提交中...' : '提交'}
  </Button>
);
```

---

## ❓ 常见问题

### Q1: 什么时候使用 `useFormSubmit` vs `useFormSubmitSimple`?

**A**:

- 使用 `useFormSubmit`: 需要自动显示 Toast
- 使用 `useFormSubmitSimple`: 需要自定义成功/失败处理

---

### Q2: 如何自定义错误处理?

**A**: 使用 `onError` 回调

```typescript
const { handleSubmit } = useFormSubmit({
  onSubmit: createProduct,
  onError: error => {
    console.error('提交失败:', error);
    // 自定义错误处理
  },
});
```

---

### Q3: 如何在提交前验证数据?

**A**: 使用 React Hook Form 的验证

```typescript
const form = useForm({
  resolver: zodResolver(schema),
});

const { handleSubmit } = useFormSubmit({
  onSubmit: createProduct,
});

<form onSubmit={form.handleSubmit(handleSubmit)}>
```

---

### Q4: 如何处理多步骤表单?

**A**: 在 `onSuccess` 中处理步骤切换

```typescript
const { handleSubmit } = useFormSubmit({
  onSubmit: submitStep,
  onSuccess: () => {
    setCurrentStep(currentStep + 1);
  },
  showSuccessToast: false, // 不显示 Toast
});
```

---

## 📊 表单处理流程图

```
用户提交表单
  ↓
React Hook Form 验证
  ↓
验证通过? ──否──→ 显示验证错误
  ↓ 是
调用 handleSubmit
  ↓
设置 isSubmitting = true
  ↓
调用 onSubmit
  ↓
成功? ──否──→ 处理错误 → 显示错误 Toast → 调用 onError
  ↓ 是
显示成功 Toast
  ↓
调用 onSuccess
  ↓
设置 isSubmitting = false
```

---

## 🔗 相关文档

- ✅ 错误处理指南: `docs/ERROR_HANDLING_GUIDE.md`
- ✅ Toast 使用指南: `docs/TOAST_NOTIFICATION_GUIDE.md`
- ✅ 表单处理工具: `lib/hooks/use-form-submit.ts`

---

**维护者**: 开发团队  
**最后更新**: 2025-10-05
