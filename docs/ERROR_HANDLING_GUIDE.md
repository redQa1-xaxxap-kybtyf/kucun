# 错误处理统一指南

> 项目中所有错误处理的统一规范和最佳实践

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

### 1. 统一的错误类型

所有错误都应该转换为 `AppError` 类型，确保错误信息的一致性。

### 2. 明确的错误分类

错误分为以下几类：

- **网络错误**: 网络连接失败、请求超时
- **认证错误**: 未登录、登录过期
- **权限错误**: 无权限执行操作
- **验证错误**: 输入数据验证失败
- **业务错误**: 资源不存在、操作失败
- **服务器错误**: 内部错误、服务不可用

### 3. 用户友好的错误信息

错误信息应该：

- ✅ 清晰易懂
- ✅ 提供解决方案
- ✅ 避免技术术语
- ❌ 不暴露敏感信息

### 4. 自动化错误处理

使用统一的错误处理函数，自动：

- 转换错误类型
- 显示错误提示
- 记录错误日志

---

## 🚀 快速开始

### 安装

错误处理工具已内置，无需安装。

### 基本使用

```typescript
import {
  handleApiError,
  handleApiErrorWithToast,
} from '@/lib/utils/error-handler';

// 方式 1: 手动处理错误
try {
  await apiCall();
} catch (error) {
  const appError = handleApiError(error);
  console.error(appError.message);
}

// 方式 2: 自动显示 Toast
try {
  await apiCall();
} catch (error) {
  handleApiErrorWithToast(error, '操作失败');
}
```

---

## 📚 API 参考

### `AppError` 类

统一的错误类型

```typescript
class AppError extends Error {
  constructor(
    message: string,
    code?: string,
    statusCode?: number,
    details?: unknown
  );

  // 判断方法
  isClientError(): boolean;
  isServerError(): boolean;
  isNetworkError(): boolean;
  isAuthError(): boolean;
  isForbiddenError(): boolean;
  isValidationError(): boolean;
}
```

**示例**:

```typescript
const error = new AppError('操作失败', 'OPERATION_FAILED', 500);

if (error.isServerError()) {
  console.error('服务器错误');
}
```

---

### `handleApiError(error)`

将任意错误转换为 `AppError`

**参数**:

- `error: unknown` - 任意类型的错误

**返回**:

- `AppError` - 统一的错误对象

**示例**:

```typescript
try {
  await fetch('/api/products');
} catch (error) {
  const appError = handleApiError(error);
  console.error(appError.message);
}
```

---

### `handleApiErrorWithToast(error, customMessage?)`

处理错误并自动显示 Toast

**参数**:

- `error: unknown` - 任意类型的错误
- `customMessage?: string` - 自定义错误标题（可选）

**返回**:

- `AppError` - 统一的错误对象

**示例**:

```typescript
try {
  await deleteProduct(id);
} catch (error) {
  handleApiErrorWithToast(error, '删除失败');
}
```

---

### `handleValidationError(error)`

处理表单验证错误

**参数**:

- `error: unknown` - 任意类型的错误

**返回**:

- `AppError` - 验证错误对象

**示例**:

```typescript
try {
  await submitForm(data);
} catch (error) {
  const validationError = handleValidationError(error);
  form.setError('field', { message: validationError.message });
}
```

---

### `getErrorMessage(error)`

安全地获取错误信息

**参数**:

- `error: unknown` - 任意类型的错误

**返回**:

- `string` - 错误信息

**示例**:

```typescript
const message = getErrorMessage(error);
console.error(message);
```

---

### `isNetworkError(error)`

判断是否为网络错误

**参数**:

- `error: unknown` - 任意类型的错误

**返回**:

- `boolean` - 是否为网络错误

**示例**:

```typescript
if (isNetworkError(error)) {
  showError('网络连接失败');
}
```

---

### `isAuthError(error)`

判断是否为认证错误

**参数**:

- `error: unknown` - 任意类型的错误

**返回**:

- `boolean` - 是否为认证错误

**示例**:

```typescript
if (isAuthError(error)) {
  router.push('/login');
}
```

---

### `ErrorCode` 常量

预定义的错误码

```typescript
const ErrorCode = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  FETCH_ERROR: 'FETCH_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  OPERATION_FAILED: 'OPERATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  UNKNOWN: 'UNKNOWN',
} as const;
```

---

## 💡 使用场景

### 场景 1: API 调用错误处理

```typescript
import { useMutation } from '@tanstack/react-query';
import { handleApiErrorWithToast } from '@/lib/utils/error-handler';

const mutation = useMutation({
  mutationFn: createProduct,
  onSuccess: () => {
    showSuccess('创建成功');
  },
  onError: error => {
    handleApiErrorWithToast(error, '创建失败');
  },
});
```

---

### 场景 2: 表单提交错误处理

