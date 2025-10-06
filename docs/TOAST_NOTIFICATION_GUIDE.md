# Toast/Notification 使用指南

> 统一的 Toast 提示规范，基于 shadcn/ui 和 Next.js 15.4 最佳实践

## 📋 目录

1. [核心原则](#核心原则)
2. [快速开始](#快速开始)
3. [API 参考](#api-参考)
4. [使用场景](#使用场景)
5. [最佳实践](#最佳实践)
6. [常见问题](#常见问题)

---

## 🎯 核心原则

### 1. 统一使用封装的 Toast 工具

✅ **推荐**: 使用 `lib/utils/toast-helper.tsx` 提供的封装函数

```typescript
import {
  showSuccess,
  showError,
  showInfo,
  showWarning,
} from '@/lib/utils/toast-helper';
```

❌ **避免**: 直接使用 `useToast()` hook（除非有特殊需求）

### 2. 统一的停留时长

所有 Toast 提示都遵循以下停留时长标准：

| 类型           | 停留时长 | 说明                       |
| -------------- | -------- | -------------------------- |
| 成功 (Success) | 3秒      | 快速确认操作成功           |
| 错误 (Error)   | 5秒      | 给用户足够时间阅读错误信息 |
| 信息 (Info)    | 3秒      | 一般性提示信息             |
| 警告 (Warning) | 4秒      | 需要用户注意的警告         |

### 3. 统一的样式和图标

- ✅ 成功：绿色背景 + CheckCircle2 图标
- ❌ 错误：红色背景 + AlertCircle 图标
- ℹ️ 信息：蓝色背景 + Info 图标
- ⚠️ 警告：黄色背景 + AlertTriangle 图标

---

## 🚀 快速开始

### 基本用法

```typescript
import {
  showSuccess,
  showError,
  showInfo,
  showWarning,
} from '@/lib/utils/toast-helper';

// 成功提示
showSuccess('操作成功');

// 错误提示
showError('操作失败');

// 信息提示
showInfo('提示信息');

// 警告提示
showWarning('注意事项');
```

### 带描述的提示

```typescript
showSuccess('删除成功', {
  description: '产品已成功删除',
});

showError('删除失败', {
  description: '该产品正在被使用，无法删除',
});
```

### 自定义停留时长

```typescript
showInfo('重要提示', {
  description: '请仔细阅读以下内容',
  duration: 10000, // 10秒
});
```

### 不显示图标

```typescript
showSuccess('操作成功', {
  showIcon: false,
});
```

---

## 📚 API 参考

### `showSuccess(message, options?)`

显示成功提示

**参数:**

- `message: string` - 提示标题（必填）
- `options?: ToastOptions` - 配置选项（可选）
  - `description?: string` - 描述信息
  - `duration?: number` - 停留时长（毫秒），默认 3000
  - `showIcon?: boolean` - 是否显示图标，默认 true

**返回值:** Toast 实例

**示例:**

```typescript
showSuccess('保存成功', {
  description: '数据已成功保存到数据库',
  duration: 3000,
});
```

### `showError(message, options?)`

显示错误提示

**参数:** 同 `showSuccess`

**示例:**

```typescript
showError('保存失败', {
  description: '网络连接失败，请检查网络设置',
  duration: 5000,
});
```

### `showInfo(message, options?)`

显示信息提示

**参数:** 同 `showSuccess`

**示例:**

```typescript
showInfo('系统提示', {
  description: '您有新的消息',
});
```

### `showWarning(message, options?)`

显示警告提示

**参数:** 同 `showSuccess`

**示例:**

```typescript
showWarning('操作警告', {
  description: '此操作不可撤销，请谨慎操作',
  duration: 4000,
});
```

### `TOAST_DURATION` 常量

预定义的停留时长常量

```typescript
import { TOAST_DURATION } from '@/lib/utils/toast-helper';

TOAST_DURATION.SUCCESS; // 3000ms
TOAST_DURATION.ERROR; // 5000ms
TOAST_DURATION.INFO; // 3000ms
TOAST_DURATION.WARNING; // 4000ms
```

---

## 💡 使用场景

### 场景 1: API 调用成功/失败

```typescript
import { useMutation } from '@tanstack/react-query';
import { showSuccess, showError } from '@/lib/utils/toast-helper';

const mutation = useMutation({
  mutationFn: createProduct,
  onSuccess: () => {
    showSuccess('创建成功', {
      description: '产品已成功创建',
    });
  },
  onError: (error: Error) => {
    showError('创建失败', {
      description: error.message || '创建产品时发生错误',
    });
  },
});
```

### 场景 2: 表单提交

```typescript
const onSubmit = async (data: FormData) => {
  try {
    await submitForm(data);
    showSuccess('提交成功');
    router.push('/success');
  } catch (error) {
    showError('提交失败', {
      description: error instanceof Error ? error.message : '未知错误',
    });
  }
};
```

### 场景 3: 删除确认

```typescript
const handleDelete = async (id: string) => {
  try {
    await deleteItem(id);
    showSuccess('删除成功', {
      description: '项目已成功删除',
    });
  } catch (error) {
    showError('删除失败', {
      description: '该项目正在被使用，无法删除',
    });
  }
};
```

### 场景 4: 批量操作

```typescript
const handleBatchDelete = async (ids: string[]) => {
  const result = await batchDelete(ids);

  if (result.success) {
    showSuccess('批量删除完成', {
      description: `成功删除 ${result.successCount} 个项目`,
    });
  } else {
    showWarning('批量删除部分失败', {
      description: `成功: ${result.successCount}, 失败: ${result.failedCount}`,
    });
  }
};
```

### 场景 5: 状态更新

```typescript
const toggleStatus = async (id: string, status: string) => {
  try {
    await updateStatus(id, status);
    showInfo('状态已更新', {
      description: `状态已切换为: ${status}`,
    });
  } catch (error) {
    showError('状态更新失败', {
      description: error.message,
    });
  }
};
```

---

## 🎓 最佳实践

### 1. 提示信息要清晰具体

✅ **好的示例:**

```typescript
showSuccess('产品创建成功', {
  description: '产品 "iPhone 15 Pro" 已添加到库存',
});
```

❌ **不好的示例:**

```typescript
showSuccess('成功'); // 太模糊
```

### 2. 错误信息要有帮助性

✅ **好的示例:**

```typescript
showError('保存失败', {
  description: '产品编码已存在，请使用其他编码',
});
```

❌ **不好的示例:**

```typescript
showError('错误'); // 没有提供有用信息
```

### 3. 合理使用停留时长

```typescript
// 简单确认 - 使用默认时长
showSuccess('保存成功');

// 重要信息 - 延长停留时长
showWarning('数据即将过期', {
  description: '请在 24 小时内完成操作',
  duration: 8000, // 8秒
});
```

### 4. 避免过度使用

❌ **不要:**

- 每个小操作都显示 Toast
- 同时显示多个 Toast（当前限制为 1 个）
- 使用 Toast 显示长篇内容

✅ **应该:**

- 只在关键操作时显示 Toast
- 使用简洁的文字
- 重要内容使用 Dialog 或 Alert

---

## ❓ 常见问题

### Q1: 如何同时显示多个 Toast？

A: 当前配置限制为同时显示 1 个 Toast。如需修改，请编辑 `components/ui/use-toast.ts`:

```typescript
const TOAST_LIMIT = 3; // 修改为允许的数量
```

### Q2: 如何自定义 Toast 样式？

A: 使用 `className` 属性（需要直接使用 `useToast` hook）:

```typescript
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

toast({
  title: '自定义样式',
  className: 'bg-purple-500 text-white',
});
```

### Q3: Toast 位置可以修改吗？

A: 可以。编辑 `components/ui/toast.tsx` 中的 `ToastViewport` 组件:

```typescript
// 当前位置: 移动端顶部，桌面端右下角
// 修改 className 可以调整位置
```

### Q4: 如何在 Server Component 中使用 Toast？

A: Toast 只能在 Client Component 中使用。如需在 Server Action 后显示 Toast，请:

1. 在 Server Action 中返回结果
2. 在 Client Component 中处理结果并显示 Toast

```typescript
// Server Action
export async function createProduct(data: FormData) {
  // ... 处理逻辑
  return { success: true, message: '创建成功' };
}

// Client Component
('use client');
const handleSubmit = async (data: FormData) => {
  const result = await createProduct(data);
  if (result.success) {
    showSuccess(result.message);
  }
};
```

---

## 📊 迁移指南

### 从旧的 `useToast` 迁移到新的封装

**旧代码:**

```typescript
const { toast } = useToast();

toast({
  title: '删除成功',
  description: '产品已成功删除',
  variant: 'success',
});
```

**新代码:**

```typescript
import { showSuccess } from '@/lib/utils/toast-helper';

showSuccess('删除成功', {
  description: '产品已成功删除',
});
```

---

## 📚 参考资源

- [shadcn/ui Toast 组件](https://ui.shadcn.com/docs/components/toast)
- [Radix UI Toast](https://www.radix-ui.com/docs/primitives/components/toast)
- [项目代码规范](./AGENTS.md)

---

**文档版本**: 1.0.0  
**最后更新**: 2025-10-05  
**维护者**: 开发团队
