# 表单校验架构 - 快速参考

> 日常开发中的快速查阅手册

## 🚀 快速开始

### 1. 定义 Schema (lib/validations/)

```typescript
// lib/validations/product.ts
import { z } from 'zod';

export const productCreateSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100, '名称不能超过100字符'),
  price: z.number().min(0, '价格不能为负数'),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
```

### 2. 服务端使用 (app/api/)

```typescript
// app/api/products/route.ts
import { withBodyValidation } from '@/lib/api/validation-middleware';
import { productCreateSchema } from '@/lib/validations/product';

export const POST = withBodyValidation(
  productCreateSchema,
  async (request, validatedData) => {
    // validatedData 已验证,类型安全
    const product = await prisma.product.create({ data: validatedData });
    return NextResponse.json({ success: true, data: product });
  }
);
```

### 3. 客户端使用 (components/)

```typescript
// hooks/use-product-form.ts
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  productCreateSchema,
  type ProductCreateInput,
} from '@/lib/validations/product';

export function useProductForm() {
  return useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateSchema),
  });
}
```

---

## 📖 常用 Zod 验证规则

### 字符串验证

```typescript
z.string() // 字符串
  .min(1, '不能为空') // 最小长度
  .max(100, '不能超过100字符') // 最大长度
  .email('邮箱格式不正确') // 邮箱
  .url('URL格式不正确') // URL
  .regex(/^[A-Z0-9]+$/, '只能包含大写字母和数字') // 正则
  .trim() // 去除首尾空格
  .toLowerCase() // 转小写
  .toUpperCase() // 转大写
  .optional() // 可选
  .default('默认值'); // 默认值
```

### 数字验证

```typescript
z.number() // 数字
  .int('必须是整数') // 整数
  .min(0, '不能为负数') // 最小值
  .max(100, '不能超过100') // 最大值
  .positive('必须是正数') // 正数
  .negative('必须是负数') // 负数
  .multipleOf(0.01, '最多保留2位小数') // 倍数
  .optional() // 可选
  .default(0); // 默认值
```

### 枚举验证

```typescript
z.enum(['active', 'inactive'], {
  error: '状态必须是 active 或 inactive',
});

// 或使用 Prisma 枚举
z.nativeEnum(UserRole);
```

### 日期验证

```typescript
z.date(); // Date 对象
z.string().datetime(); // ISO 8601 字符串
z.string().regex(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD
z.coerce.date(); // 强制转换为 Date
```

### 数组验证

```typescript
z.array(z.string()) // 字符串数组
  .min(1, '至少需要一项') // 最小长度
  .max(10, '最多10项') // 最大长度
  .nonempty('不能为空数组'); // 非空
```

### 对象验证

```typescript
z.object({
  name: z.string(),
  age: z.number(),
})
  .partial() // 所有字段可选
  .required() // 所有字段必填
  .pick({ name: true }) // 只保留 name
  .omit({ age: true }) // 排除 age
  .extend({ email: z.string() }); // 扩展字段
```

### 条件验证

```typescript
z.object({
  type: z.enum(['A', 'B']),
  value: z.string(),
}).refine(data => (data.type === 'A' ? data.value.length > 0 : true), {
  message: '类型A时value不能为空',
  path: ['value'],
});
```

### 自定义验证

```typescript
z.string().refine(val => val.length > 0, { message: '自定义错误消息' });

// 异步验证
z.string().refine(
  async val => {
    const exists = await checkExists(val);
    return !exists;
  },
  { message: '已存在' }
);
```

---

## 🛠️ 验证中间件

### withBodyValidation

```typescript
import { withBodyValidation } from '@/lib/api/validation-middleware';

export const POST = withBodyValidation(
  schema,
  async (request, validatedData) => {
    // 处理逻辑
  }
);
```

### withQueryValidation

```typescript
import { withQueryValidation } from '@/lib/api/validation-middleware';

export const GET = withQueryValidation(
  schema,
  async (request, validatedQuery) => {
    // 处理逻辑
  }
);
```

### withCombinedValidation

```typescript
import { withCombinedValidation } from '@/lib/api/validation-middleware';

export const POST = withCombinedValidation(
  bodySchema,
  querySchema,
  async (request, validatedBody, validatedQuery) => {
    // 处理逻辑
  }
);
```

### 手动验证

```typescript
import {
  safeParse,
  handleValidationError,
} from '@/lib/api/validation-middleware';

const result = safeParse(schema, data);
if (!result.success) {
  return handleValidationError(result.error);
}
// 使用 result.data
```

---

## 🎨 表单集成

### 基础表单

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

const form = useForm({
  resolver: zodResolver(schema),
  defaultValues: {
    /* ... */
  },
});
```

### 表单提交

```typescript
const onSubmit = async (data: FormData) => {
  try {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!result.success) {
      // 处理错误
      if (result.details) {
        result.details.forEach(({ field, message }) => {
          form.setError(field, { message });
        });
      }
      return;
    }

    // 成功处理
  } catch (error) {
    // 错误处理
  }
};
```

### 表单字段

```typescript
import { FormInput } from '@/components/ui/form-input';

