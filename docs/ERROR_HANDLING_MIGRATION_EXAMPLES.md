# 错误处理迁移示例

> 从旧的错误处理方式迁移到统一的错误处理工具

**版本**: 1.0.0  
**更新日期**: 2025-10-05

---

## 📋 目录

1. [基本迁移](#基本迁移)
2. [Mutation 迁移](#mutation-迁移)
3. [表单错误处理](#表单错误处理)
4. [文件上传错误处理](#文件上传错误处理)
5. [服务器组件错误处理](#服务器组件错误处理)

---

## 🔄 基本迁移

### 示例 1: 简单的 try-catch

**迁移前**:

```typescript
try {
  await apiCall();
} catch (error) {
  showError(error.message); // ❌ 可能导致类型错误
}
```

**迁移后**:

```typescript
import { handleApiErrorWithToast } from '@/lib/utils/error-handler';

try {
  await apiCall();
} catch (error) {
  handleApiErrorWithToast(error, '操作失败');
}
```

**改进点**:

- ✅ 类型安全
- ✅ 统一的错误信息格式
- ✅ 自动显示 Toast

---

### 示例 2: 手动处理错误

**迁移前**:

```typescript
try {
  await apiCall();
} catch (error) {
  const message = error instanceof Error ? error.message : '未知错误';
  console.error(message);
  showError(message);
}
```

**迁移后**:

```typescript
import { handleApiError } from '@/lib/utils/error-handler';

try {
  await apiCall();
} catch (error) {
  const appError = handleApiError(error);
  console.error(appError.message);
  showError(appError.message);
}
```

**改进点**:

- ✅ 统一的错误转换
- ✅ 更丰富的错误信息（错误码、状态码）
- ✅ 类型安全

---

## 🔄 Mutation 迁移

### 示例 3: useMutation onError

**迁移前**:

```typescript
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

const mutation = useMutation({
  mutationFn: deleteProduct,
  onSuccess: () => {
    toast({
      title: '删除成功',
      description: '产品已成功删除',
      variant: 'success',
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
```

**迁移后**:

```typescript
import { useMutation } from '@tanstack/react-query';
import { showSuccess } from '@/lib/utils/toast-helper';
import { handleApiErrorWithToast } from '@/lib/utils/error-handler';

const mutation = useMutation({
  mutationFn: deleteProduct,
  onSuccess: () => {
    showSuccess('删除成功', {
      description: '产品已成功删除',
    });
  },
  onError: error => {
    handleApiErrorWithToast(error, '删除失败');
  },
});
```

**改进点**:

- ✅ 移除 `useToast` hook
- ✅ 统一的错误处理
- ✅ 更简洁的代码

---

### 示例 4: 带错误类型判断的 Mutation

**迁移前**:

```typescript
const mutation = useMutation({
  mutationFn: apiCall,
  onError: (error: Error) => {
    if (error.message.includes('401')) {
      router.push('/login');
    } else {
      toast({
        title: '操作失败',
        description: error.message,
        variant: 'destructive',
      });
    }
  },
});
```

**迁移后**:

```typescript
import { handleApiError, isAuthError } from '@/lib/utils/error-handler';
import { showError } from '@/lib/utils/toast-helper';

const mutation = useMutation({
  mutationFn: apiCall,
  onError: error => {
    const appError = handleApiError(error);

    if (appError.isAuthError()) {
      showError('登录已过期', {
        description: '请重新登录',
      });
      router.push('/login');
    } else {
      showError('操作失败', {
        description: appError.message,
      });
    }
  },
});
```

**改进点**:

- ✅ 使用 `isAuthError()` 方法判断
- ✅ 更清晰的错误类型判断
- ✅ 统一的错误处理

---

## 🔄 表单错误处理

### 示例 5: 表单提交错误

**迁移前**:

```typescript
const onSubmit = async (data: FormData) => {
  try {
    await submitForm(data);
    toast({ title: '提交成功', variant: 'success' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '提交失败';
    form.setError('root', { message });
    toast({ title: '提交失败', description: message, variant: 'destructive' });
  }
};
```

**迁移后**:

```typescript
import { handleValidationError } from '@/lib/utils/error-handler';
import { showSuccess, showError } from '@/lib/utils/toast-helper';

const onSubmit = async (data: FormData) => {
  try {
    await submitForm(data);
    showSuccess('提交成功');
  } catch (error) {
    const validationError = handleValidationError(error);
    form.setError('root', { message: validationError.message });
    showError('提交失败', {
      description: validationError.message,
    });
  }
};
```

**改进点**:

- ✅ 使用 `handleValidationError` 处理验证错误
- ✅ 统一的错误信息格式
- ✅ 类型安全

---

## 🔄 文件上传错误处理

### 示例 6: 文件上传错误

**迁移前**:

```typescript
const [uploadError, setUploadError] = useState<string | null>(null);

try {
  const url = await uploadFile(file);
  setUploadError(null);
} catch (error) {
  setUploadError(error instanceof Error ? error.message : '上传失败，请重试');
}
```

**迁移后**:

```typescript
import { handleApiError, getErrorMessage } from '@/lib/utils/error-handler';

const [uploadError, setUploadError] = useState<string | null>(null);

try {
  const url = await uploadFile(file);
  setUploadError(null);
} catch (error) {
  const appError = handleApiError(error);
  setUploadError(appError.message);
}

// 或者更简洁的方式
try {
  const url = await uploadFile(file);
  setUploadError(null);
} catch (error) {
  setUploadError(getErrorMessage(error));
}
```

**改进点**:

- ✅ 使用 `getErrorMessage` 安全获取错误信息
- ✅ 统一的错误处理
- ✅ 更简洁的代码

---

### 示例 7: 文件上传带 Toast

**迁移前**:

```typescript
try {
  const url = await uploadFile(file);
  toast({ title: '上传成功', variant: 'success' });
} catch (error) {
  const message = error instanceof Error ? error.message : '上传失败';
  setUploadError(message);
  toast({ title: '上传失败', description: message, variant: 'destructive' });
}
```

**迁移后**:

```typescript
import { handleApiErrorWithToast } from '@/lib/utils/error-handler';
import { showSuccess } from '@/lib/utils/toast-helper';

try {
  const url = await uploadFile(file);
  showSuccess('上传成功');
} catch (error) {
  const appError = handleApiErrorWithToast(error, '上传失败');
  setUploadError(appError.message);
}
```

**改进点**:

- ✅ 自动显示 Toast
- ✅ 统一的错误处理
- ✅ 更简洁的代码

---

## 🔄 服务器组件错误处理

### 示例 8: 服务器组件数据获取

**迁移前**:

```typescript
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw new Error('获取数据失败');
    }
    return await response.json();
  } catch (error) {
    return { error: error instanceof Error ? error.message : '未知错误' };
  }
}

export default async function Page() {
  const result = await fetchData();

  if ('error' in result) {
    return <ErrorMessage message={result.error} />;
  }

  return <Content data={result} />;
}
```

**迁移后**:

```typescript
import { handleApiError } from '@/lib/utils/error-handler';

async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw response;
    }
    return await response.json();
  } catch (error) {
    const appError = handleApiError(error);
    return { error: appError.message };
  }
}

export default async function Page() {
  const result = await fetchData();

  if ('error' in result) {
    return (
      <ErrorMessage
        title="加载失败"
        message={result.error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return <Content data={result} />;
}
```

**改进点**:

- ✅ 统一的错误处理
- ✅ 更好的错误信息
- ✅ 支持 Response 对象错误

---

## 📋 迁移检查清单

### 代码迁移

- [ ] 导入 `handleApiError` 或 `handleApiErrorWithToast`
- [ ] 替换 `error.message` 为 `handleApiError(error).message`
- [ ] 替换 `error instanceof Error` 检查
- [ ] 移除 `useToast` hook（如果只用于错误处理）
- [ ] 使用 `isAuthError`、`isNetworkError` 等方法判断错误类型

### 测试验证

- [ ] TypeScript 编译通过
- [ ] ESLint 检查通过
- [ ] 错误信息正确显示
- [ ] Toast 正确显示
- [ ] 错误类型判断正确

---

## 🎯 完整文件迁移示例

### 迁移前: `hooks/use-image-upload.ts`

```typescript
'use client';

import { useState } from 'react';

export function useImageUpload() {
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.message || '上传失败');
    }

    const data = await response.json();
    if (!data.success || !data.data?.url) {
      throw new Error(data.error || '上传失败：未返回图片URL');
    }
    return data.data.url;
  };

  const handleFileUpload = async (files: FileList) => {
    setUploadError(null);

    try {
      const urls = await Promise.all(
        Array.from(files).map(file => uploadFile(file))
      );
      return urls;
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : '上传失败，请重试'
      );
      throw error;
    }
  };

  return {
    handleFileUpload,
    uploadError,
  };
}
```

### 迁移后: `hooks/use-image-upload.ts`

```typescript
'use client';

import { useState } from 'react';
import { handleApiError, getErrorMessage } from '@/lib/utils/error-handler';

export function useImageUpload() {
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || errorData.message || '上传失败');
    }

    const data = await response.json();
    if (!data.success || !data.data?.url) {
      throw new Error(data.error || '上传失败：未返回图片URL');
    }
    return data.data.url;
  };

  const handleFileUpload = async (files: FileList) => {
    setUploadError(null);

    try {
      const urls = await Promise.all(
        Array.from(files).map(file => uploadFile(file))
      );
      return urls;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setUploadError(errorMessage);
      throw error;
    }
  };

  return {
    handleFileUpload,
    uploadError,
  };
}
```

**改进点**:

- ✅ 导入 `getErrorMessage`
- ✅ 使用 `getErrorMessage(error)` 替代手动类型检查
- ✅ 更简洁的代码
- ✅ 类型安全

---

## 📚 相关文档

- ✅ 错误处理指南: `docs/ERROR_HANDLING_GUIDE.md`
- ✅ Toast 使用指南: `docs/TOAST_NOTIFICATION_GUIDE.md`
- ✅ 错误处理工具: `lib/utils/error-handler.ts`

---

**维护者**: 开发团队  
**最后更新**: 2025-10-05
