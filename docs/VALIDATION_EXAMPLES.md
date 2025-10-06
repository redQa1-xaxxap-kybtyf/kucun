# 表单校验架构 - 使用示例

> 展示如何在项目中正确使用单一真理源的验证架构

## 📚 目录

1. [定义 Zod Schema](#定义-zod-schema)
2. [服务端 API 使用](#服务端-api-使用)
3. [客户端表单使用](#客户端表单使用)
4. [复杂验证场景](#复杂验证场景)
5. [错误处理](#错误处理)

---

## 1. 定义 Zod Schema

### 基础 Schema 定义

**文件**: `lib/validations/product.ts`

```typescript
import { z } from 'zod';
import { baseValidations } from './base';

/**
 * 产品创建验证规则
 *
 * 这是唯一的真理源,所有验证规则都在这里定义
 */
export const productCreateSchema = z.object({
  // 使用基础验证规则
  code: z
    .string()
    .min(1, '产品编码不能为空')
    .max(50, '产品编码不能超过50个字符')
    .regex(/^[A-Z0-9\-]+$/, '产品编码只能包含大写字母、数字和连字符'),

  name: z
    .string()
    .min(1, '产品名称不能为空')
    .max(100, '产品名称不能超过100个字符'),

  categoryId: z.string().uuid('分类ID格式不正确').optional(),

  specification: z.string().max(200, '规格说明不能超过200个字符').optional(),

  unit: z
    .enum(['piece', 'sheet', 'strip'], {
      error: '单位必须是 piece、sheet 或 strip',
    })
    .default('piece'),

  piecesPerUnit: z
    .number()
    .int('每单位片数必须是整数')
    .min(1, '每单位片数至少为1')
    .max(10000, '每单位片数不能超过10000')
    .default(1),

  weight: z
    .number()
    .min(0.001, '重量必须大于0')
    .max(10000, '重量不能超过10000kg')
    .optional(),

  thickness: z
    .number()
    .min(0.1, '厚度必须大于0.1mm')
    .max(1000, '厚度不能超过1000mm')
    .optional(),

  status: z.enum(['active', 'inactive']).default('active'),
});

/**
 * 产品更新验证规则
 *
 * 继承创建规则,但所有字段都是可选的
 */
export const productUpdateSchema = productCreateSchema.partial();

/**
 * 产品查询验证规则
 */
export const productQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  sortBy: z
    .enum(['name', 'code', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * 类型推导 - 自动从 Schema 生成 TypeScript 类型
 */
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductQueryParams = z.infer<typeof productQuerySchema>;
```

### 复用基础验证规则

**文件**: `lib/validations/base.ts`

```typescript
import { z } from 'zod';

/**
 * 基础验证规则
 * 可在多个 Schema 中复用
 */
export const baseValidations = {
  // ID 验证
  id: z.string().min(1, 'ID不能为空').uuid('ID格式不正确'),

  // 用户名验证
  username: z
    .string()
    .min(3, '用户名至少3个字符')
    .max(20, '用户名不能超过20个字符')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),

  // 邮箱验证
  email: z.string().email('邮箱格式不正确'),

  // 手机号验证
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
    .optional(),

  // 金额验证
  amount: z
    .number()
    .min(0, '金额不能为负数')
    .max(999999.99, '金额不能超过999,999.99')
    .multipleOf(0.01, '金额最多保留2位小数'),

  // 日期验证
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式不正确(YYYY-MM-DD)'),
};
```

---

## 2. 服务端 API 使用

### 使用验证中间件(推荐)

**文件**: `app/api/products/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import {
  withBodyValidation,
  withQueryValidation,
} from '@/lib/api/validation-middleware';
import {
  productCreateSchema,
  productQuerySchema,
} from '@/lib/validations/product';
import { prisma } from '@/lib/db';

/**
 * GET /api/products - 获取产品列表
 *
 * 使用 withQueryValidation 验证查询参数
 */
export const GET = withAuth(
  withQueryValidation(productQuerySchema, async (request, validatedQuery) => {
    // validatedQuery 已验证,类型安全
    const { page, limit, search, categoryId, status, sortBy, sortOrder } =
      validatedQuery;

    // 构建查询条件
    const where = {
      ...(search && {
        OR: [{ name: { contains: search } }, { code: { contains: search } }],
      }),
      ...(categoryId && { categoryId }),
      ...(status !== 'all' && { status }),
    };

    // 查询数据
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { category: true },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
  { permissions: ['products:view'] }
);

/**
 * POST /api/products - 创建产品
 *
 * 使用 withBodyValidation 验证请求体
 */
export const POST = withAuth(
  withBodyValidation(productCreateSchema, async (request, validatedData) => {
    // validatedData 已验证,类型安全

    // 检查产品编码是否已存在
    const existing = await prisma.product.findUnique({
      where: { code: validatedData.code },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: '产品编码已存在',
        },
        { status: 400 }
      );
    }

    // 创建产品
    const product = await prisma.product.create({
      data: validatedData,
      include: { category: true },
    });

    return NextResponse.json({
      success: true,
      data: product,
    });
  }),
  { permissions: ['products:create'] }
);
```

### 手动验证(不推荐,但有时需要)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { productCreateSchema } from '@/lib/validations/product';
import { handleValidationError } from '@/lib/api/validation-middleware';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 手动验证
    const result = productCreateSchema.safeParse(body);

    if (!result.success) {
      return handleValidationError(result.error);
    }

    // 使用验证后的数据
    const validatedData = result.data;

    // ... 业务逻辑
  } catch (error) {
    // 错误处理
  }
}
```

---

## 3. 客户端表单使用

### React Hook Form 集成

**文件**: `hooks/use-product-form.ts`

```typescript
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  productCreateSchema,
  type ProductCreateInput,
} from '@/lib/validations/product';

/**
 * 产品表单 Hook
 *
 * 复用服务端的 Zod Schema,确保客户端和服务端验证规则一致
 */
export function useProductForm(initialData?: Partial<ProductCreateInput>) {
  const form = useForm<ProductCreateInput>({
    // 使用 zodResolver 复用服务端 Schema
    resolver: zodResolver(productCreateSchema),

    // 默认值
    defaultValues: {
      code: '',
      name: '',
      unit: 'piece',
      piecesPerUnit: 1,
      status: 'active',
      ...initialData,
    },
  });

  return form;
}
```

### 表单组件

**文件**: `components/products/product-form.tsx`

```typescript
'use client';

import { useProductForm } from '@/hooks/use-product-form';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { Form } from '@/components/ui/form';

interface ProductFormProps {
  onSubmit: (data: ProductCreateInput) => Promise<void>;
  initialData?: Partial<ProductCreateInput>;
}

export function ProductForm({ onSubmit, initialData }: ProductFormProps) {
  const form = useProductForm(initialData);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* 产品编码 */}
        <FormInput
          control={form.control}
          name="code"
          label="产品编码"
          placeholder="请输入产品编码"
          required
        />

        {/* 产品名称 */}
        <FormInput
          control={form.control}
          name="name"
          label="产品名称"
          placeholder="请输入产品名称"
          required
        />

        {/* 规格说明 */}
        <FormInput
          control={form.control}
          name="specification"
          label="规格说明"
          placeholder="请输入规格说明"
        />

        {/* 提交按钮 */}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? '提交中...' : '提交'}
        </Button>
      </form>
    </Form>
  );
}
```

---

## 4. 复杂验证场景

### 条件验证

```typescript
import { z } from 'zod';

