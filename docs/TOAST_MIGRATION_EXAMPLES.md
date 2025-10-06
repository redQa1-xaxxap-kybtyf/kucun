# Toast 迁移示例

> 从旧的 `useToast` 迁移到新的 `toast-helper` 封装

## 📋 目录

1. [基本迁移](#基本迁移)
2. [Mutation 中的迁移](#mutation-中的迁移)
3. [批量操作迁移](#批量操作迁移)
4. [完整文件迁移示例](#完整文件迁移示例)

---

## 🔄 基本迁移

### 示例 1: 简单成功提示

**迁移前**:

```typescript
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

toast({
  title: '删除成功',
  description: '产品已成功删除',
  variant: 'success',
});
```

**迁移后**:

```typescript
import { showSuccess } from '@/lib/utils/toast-helper';

showSuccess('删除成功', {
  description: '产品已成功删除',
});
```

**改进点**:

- ✅ 减少 3 行代码
- ✅ 不需要调用 `useToast()` hook
- ✅ 自动添加图标
- ✅ 自动设置停留时长（3秒）

---

### 示例 2: 错误提示

**迁移前**:

```typescript
const { toast } = useToast();

toast({
  title: '删除失败',
  description: error.message || '删除产品时发生错误',
  variant: 'destructive',
});
```

**迁移后**:

```typescript
import { showError } from '@/lib/utils/toast-helper';

showError('删除失败', {
  description: error.message || '删除产品时发生错误',
});
```

**改进点**:

- ✅ 语义化的函数名 `showError`
- ✅ 自动设置停留时长（5秒）
- ✅ 自动添加错误图标

---

## 🔄 Mutation 中的迁移

### 示例 3: useMutation 成功/失败处理

**迁移前**:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

export function useProductDelete() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      toast({
        title: '删除成功',
        description: '产品已成功删除',
        variant: 'success',
      });

      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
      });
    },
    onError: (error: Error) => {
      toast({
        title: '删除失败',
        description: error.message || '删除产品时发生错误',
        variant: 'destructive',
      });
    },
  });

  return { deleteMutation };
}
```

**迁移后**:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { showSuccess, showError } from '@/lib/utils/toast-helper';

export function useProductDelete() {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      showSuccess('删除成功', {
        description: '产品已成功删除',
      });

      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
      });
    },
    onError: (error: Error) => {
      showError('删除失败', {
        description: error.message || '删除产品时发生错误',
      });
    },
  });

  return { deleteMutation };
}
```

**改进点**:

- ✅ 移除 `useToast()` hook 调用
- ✅ 减少导入依赖
- ✅ 代码更简洁

---

## 🔄 批量操作迁移

### 示例 4: 批量删除

**迁移前**:

```typescript
const { toast } = useToast();

const batchDeleteMutation = useMutation({
  mutationFn: batchDeleteProducts,
  onSuccess: async result => {
    if (result.success) {
      toast({
        title: '批量删除完成',
        description: result.message,
        variant: 'success',
      });
    } else {
      toast({
        title: '批量删除部分失败',
        description: result.message,
        variant: 'destructive',
      });
    }

    if (result.failedCount > 0 && result.failedProducts) {
      const failedDetails = result.failedProducts
        .map(p => `${p.code}: ${p.reason}`)
        .join('\n');

      toast({
        title: `${result.failedCount} 个产品删除失败`,
        description: failedDetails,
        variant: 'destructive',
      });
    }
  },
  onError: (error: Error) => {
    toast({
      title: '批量删除失败',
      description: error.message || '批量删除产品时发生错误',
      variant: 'destructive',
    });
  },
});
```

**迁移后**:

```typescript
import { showSuccess, showError, showWarning } from '@/lib/utils/toast-helper';

const batchDeleteMutation = useMutation({
  mutationFn: batchDeleteProducts,
  onSuccess: async result => {
    if (result.success) {
      showSuccess('批量删除完成', {
        description: result.message,
      });
    } else {
      showWarning('批量删除部分失败', {
        description: result.message,
      });
    }

    if (result.failedCount > 0 && result.failedProducts) {
      const failedDetails = result.failedProducts
        .map(p => `${p.code}: ${p.reason}`)
        .join('\n');

      showError(`${result.failedCount} 个产品删除失败`, {
        description: failedDetails,
      });
    }
  },
  onError: (error: Error) => {
    showError('批量删除失败', {
      description: error.message || '批量删除产品时发生错误',
    });
  },
});
```

**改进点**:

- ✅ 使用 `showWarning` 区分部分失败
- ✅ 更清晰的语义
- ✅ 自动设置不同的停留时长

---

## 🔄 完整文件迁移示例

### 示例 5: hooks/use-product-delete.ts

**迁移前** (完整文件):

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { toast } from '@/components/ui/use-toast';
import {
  batchDeleteProducts,
  deleteProduct,
  productQueryKeys,
} from '@/lib/api/products';

