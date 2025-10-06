# 对话框统一指南

> 项目中所有对话框/模态框的统一规范和最佳实践

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

### 1. 统一的对话框组件

所有确认对话框都使用 `ConfirmDialog` 组件，确保交互一致性。

### 2. 语义化的变体

提供 4 种语义化的变体：

- `default` - 默认操作
- `destructive` - 危险操作（删除、清空等）
- `warning` - 警告操作
- `info` - 信息提示

### 3. 用户友好的反馈

自动显示加载状态，提供清晰的用户反馈。

### 4. Promise 风格的 API

使用 `useConfirmDialog` Hook 提供 Promise 风格的 API，简化异步操作。

---

## 🚀 快速开始

### 安装

对话框组件已内置，无需安装。

### 基本使用

#### 方式 1: 使用组件

```typescript
import { useState } from 'react';
import { ConfirmDialog } from '@/components/common/confirm-dialog';

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>删除</Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={async () => {
          await deleteProduct(id);
        }}
        title="删除产品"
        description="确定要删除这个产品吗？此操作不可撤销。"
        variant="destructive"
      />
    </>
  );
}
```

#### 方式 2: 使用 Hook（推荐）

```typescript
import { useConfirmDialog } from '@/components/common/confirm-dialog';

function MyComponent() {
  const { confirmDialog, confirm } = useConfirmDialog();

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: '删除产品',
      description: '确定要删除这个产品吗？此操作不可撤销。',
      variant: 'destructive',
    });

    if (confirmed) {
      await deleteProduct(id);
    }
  };

  return (
    <>
      <Button onClick={handleDelete}>删除</Button>
      {confirmDialog}
    </>
  );
}
```

---

## 📚 API 参考

### `ConfirmDialog` 组件

**属性**:

```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'warning' | 'info';
  isLoading?: boolean;
}
```

**示例**:

```typescript
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  onConfirm={async () => {
    await deleteProduct(id);
  }}
  title="删除产品"
  description="确定要删除这个产品吗？"
  variant="destructive"
/>
```

---

### `useConfirmDialog` Hook

**返回值**:

```typescript
interface UseConfirmDialogReturn {
  confirmDialog: React.ReactNode;
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}
```

**示例**:

```typescript
const { confirmDialog, confirm } = useConfirmDialog();

const confirmed = await confirm({
  title: '删除产品',
  description: '确定要删除这个产品吗？',
  variant: 'destructive',
});
```

---

## 💡 使用场景

### 场景 1: 删除确认

```typescript
const { confirmDialog, confirm } = useConfirmDialog();

const handleDelete = async () => {
  const confirmed = await confirm({
    title: '删除产品',
    description: '确定要删除这个产品吗？此操作不可撤销。',
    confirmText: '删除',
    cancelText: '取消',
    variant: 'destructive',
  });

  if (confirmed) {
    await deleteProduct(id);
    showSuccess('产品已删除');
  }
};
```

---

### 场景 2: 批量删除

```typescript
const { confirmDialog, confirm } = useConfirmDialog();

const handleBatchDelete = async () => {
  const confirmed = await confirm({
    title: '批量删除',
    description: `确定要删除选中的 ${selectedIds.length} 个产品吗？此操作不可撤销。`,
    confirmText: '删除',
    variant: 'destructive',
  });

  if (confirmed) {
    await batchDeleteProducts(selectedIds);
    showSuccess(`已删除 ${selectedIds.length} 个产品`);
  }
};
```

---

### 场景 3: 状态切换确认

```typescript
const { confirmDialog, confirm } = useConfirmDialog();

const handleToggleStatus = async () => {
  const confirmed = await confirm({
    title: '切换状态',
    description: '确定要切换产品状态吗？',
    confirmText: '确认',
    variant: 'warning',
  });

  if (confirmed) {
    await toggleProductStatus(id);
    showSuccess('状态已更新');
  }
};
```

---

### 场景 4: 离开页面确认

```typescript
const { confirmDialog, confirm } = useConfirmDialog();

const handleLeave = async () => {
  if (hasUnsavedChanges) {
    const confirmed = await confirm({
      title: '未保存的更改',
      description: '您有未保存的更改，确定要离开吗？',
      confirmText: '离开',
      cancelText: '继续编辑',
      variant: 'warning',
    });

    if (confirmed) {
      router.push('/products');
    }
  } else {
    router.push('/products');
  }
};
```

