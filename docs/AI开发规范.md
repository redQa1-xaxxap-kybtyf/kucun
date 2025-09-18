# AI开发规范

## 概述

本规范为AI开发制定严格的全栈开发标准，涵盖代码风格、TypeScript类型安全、React/Next.js最佳实践、数据同步和性能优化，确保代码质量和系统稳定性。

**核心目标**：避免数据不一致、性能问题和安全漏洞，确保AI生成的代码符合企业级标准。

## 第一部分：代码风格与命名规范

### 文件命名规范

- **文件名**：使用小写字母和连字符分隔（kebab-case）
- **组件文件**：使用PascalCase（UserProfile.tsx）
- **工具函数文件**：使用camelCase（dataValidation.ts）
- **页面文件**：遵循Next.js约定（page.tsx, layout.tsx）

### 导入顺序规范（强制执行）

```typescript
// ✅ 正确的导入顺序
// 1. 第三方库
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. 绝对路径导入
import { Button } from '@/components/ui/button';
import { getProducts } from '@/lib/api/products';

// 3. 相对路径导入
import './component.css';
```

### 组件定义规范

```typescript
// ✅ 使用命名函数组件（强制）
export default function ProductEditPage({ params }: ProductEditPageProps) {
  // 组件逻辑
}

// ❌ 禁止使用箭头函数组件
const ProductEditPage = ({ params }: ProductEditPageProps) => {
  // 组件逻辑
};
```

## 第二部分：TypeScript类型安全规范

### 强制性类型规则

1. **禁止any类型**：必须明确类型定义，使用unknown替代any
2. **接口命名**：使用PascalCase，不带I前缀（UserProfile而非IUserProfile）
3. **可选链使用**：处理可能为空的值（data?.category?.name）
4. **严格相等**：使用===和!==而非==和!=
5. **禁用非空断言**：避免使用!运算符，除非绝对必要

### 接口定义模板

```typescript
// ✅ 正确的接口定义
interface ProductEditPageProps {
  params: Promise<{ id: string }>;
}

interface ProductFormData {
  id: string;
  name: string;
  categoryId?: string;
  status: 'active' | 'inactive';
}

// ✅ 使用const枚举
const enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
```

## 第三部分：React/Next.js开发规范

### 组件Props规范

```typescript
// ✅ Props接口命名约定
interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
  className?: string;
}

export default function UserCard({ user, onEdit, className }: UserCardProps) {
  // 组件实现
}
```

### 事件处理规范

```typescript
// ✅ 事件处理函数命名
const handleSubmit = async (data: FormData) => {
  // 处理逻辑
};

const handleCategoryChange = (categoryId: string) => {
  // 处理逻辑
};
```

### useEffect清理规范