<FormInput
  control={form.control}
  name="fieldName"
  label="字段标签"
  placeholder="请输入..."
  required
/>
```

---

## 📁 文件组织

```
lib/validations/
├── base.ts              # 基础验证规则
├── product.ts           # 产品相关
├── customer.ts          # 客户相关
├── inventory.ts         # 库存相关(统一导出)
│   ├── inventory-base.ts
│   ├── inventory-operations.ts
│   └── inventory-queries.ts
└── ...

app/api/
└── products/
    └── route.ts         # 使用 lib/validations/product.ts

hooks/
└── use-product-form.ts  # 使用 lib/validations/product.ts

components/
└── products/
    └── product-form.tsx # 使用 hooks/use-product-form.ts
```

---

## ✅ 检查清单

### 新增功能时

- [ ] Schema 定义在 `lib/validations/` 中
- [ ] 导出了 Schema 和类型
- [ ] API 使用了验证中间件
- [ ] 表单使用了 `zodResolver`
- [ ] 没有内联定义 Schema
- [ ] 没有手动编写重复类型

### 代码审查时

- [ ] 验证规则是否在 `lib/validations/` 中?
- [ ] 是否使用了验证中间件?
- [ ] 是否从 Zod Schema 推导类型?
- [ ] 是否有重复的验证逻辑?

---

## 🚫 常见错误

### ❌ 错误: 内联定义 Schema

```typescript
// ❌ 错误
const schema = z.object({
  name: z.string(),
});
```

### ✅ 正确: 从 lib/validations 导入

```typescript
// ✅ 正确
import { productCreateSchema } from '@/lib/validations/product';
```

---

### ❌ 错误: 手动定义类型

```typescript
// ❌ 错误
interface ProductInput {
  name: string;
  price: number;
}
```

### ✅ 正确: 从 Schema 推导

```typescript
// ✅ 正确
export type ProductInput = z.infer<typeof productCreateSchema>;
```

---

### ❌ 错误: 不使用验证中间件

```typescript
// ❌ 错误
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = schema.safeParse(body);
  // ...
}
```

### ✅ 正确: 使用验证中间件

```typescript
// ✅ 正确
export const POST = withBodyValidation(
  schema,
  async (request, validatedData) => {
    // ...
  }
);
```

---

---

## 🆕 新增 Schema 使用示例 (2025-10-06)

### 分类状态更新

```typescript
import {
  categoryStatusUpdateSchema,
  type CategoryStatusUpdateInput,
} from '@/lib/validations/category';

// API Route Handler
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const validatedData = categoryStatusUpdateSchema.parse(body);
  // validatedData.status: 'active' | 'inactive'
}
```

### 产品变体批量操作

```typescript
import {
  productVariantBatchCreateSchema,
  productVariantBatchOperationSchema,
  productVariantCheckSkuSchema,
  productVariantGenerateSkuSchema,
} from '@/lib/validations/product';

// 批量创建
const createData = productVariantBatchCreateSchema.parse({
  productId: 'uuid',
  variants: [{ colorCode: 'RED', colorName: '红色', sku: 'PROD-RED' }],
});

// 批量操作
const operationData = productVariantBatchOperationSchema.parse({
  operation: 'delete', // 'delete' | 'activate' | 'deactivate'
  variantIds: ['uuid1', 'uuid2'],
});

// SKU 检查
const skuCheck = productVariantCheckSkuSchema.parse({
  sku: 'PROD-001',
  excludeId: 'uuid', // 可选
});
```

### 仪表盘查询

```typescript
import {
  dashboardOverviewQuerySchema,
  dashboardQuerySchema,
  type TimeRange,
} from '@/lib/validations/dashboard';

// 概览查询
const overviewParams = dashboardOverviewQuerySchema.parse({
  timeRange: '30d', // '1d' | '7d' | '30d' | '90d' | '1y'
});

// 主数据查询
const dashboardParams = dashboardQuerySchema.parse({
  timeRange: '30d',
  productCategory: 'electronics', // 可选
});
```

---

## 🔗 相关文档

- [优化方案详解](./VALIDATION_ARCHITECTURE_OPTIMIZATION.md)
- [实施任务清单](./VALIDATION_MIGRATION_TASKS.md)
- [使用示例](./VALIDATION_EXAMPLES.md)
- [执行总结](./VALIDATION_OPTIMIZATION_SUMMARY.md)
- [迁移完成报告](./VALIDATION_OPTIMIZATION_COMPLETE.md)

---

**最后更新**: 2025-10-06
**状态**: ✅ 迁移已完成
**提示**: 将此文档加入书签,开发时随时查阅!