---

### 场景 5: 信息确认

```typescript
const { confirmDialog, confirm } = useConfirmDialog();

const handleSubmit = async () => {
  const confirmed = await confirm({
    title: '提交订单',
    description: '确定要提交这个订单吗？',
    confirmText: '提交',
    variant: 'info',
  });

  if (confirmed) {
    await submitOrder(data);
    showSuccess('订单已提交');
  }
};
```

---

## ✅ 最佳实践

### 1. 使用 Hook 而不是组件

❌ **不推荐**:

```typescript
const [open, setOpen] = useState(false);

<Button onClick={() => setOpen(true)}>删除</Button>
<ConfirmDialog open={open} onOpenChange={setOpen} ... />
```

✅ **推荐**:

```typescript
const { confirmDialog, confirm } = useConfirmDialog();

<Button onClick={async () => {
  const confirmed = await confirm({ ... });
  if (confirmed) { ... }
}}>删除</Button>
{confirmDialog}
```

---

### 2. 选择合适的变体

- `destructive` - 删除、清空、重置等危险操作
- `warning` - 状态切换、离开页面等警告操作
- `info` - 提交、确认等信息操作
- `default` - 其他一般操作

---

### 3. 提供清晰的描述

❌ **不好**:

```typescript
title: '确认',
description: '确定吗？',
```

✅ **好**:

```typescript
title: '删除产品',
description: '确定要删除这个产品吗？此操作不可撤销。',
```

---

### 4. 自定义按钮文本

```typescript
const confirmed = await confirm({
  title: '删除产品',
  description: '确定要删除这个产品吗？',
  confirmText: '删除',
  cancelText: '取消',
  variant: 'destructive',
});
```

---

### 5. 处理异步操作

```typescript
const handleDelete = async () => {
  const confirmed = await confirm({
    title: '删除产品',
    description: '确定要删除这个产品吗？',
    variant: 'destructive',
  });

  if (confirmed) {
    try {
      await deleteProduct(id);
      showSuccess('产品已删除');
    } catch (error) {
      showError('删除失败', {
        description: getErrorMessage(error),
      });
    }
  }
};
```

---

## ❓ 常见问题

### Q1: 如何在对话框中显示加载状态?

**A**: 使用 `isLoading` 属性

```typescript
<ConfirmDialog
  isLoading={isDeleting}
  ...
/>
```

---

### Q2: 如何自定义对话框样式?

**A**: 使用 `variant` 属性选择预定义的样式，或者直接使用 shadcn/ui 的 `AlertDialog` 组件自定义。

---

### Q3: 如何在对话框关闭时执行操作?

**A**: 使用 `onCancel` 回调

```typescript
<ConfirmDialog
  onCancel={() => {
    console.log('对话框已取消');
  }}
  ...
/>
```

---

### Q4: 如何在多个地方使用同一个对话框?

**A**: 在父组件中创建对话框，通过 props 传递

```typescript
function ParentComponent() {
  const { confirmDialog, confirm } = useConfirmDialog();

  return (
    <>
      <ChildComponent onDelete={async (id) => {
        const confirmed = await confirm({ ... });
        if (confirmed) { ... }
      }} />
      {confirmDialog}
    </>
  );
}
```

---

## 📊 对话框变体对比

| 变体          | 图标 | 颜色 | 使用场景           |
| ------------- | ---- | ---- | ------------------ |
| `default`     | ✓    | 绿色 | 一般操作           |
| `destructive` | ⚠   | 红色 | 删除、清空         |
| `warning`     | ⚠   | 黄色 | 状态切换、离开页面 |
| `info`        | ℹ   | 蓝色 | 提交、确认         |

---

## 🔗 相关文档

- ✅ 表单处理指南: `docs/FORM_HANDLING_GUIDE.md`
- ✅ 错误处理指南: `docs/ERROR_HANDLING_GUIDE.md`
- ✅ Toast 使用指南: `docs/TOAST_NOTIFICATION_GUIDE.md`

---

**维护者**: 开发团队  
**最后更新**: 2025-10-05