export function useProductDelete() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      toast({
        title: '删除成功',
        description: '产品已成功删除',
        variant: 'success',
      });

      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
        refetchType: 'all',
      });

      router.refresh();
    },
    onError: (error: Error) => {
      toast({
        title: '删除失败',
        description: error.message || '删除产品时发生错误',
        variant: 'destructive',
      });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteProducts,
    onSuccess: async result => {
      if (result.success) {
        toast({
          title: '批量删除完成',
          description: result.message,
          variant: 'success',
        });
      } else {
        toast({
          title: '批量删除部分失败',
          description: result.message,
          variant: 'destructive',
        });
      }

      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
        refetchType: 'all',
      });

      router.refresh();
    },
    onError: (error: Error) => {
      toast({
        title: '批量删除失败',
        description: error.message || '批量删除产品时发生错误',
        variant: 'destructive',
      });
    },
  });

  return {
    deleteMutation,
    batchDeleteMutation,
  };
}
```

**迁移后** (完整文件):

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import {
  batchDeleteProducts,
  deleteProduct,
  productQueryKeys,
} from '@/lib/api/products';
import { showSuccess, showError, showWarning } from '@/lib/utils/toast-helper';

export function useProductDelete() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      showSuccess('删除成功', {
        description: '产品已成功删除',
      });

      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
        refetchType: 'all',
      });

      router.refresh();
    },
    onError: (error: Error) => {
      showError('删除失败', {
        description: error.message || '删除产品时发生错误',
      });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteProducts,
    onSuccess: async result => {
      if (result.success) {
        showSuccess('批量删除完成', {
          description: result.message,
        });
      } else {
        showWarning('批量删除部分失败', {
          description: result.message,
        });
      }

      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
        refetchType: 'all',
      });

      router.refresh();
    },
    onError: (error: Error) => {
      showError('批量删除失败', {
        description: error.message || '批量删除产品时发生错误',
      });
    },
  });

  return {
    deleteMutation,
    batchDeleteMutation,
  };
}
```

**改进总结**:

- ✅ 移除 `toast` 导入
- ✅ 添加 `showSuccess`, `showError`, `showWarning` 导入
- ✅ 所有 `toast()` 调用替换为对应的封装函数
- ✅ 使用 `showWarning` 区分部分失败场景
- ✅ 代码更简洁，可读性更好

---

## 📝 迁移检查清单

### 迁移前检查

- [ ] 确认文件中所有 `useToast()` 调用位置
- [ ] 确认所有 `toast()` 调用的类型（success/error/info/warning）
- [ ] 确认是否有自定义 duration 或其他特殊配置

### 迁移步骤

1. [ ] 移除 `import { useToast } from '@/components/ui/use-toast'`
2. [ ] 添加 `import { showSuccess, showError, showInfo, showWarning } from '@/lib/utils/toast-helper'`
3. [ ] 移除 `const { toast } = useToast()` 调用
4. [ ] 替换所有 `toast({ variant: 'success', ... })` 为 `showSuccess(...)`
5. [ ] 替换所有 `toast({ variant: 'destructive', ... })` 为 `showError(...)`
6. [ ] 替换所有 `toast({ variant: 'default', ... })` 为 `showInfo(...)` 或 `showWarning(...)`

### 迁移后验证

- [ ] 运行 `npm run lint` 检查代码规范
- [ ] 运行 `npm run type-check` 检查类型错误
- [ ] 使用 Playwright 测试 Toast 显示
- [ ] 手动测试所有 Toast 场景
- [ ] 验证停留时长是否合理
- [ ] 验证图标显示正确

---

## 🎯 常见迁移场景

### 场景 1: 只有标题的 Toast

**迁移前**:

```typescript
toast({ title: '操作成功', variant: 'success' });
```

**迁移后**:

```typescript
showSuccess('操作成功');
```

---

### 场景 2: 有标题和描述的 Toast

**迁移前**:

```typescript
toast({
  title: '保存成功',
  description: '数据已保存到数据库',
  variant: 'success',
});
```

**迁移后**:

```typescript
showSuccess('保存成功', {
  description: '数据已保存到数据库',
});
```

---

### 场景 3: 自定义停留时长

**迁移前**:

```typescript
toast({
  title: '重要提示',
  description: '请仔细阅读',
  variant: 'default',
  duration: 10000,
});
```

**迁移后**:

```typescript
showInfo('重要提示', {
  description: '请仔细阅读',
  duration: 10000,
});
```

---

### 场景 4: 不显示图标

**迁移前**:

```typescript
toast({
  title: '提示',
  variant: 'success',
});
```

**迁移后**:

```typescript
showSuccess('提示', {
  showIcon: false,
});
```

---

## 📚 参考资源

- [Toast 使用指南](./TOAST_NOTIFICATION_GUIDE.md)
- [Toast 统一化分析报告](../TOAST_NOTIFICATION_UNIFICATION_REPORT.md)
- [shadcn/ui Toast 组件](https://ui.shadcn.com/docs/components/toast)

---

**文档版本**: 1.0.0  
**最后更新**: 2025-10-05  
**维护者**: 开发团队
