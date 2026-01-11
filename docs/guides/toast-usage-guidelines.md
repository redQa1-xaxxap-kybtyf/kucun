# Toast 使用规范

## 概述

本文档定义了项目中 Toast 通知的使用规范，确保用户能获得清晰、有用的反馈信息。

## 基本规则

### 1. 必须包含 `description`

所有 toast 都应包含具体的 `description` 信息：

```tsx
// ❌ 不推荐
toast({ title: '保存成功', variant: 'success' });

// ✅ 推荐
toast({
  title: '保存成功',
  description: '订单 SO-2026010001 已保存',
  variant: 'success',
});
```

### 2. 关键操作使用 `action` 按钮

创建、更新、删除等重要操作成功后，提供快捷跳转：

```tsx
import { ToastAction } from '@/components/ui/toast';

toast({
  title: '订单创建成功',
  description: `订单 ${orderNumber} 已创建`,
  action: (
    <ToastAction altText="查看订单" onClick={() => router.push(`/sales-orders/${id}`)}>
      查看
    </ToastAction>
  ),
});
```

### 3. 错误消息提供修复指导

```tsx
// ❌ 不推荐
toast({ title: '保存失败', variant: 'destructive' });

// ✅ 推荐
toast({
  title: '保存失败',
  description: '库存数量不能为负数，请检查后重试',
  variant: 'destructive',
});
```

## 各场景模板

### 创建成功

```tsx
toast({
  title: '创建成功',
  description: `${entityType} ${identifier} 已创建`,
  action: <ToastAction altText="查看详情" onClick={handleView}>查看</ToastAction>,
});
```

### 更新成功

```tsx
toast({
  title: '更新成功',
  description: `${entityType}信息已更新`,
});
```

### 删除成功

```tsx
toast({
  title: '删除成功',
  description: `${entityType} ${identifier} 已删除`,
});
```

### 操作失败

```tsx
toast({
  title: '操作失败',
  description: errorMessage || '请稍后重试',
  variant: 'destructive',
});
```

### 复制成功

```tsx
toast({
  title: '已复制',
  description: `${content} 已复制到剪贴板`,
});
```

## variant 使用规范

| variant | 使用场景 |
|---------|---------|
| `default` | 普通信息提示 |
| `success` | 操作成功 |
| `destructive` | 错误或失败 |
| `warning` | 警告信息 |

## 注意事项

1. **避免信息重复**：title 和 description 不要重复相同内容
2. **保持简洁**：description 控制在 50 字符以内
3. **提供可操作性**：错误消息告诉用户如何修复
4. **国际化**：所有文本使用中文
