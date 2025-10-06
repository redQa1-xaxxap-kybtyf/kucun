# 表单校验最佳实践指南

> 确保代码质量和团队协作的完整指南

## 🎯 核心原则

### 1. 单一真理源 (Single Source of Truth)

**原则**: 所有验证规则只在 `lib/validations/` 中定义一次

✅ **正确做法**:

```typescript
// lib/validations/product.ts
export const productCreateSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100),
  price: z.number().min(0, '价格不能为负数'),
});

// app/api/products/route.ts
import { productCreateSchema } from '@/lib/validations/product';
export const POST = withBodyValidation(
  productCreateSchema,
  async (req, data) => {
    // 使用 data
  }
);

// components/product-form.tsx
import { productCreateSchema } from '@/lib/validations/product';
const form = useForm({ resolver: zodResolver(productCreateSchema) });
```

❌ **错误做法**:

```typescript
// ❌ 在 API 文件中定义内联 Schema
const schema = z.object({ name: z.string() });

// ❌ 在组件中重复定义验证规则
const form = useForm({
  validate: { name: value => value.length > 0 },
});
```

---

## 📝 如何创建新的 Zod Schema

### 步骤 1: 确定 Schema 位置

根据业务模块选择合适的验证文件:

| 模块     | 文件路径                           |
| -------- | ---------------------------------- |
| 用户认证 | `lib/validations/user.ts`          |
| 产品管理 | `lib/validations/product.ts`       |
| 库存管理 | `lib/validations/inventory.ts`     |
| 分类管理 | `lib/validations/category.ts`      |
| 仪表盘   | `lib/validations/dashboard.ts`     |
| 新模块   | `lib/validations/[module-name].ts` |

### 步骤 2: 定义 Schema

```typescript
// lib/validations/product.ts
import { z } from 'zod';

/**
 * 产品创建验证
 */
export const productCreateSchema = z.object({
  // 必填字段
  name: z.string().min(1, '名称不能为空').max(100, '名称不能超过100个字符'),

  // 数字字段
  price: z.number().min(0, '价格不能为负数').max(999999, '价格超出范围'),

  // 可选字段
  description: z.string().max(500, '描述不能超过500个字符').optional(),

  // 枚举字段
  status: z.enum(['active', 'inactive'], {
    message: '状态值无效',
  }),

  // 数组字段
  tags: z.array(z.string()).min(1, '至少需要一个标签').max(10, '最多10个标签'),
});

// 导出类型
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
```

### 步骤 3: 添加文档注释

````typescript
/**
 * 产品创建验证
 *
 * @description 用于创建新产品的验证规则
 * @example
 * ```typescript
 * const data = productCreateSchema.parse({
 *   name: '产品名称',
 *   price: 99.99,
 *   status: 'active',
 * });
 * ```
 */
export const productCreateSchema = z.object({
  // ...
});
````

---

## 🔧 如何在 API Route Handler 中使用

### 方法 1: 使用验证中间件 (推荐)

```typescript
// app/api/products/route.ts
import { NextRequest } from 'next/server';
import { withBodyValidation } from '@/lib/api/validation-middleware';
import {
  productCreateSchema,
  type ProductCreateInput,
} from '@/lib/validations/product';

export const POST = withBodyValidation(
  productCreateSchema,
  async (request: NextRequest, validatedData: ProductCreateInput) => {
    // validatedData 已经过验证,类型安全
    const product = await prisma.product.create({
      data: validatedData,
    });

    return NextResponse.json({ success: true, data: product });
  }
);
```

### 方法 2: 手动验证

```typescript
// app/api/products/route.ts
import { productCreateSchema } from '@/lib/validations/product';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证数据
    const validatedData = productCreateSchema.parse(body);

    // 使用验证后的数据
    const product = await prisma.product.create({
      data: validatedData,
    });

    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
```

### 查询参数验证

```typescript
import { withQueryValidation } from '@/lib/api/validation-middleware';
import { productQuerySchema } from '@/lib/validations/product';

export const GET = withQueryValidation(
  productQuerySchema,
  async (request, validatedQuery) => {
    const products = await prisma.product.findMany({
      where: {
        status: validatedQuery.status,
        category: validatedQuery.category,
      },
      skip: (validatedQuery.page - 1) * validatedQuery.limit,
      take: validatedQuery.limit,
    });

    return NextResponse.json({ success: true, data: products });
  }
);
```