```typescript
import { handleValidationError } from '@/lib/utils/error-handler';

const onSubmit = async (data: FormData) => {
  try {
    await submitForm(data);
    showSuccess('提交成功');
  } catch (error) {
    const validationError = handleValidationError(error);
    form.setError('root', { message: validationError.message });
  }
};
```

---

### 场景 3: 网络错误特殊处理

```typescript
import { handleApiError, isNetworkError } from '@/lib/utils/error-handler';

try {
  await fetchData();
} catch (error) {
  const appError = handleApiError(error);

  if (isNetworkError(appError)) {
    showError('网络连接失败', {
      description: '请检查网络设置后重试',
    });
  } else {
    showError('操作失败', {
      description: appError.message,
    });
  }
}
```

---

### 场景 4: 认证错误自动跳转

```typescript
import { handleApiError, isAuthError } from '@/lib/utils/error-handler';
import { useRouter } from 'next/navigation';

const router = useRouter();

try {
  await apiCall();
} catch (error) {
  const appError = handleApiError(error);

  if (isAuthError(appError)) {
    showError('登录已过期', {
      description: '请重新登录',
    });
    router.push('/login');
  } else {
    handleApiErrorWithToast(error);
  }
}
```

---

### 场景 5: 服务器组件错误处理

```typescript
import { handleApiError } from '@/lib/utils/error-handler';
import { ErrorMessage } from '@/components/common/error-message';

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

---

## ✅ 最佳实践

### 1. 始终使用统一的错误处理

❌ **错误**:

```typescript
try {
  await apiCall();
} catch (error) {
  showError(error.message); // 可能导致类型错误
}
```

✅ **正确**:

```typescript
try {
  await apiCall();
} catch (error) {
  handleApiErrorWithToast(error);
}
```

---

### 2. 提供有意义的错误标题

❌ **错误**:

```typescript
handleApiErrorWithToast(error); // 标题为"操作失败"
```

✅ **正确**:

```typescript
handleApiErrorWithToast(error, '删除产品失败');
```

---

### 3. 根据错误类型采取不同行动

✅ **正确**:

```typescript
try {
  await apiCall();
} catch (error) {
  const appError = handleApiError(error);

  if (appError.isAuthError()) {
    router.push('/login');
  } else if (appError.isNetworkError()) {
    showError('网络错误', { description: '请检查网络连接' });
  } else {
    handleApiErrorWithToast(error);
  }
}
```

---

### 4. 在 Mutation 中统一错误处理

✅ **正确**:

```typescript
const mutation = useMutation({
  mutationFn: apiCall,
  onError: error => {
    handleApiErrorWithToast(error, '操作失败');
  },
});
```

---

### 5. 记录错误日志（生产环境）

```typescript
try {
  await apiCall();
} catch (error) {
  const appError = handleApiError(error);

  // 记录错误日志
  if (process.env.NODE_ENV === 'production') {
    console.error('[API Error]', {
      message: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
      details: appError.details,
    });
  }

  handleApiErrorWithToast(error);
}
```

---

## ❓ 常见问题

### Q1: 什么时候使用 `handleApiError` vs `handleApiErrorWithToast`?

**A**:

- 使用 `handleApiError`: 需要自定义错误处理逻辑
- 使用 `handleApiErrorWithToast`: 只需要显示错误提示

---

### Q2: 如何自定义错误信息?

**A**: 使用 `customMessage` 参数

```typescript
handleApiErrorWithToast(error, '自定义错误标题');
```

---

### Q3: 如何处理多语言错误信息?

**A**: 在 `ERROR_MESSAGES` 中添加多语言支持

```typescript
const ERROR_MESSAGES = {
  [ErrorCode.NOT_FOUND]: i18n.t('errors.notFound'),
};
```

---

### Q4: 如何处理表单字段级别的错误?

**A**: 使用 `handleValidationError` 并设置表单错误

```typescript
try {
  await submitForm(data);
} catch (error) {
  const validationError = handleValidationError(error);
  form.setError('field', { message: validationError.message });
}
```

---

## 📊 错误处理流程图

```
用户操作
  ↓
API 调用
  ↓
发生错误? ──否──→ 成功处理
  ↓ 是
handleApiError
  ↓
转换为 AppError
  ↓
判断错误类型
  ├─ 认证错误 → 跳转登录
  ├─ 网络错误 → 显示网络提示
  ├─ 验证错误 → 显示表单错误
  └─ 其他错误 → 显示通用错误
  ↓
记录错误日志
  ↓
显示用户提示
```

---

## 🔗 相关文档

- ✅ Toast 使用指南: `docs/TOAST_NOTIFICATION_GUIDE.md`
- ✅ 表单处理指南: `docs/FORM_HANDLING_GUIDE.md` (待创建)
- ✅ API 调用规范: `docs/API_CALLING_GUIDE.md` (待创建)

---

**维护者**: 开发团队  
**最后更新**: 2025-10-05