```typescript
// ✅ 包含清理函数
useEffect(() => {
  const subscription = api.subscribe(callback);

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

## 第四部分：前端缓存与数据同步核心规范

### 1. 缓存失效优先原则

**规则**：任何数据变更操作（CREATE、UPDATE、DELETE）必须立即失效所有相关缓存
**实施**：使用`Promise.all`确保所有缓存失效操作完成后再执行后续逻辑

### 2. 强制刷新保障原则

**规则**：关键数据更新后必须强制重新获取最新数据
**实施**：使用`refetchQueries`强制刷新当前页面需要的数据

### 3. 异步处理完整性原则

**规则**：所有缓存操作必须使用async/await确保执行顺序
**实施**：mutation的onSuccess回调必须是async函数

## 强制性代码模板

### 1. 数据更新Mutation标准模板

```typescript
// ✅ 正确的更新Mutation模板
const updateMutation = useMutation({
  mutationFn: (data: UpdateInput) => updateAPI(id, data),
  onSuccess: async response => {
    // 第一步：彻底失效所有相关缓存
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: entityQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: entityQueryKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: entityQueryKeys.detail(id) }),
      queryClient.invalidateQueries({ queryKey: entityQueryKeys.details() }),
      // 失效关联实体缓存（如分类、用户等）
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
      queryClient.invalidateQueries({ queryKey: ['users'] }),
    ]);

    // 第二步：强制重新获取关键数据
    await queryClient.refetchQueries({
      queryKey: entityQueryKeys.detail(id),
    });

    // 第三步：执行后续逻辑
    if (onSuccess) {
      onSuccess(response);
    } else {
      router.push('/entity-list');
    }
  },
  onError: error => {
    // 错误处理逻辑
  },
});
```

### 2. 数据创建Mutation标准模板

```typescript
// ✅ 正确的创建Mutation模板
const createMutation = useMutation({
  mutationFn: (data: CreateInput) => createAPI(data),
  onSuccess: async response => {
    // 失效列表和汇总缓存
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: entityQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: entityQueryKeys.lists() }),
      // 失效关联实体缓存
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
    ]);

    // 预填充新创建的实体缓存
    queryClient.setQueryData(entityQueryKeys.detail(response.id), response);

    if (onSuccess) {
      onSuccess(response);
    }
  },
});
```

### 3. 数据删除Mutation标准模板

```typescript
// ✅ 正确的删除Mutation模板
const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteAPI(id),
  onSuccess: async () => {
    // 彻底清理所有相关缓存
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: entityQueryKeys.all }),
      queryClient.removeQueries({ queryKey: entityQueryKeys.detail(id) }),
      // 失效关联实体缓存
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
    ]);

    if (onSuccess) {
      onSuccess();
    }
  },
});
```

### 4. 编辑页面数据获取标准模板

```typescript
// ✅ 编辑页面必须使用的查询配置
const { data, isLoading, error } = useQuery({
  queryKey: entityQueryKeys.detail(id),
  queryFn: () => getEntity(id),
  // 强制获取最新数据，避免缓存问题
  staleTime: 0,
  gcTime: 0,
  // 确保数据存在时才启用查询
  enabled: !!id,
});
```

## 禁止性规则

### ❌ 绝对禁止的做法

1. **同步缓存操作**

```typescript
// ❌ 错误：同步执行缓存操作
onSuccess: response => {
  queryClient.invalidateQueries({ queryKey: ['entity'] });
  router.push('/list'); // 可能在缓存失效前执行
};
```

2. **部分缓存失效**

```typescript
// ❌ 错误：只失效部分缓存
onSuccess: response => {
  queryClient.invalidateQueries({ queryKey: ['entity', 'list'] });
  // 遗漏了detail缓存和关联缓存
};
```

3. **缺少强制刷新**

```typescript
// ❌ 错误：更新后不强制刷新当前数据
onSuccess: response => {
  queryClient.invalidateQueries({ queryKey: ['entity'] });
  // 没有refetchQueries确保当前页面数据更新
};
```

4. **编辑页面使用默认缓存策略**

```typescript
// ❌ 错误：编辑页面使用默认缓存
useQuery({
  queryKey: ['entity', id],
  queryFn: () => getEntity(id),
  // 没有设置staleTime: 0，可能使用过期缓存
});
```

## 查询键命名规范

### 标准查询键结构

```typescript
export const entityQueryKeys = {
  all: ['entities'] as const,
  lists: () => [...entityQueryKeys.all, 'list'] as const,
  list: (params: QueryParams) => [...entityQueryKeys.lists(), params] as const,
  details: () => [...entityQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...entityQueryKeys.details(), id] as const,
  // 关联查询
  relations: (id: string) =>
    [...entityQueryKeys.detail(id), 'relations'] as const,
};
```

### 缓存失效优先级

1. **最高优先级**：`entityQueryKeys.all` - 失效所有相关查询
2. **列表优先级**：`entityQueryKeys.lists()` - 失效所有列表查询
3. **详情优先级**：`entityQueryKeys.details()` - 失效所有详情查询
4. **特定优先级**：`entityQueryKeys.detail(id)` - 失效特定实体

## 表单数据同步规范

### 表单重置标准模板

```typescript
// ✅ 正确的表单数据同步
React.useEffect(() => {
  if (data && !isLoading) {
    form.reset({
      id: data.id,
      name: data.name,
      categoryId: data.categoryId || 'uncategorized',
      // 确保所有字段都有默认值
      status: data.status || 'active',
    });
  }
}, [data, isLoading, form]);
```

## API客户端配置规范

### 统一认证配置

```typescript
// ✅ 所有API请求必须包含认证信息
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // 必须包含
  body: JSON.stringify(data),
});
```

## 错误处理与调试规范

### 缓存调试工具

```typescript
// 开发环境缓存状态检查
if (process.env.NODE_ENV === 'development') {
  console.log('Cache state:', queryClient.getQueryCache().getAll());
}
```

### 错误边界处理

```typescript
onError: (error) => {
  console.error('Mutation failed:', error);
  // 失败时也要清理可能的脏缓存
  queryClient.invalidateQueries({ queryKey: entityQueryKeys.all });

  toast({
    title: '操作失败',
    description: error?.message || '请重试',
    variant: 'destructive',
  });
},
```

## 性能优化规范

### 批量操作优化

```typescript
// ✅ 批量操作的缓存管理
const batchUpdateMutation = useMutation({
  mutationFn: (items: BatchUpdateInput[]) => batchUpdateAPI(items),
  onSuccess: async responses => {
    // 批量失效，避免多次重复失效
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: entityQueryKeys.all }),
      // 批量设置更新后的数据
      ...responses.map(item =>
        queryClient.setQueryData(entityQueryKeys.detail(item.id), item)
      ),
    ]);
  },
});
```

## 测试验证规范

### 缓存同步测试检查清单

- [ ] 数据更新后，列表页面显示最新数据
- [ ] 数据更新后，详情页面显示最新数据
- [ ] 数据更新后，编辑页面显示最新数据
- [ ] 关联数据更新后，相关页面同步更新
- [ ] 浏览器刷新后数据一致性
- [ ] 多标签页数据同步（如需要）

## 第五部分：错误处理与安全规范

### 错误处理强制要求

```typescript
// ✅ 完整的错误处理模板
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.error('Operation failed:', error);

  // 使用zod进行运行时验证
  if (error instanceof z.ZodError) {
    throw new Error(`数据验证失败: ${error.message}`);
  }

  // 清晰且可操作的错误消息
  throw new Error(error instanceof Error ? error.message : '操作失败，请重试');
}
```

### 安全规范（强制执行）

1. **禁止用户输入直接插入HTML**：使用React的JSX自动转义
2. **API路由身份验证**：每个API必须验证用户会话
3. **环境变量验证**：使用TypeScript和zod验证所有环境变量
4. **文件上传安全**：验证文件类型、大小和内容

```typescript
// ✅ 安全的API路由模板
export async function PUT(request: NextRequest) {
  try {
    // 1. 身份验证（开发环境可绕过）
    if (process.env.NODE_ENV !== 'development') {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: '未授权访问' }, { status: 401 });
      }
    }

    // 2. 输入验证
    const body = await request.json();
    const validationResult = updateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: '输入数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    // 3. 业务逻辑
    const result = await updateEntity(validationResult.data);

    return NextResponse.json({
      success: true,
      data: result,
      message: '更新成功',
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '服务器内部错误',
      },
      { status: 500 }
    );
  }
}
```

## 第六部分：性能优化强制要求

### React性能优化

```typescript
// ✅ 组件性能优化模板
import React, { memo, useCallback, useMemo } from 'react';