---

## 🎨 如何在客户端表单中使用

### 基础表单集成

```typescript
// components/product-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productCreateSchema, type ProductCreateInput } from '@/lib/validations/product';

export function ProductForm() {
  const form = useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: {
      name: '',
      price: 0,
      status: 'active',
    },
  });

  const onSubmit = async (data: ProductCreateInput) => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        // 处理服务端验证错误
        if (result.details) {
          result.details.forEach((error: any) => {
            form.setError(error.path[0], {
              message: error.message,
            });
          });
        }
        return;
      }

      // 成功处理
      toast.success('创建成功');
    } catch (error) {
      toast.error('创建失败');
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* 表单字段 */}
    </form>
  );
}
```

### 使用 shadcn/ui 表单组件

```typescript
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <FormLabel>产品名称</FormLabel>
          <FormControl>
            <Input {...field} placeholder="请输入产品名称" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <Button type="submit">提交</Button>
  </form>
</Form>
```

---

## ⚠️ 常见错误和解决方案

### 错误 1: 在 API 中定义内联 Schema

❌ **错误**:

```typescript
// app/api/products/route.ts
const schema = z.object({ name: z.string() });
```

✅ **正确**:

```typescript
// lib/validations/product.ts
export const productCreateSchema = z.object({ name: z.string() });

// app/api/products/route.ts
import { productCreateSchema } from '@/lib/validations/product';
```

### 错误 2: 忘记导出类型

❌ **错误**:

```typescript
export const productCreateSchema = z.object({
  /* ... */
});
// 没有导出类型
```

✅ **正确**:

```typescript
export const productCreateSchema = z.object({
  /* ... */
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
```

### 错误 3: 客户端和服务端使用不同的验证规则

❌ **错误**:

```typescript
// 客户端
const clientSchema = z.object({ name: z.string().min(1) });

// 服务端
const serverSchema = z.object({ name: z.string().min(1).max(100) });
```

✅ **正确**:

```typescript
// 两端使用同一个 Schema
import { productCreateSchema } from '@/lib/validations/product';
```

### 错误 4: 在 Prisma Schema 中重复业务规则

❌ **错误**:

```prisma
model Product {
  name String @db.VarChar(100) // 长度限制
  price Decimal @db.Decimal(10, 2) // 精度限制

  @@check([price >= 0]) // 业务规则
}
```

✅ **正确**:

```prisma
model Product {
  name String @db.VarChar(100) // 仅数据库约束
  price Decimal @db.Decimal(10, 2)
  // 业务规则在 Zod Schema 中定义
}
```

---

## ✅ Code Review 检查清单

### 提交代码前检查

- [ ] 所有验证规则都在 `lib/validations/` 中定义
- [ ] 没有内联 Schema 定义
- [ ] 所有 Schema 都有对应的类型导出
- [ ] API Route Handler 使用验证中间件或手动验证
- [ ] 客户端表单使用 `zodResolver`
- [ ] 运行 `node scripts/audit-inline-schemas.js` 无问题
- [ ] 运行 `npm run type-check` 通过
- [ ] 运行 `npm run lint` 通过

### Code Review 时检查

- [ ] 新增的 Schema 是否有文档注释
- [ ] Schema 命名是否符合规范 (`[entity][Action]Schema`)
- [ ] 类型导出命名是否符合规范 (`[Entity][Action]Input`)
- [ ] 验证错误消息是否清晰易懂
- [ ] 是否复用了现有的 Schema
- [ ] 是否需要拆分过于复杂的 Schema

---

## 📚 相关资源

- [Zod 官方文档](https://zod.dev/)
- [React Hook Form 官方文档](https://react-hook-form.com/)
- [项目验证架构优化方案](./VALIDATION_ARCHITECTURE_OPTIMIZATION.md)
- [快速参考手册](./VALIDATION_QUICK_REFERENCE.md)

---

**最后更新**: 2025-10-06  
**维护者**: 开发团队  
**状态**: ✅ 生效中