/**
 * 销售订单验证
 *
 * 根据订单类型(NORMAL/TRANSFER)应用不同的验证规则
 */
export const salesOrderCreateSchema = z
  .object({
    orderType: z.enum(['NORMAL', 'TRANSFER']),
    customerId: z.string().uuid(),
    supplierId: z.string().uuid().optional(),
    costAmount: z.number().min(0).optional(),
    items: z.array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
      })
    ),
  })
  .refine(
    data => {
      // 调货订单必须提供供应商ID和成本金额
      if (data.orderType === 'TRANSFER') {
        return !!data.supplierId && data.costAmount !== undefined;
      }
      return true;
    },
    {
      message: '调货订单必须提供供应商和成本金额',
      path: ['supplierId'],
    }
  );
```

### 异步验证

```typescript
import { z } from 'zod';
import { prisma } from '@/lib/db';

/**
 * 产品编码唯一性验证
 */
export const productCodeSchema = z.string().refine(
  async code => {
    const existing = await prisma.product.findUnique({
      where: { code },
    });
    return !existing;
  },
  {
    message: '产品编码已存在',
  }
);
```

### 数组验证

```typescript
import { z } from 'zod';

/**
 * 批量操作验证
 */
export const batchDeleteSchema = z.object({
  productIds: z
    .array(z.string().uuid('产品ID格式不正确'))
    .min(1, '至少需要选择一个产品')
    .max(100, '一次最多只能删除100个产品'),
});
```

---

## 5. 错误处理

### 统一错误响应格式

```typescript
// 验证错误响应
{
  "success": false,
  "error": "数据验证失败",
  "details": [
    {
      "field": "code",
      "message": "产品编码不能为空"
    },
    {
      "field": "name",
      "message": "产品名称不能为空"
    }
  ]
}
```

### 客户端错误处理

```typescript
'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useProductCreate() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const createProduct = async (data: ProductCreateInput) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        // 处理验证错误
        if (result.details) {
          const errorMessages = result.details
            .map((d: { field: string; message: string }) => d.message)
            .join(', ');

          toast({
            title: '验证失败',
            description: errorMessages,
            variant: 'destructive',
          });
        } else {
          toast({
            title: '错误',
            description: result.error,
            variant: 'destructive',
          });
        }
        return;
      }

      // 成功
      toast({
        title: '成功',
        description: '产品创建成功',
      });

      return result.data;
    } catch (error) {
      toast({
        title: '错误',
        description: '网络错误,请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { createProduct, isLoading };
}
```

---

## 📚 总结

### 核心原则

1. **单一真理源**: 所有验证规则只在 `lib/validations/` 中定义一次
2. **服务端优先**: 服务端必须验证,客户端复用提升体验
3. **类型安全**: TypeScript 类型自动从 Zod 推导
4. **统一错误处理**: 使用验证中间件统一处理错误

### 最佳实践

- ✅ 使用 `withBodyValidation` 和 `withQueryValidation` 中间件
- ✅ 使用 `zodResolver` 在表单中复用 Schema
- ✅ 使用 `z.infer` 自动推导 TypeScript 类型
- ✅ 复用 `baseValidations` 中的基础验证规则
- ❌ 不要在 API 文件中内联定义 Schema
- ❌ 不要手动编写与 Zod Schema 重复的类型定义
- ❌ 不要在 Prisma Schema 中定义业务规则

---

**参考文档**:

- [优化方案](./VALIDATION_ARCHITECTURE_OPTIMIZATION.md)
- [实施任务](./VALIDATION_MIGRATION_TASKS.md)