export default memo(function ProductCard({ product, onEdit }: ProductCardProps) {
  // 使用useCallback避免不必要的重渲染
  const handleEdit = useCallback(() => {
    onEdit?.(product);
  }, [product, onEdit]);

  // 使用useMemo避免重复计算
  const formattedPrice = useMemo(() => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(product.price);
  }, [product.price]);

  return (
    <div>
      <h3>{product.name}</h3>
      <p>{formattedPrice}</p>
      <button onClick={handleEdit}>编辑</button>
    </div>
  );
});
```

### 代码质量强制限制

- **函数长度**：不超过50行
- **文件长度**：不超过300行
- **圈复杂度**：不超过10
- **认知复杂度**：不超过15
- **重复代码**：必须提取为共享函数或组件

## 第七部分：AI开发检查清单

### 代码提交前必检项目（200项规则精简版）

#### 基础规范检查

- [ ] 文件命名使用kebab-case
- [ ] 组件使用命名函数而非箭头函数
- [ ] 导入顺序：第三方库 → 绝对路径 → 相对路径
- [ ] 接口使用PascalCase命名，无I前缀
- [ ] 禁止使用any类型
- [ ] 使用严格相等比较（===）

#### React/Next.js检查

- [ ] Props接口使用ComponentNameProps命名
- [ ] 事件处理函数使用handle前缀
- [ ] useEffect包含清理函数（如有副作用）
- [ ] 组件使用React.memo优化
- [ ] API路由使用HTTP方法命名函数

#### 缓存同步检查（核心）

- [ ] Mutation回调是async函数
- [ ] 使用Promise.all处理缓存失效
- [ ] 包含refetchQueries强制刷新
- [ ] 编辑页面设置staleTime: 0
- [ ] API请求包含credentials: 'include'
- [ ] 失效所有相关缓存（all, lists, details, detail）
- [ ] 同时失效关联实体缓存

#### 错误处理检查

- [ ] 异步操作包含try/catch
- [ ] 使用zod进行运行时验证
- [ ] 错误消息清晰且可操作
- [ ] API路由包含身份验证
- [ ] 环境变量通过TypeScript验证

#### 性能优化检查

- [ ] 使用React.memo优化组件
- [ ] 使用useCallback避免不必要重渲染
- [ ] 使用useMemo避免重复计算
- [ ] 函数不超过50行
- [ ] 文件不超过300行

## 总结

本规范涵盖了从代码风格到缓存同步的全栈开发最佳实践。AI开发时必须严格遵循每一项规则，特别是缓存同步的三大核心原则。违反任何一项规则都可能导致数据不一致、性能问题或安全漏洞。

**记住：规范不是建议，而是强制要求。每一行代码都必须符合本规范的标准。**
