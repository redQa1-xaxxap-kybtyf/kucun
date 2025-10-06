# 表单校验架构优化方案

> 消除 RHF + Zod + Prisma 三层重复维护,建立单一真理源

## 📊 当前状态评估

### ✅ 已经做得很好的地方

1. **Zod Schema 集中管理**
   - 所有验证规则都在 `lib/validations/` 目录下
   - 按业务模块组织(product, customer, inventory 等)
   - 统一导出入口,便于维护

2. **客户端复用服务端 Schema**

   ```typescript
   // ✅ 正确示例: hooks/use-product-form.ts
   const form = useForm<ProductCreateFormData>({
     resolver: zodResolver(productCreateSchema), // 复用服务端 Schema
   });
   ```

3. **服务端强制校验**

   ```typescript
   // ✅ 正确示例: app/api/customers/route.ts
   const validatedData = customerCreateSchema.parse(body);
   ```

4. **Prisma Schema 简洁**
   - 主要保留数据库结构定义
   - 索引优化合理
   - 关系定义清晰

### ⚠️ 需要优化的地方

#### 1. 内联 Schema 定义(违反单一真理源)

**问题文件**: `app/api/inventory/check-availability/route.ts`

```typescript
// ❌ 错误: 内联定义 Schema
const checkAvailabilitySchema = z.object({
  productId: z.string().min(1, '产品ID不能为空'),
  quantity: z.number().min(1, '数量必须大于0'),
  // ...
});
```

**应该**: 移动到 `lib/validations/inventory.ts`

#### 2. Prisma Schema 中的业务规则约束

**当前**: Prisma Schema 中包含一些业务规则
**应该**: 仅保留数据库层面的必要约束

#### 3. 缺少统一的验证错误处理

**当前**: 各 API 自行处理 Zod 验证错误
**应该**: 统一的错误处理中间件

---

## 🎯 优化目标

### 核心原则

1. **单一真理源**: 所有验证规则只在 Zod Schema 中定义一次
2. **服务端优先**: 服务端必须校验,客户端复用提升体验
3. **Prisma 最小化**: 仅保留数据库层面无法在应用层实现的约束
4. **类型安全**: TypeScript 类型自动从 Zod 推导

### 预期收益

- ✅ 校验规则维护点从 3 处减少到 1 处
- ✅ 客户端和服务端自动保持一致
- ✅ 减少 50% 的重复代码
- ✅ 降低维护成本和出错概率

---

## 📋 实施步骤

### 第一阶段: 消除内联 Schema 定义

#### 步骤 1: 审计内联 Schema

```bash
# 查找所有内联定义的 Zod Schema
grep -r "z.object({" app/api --include="*.ts" | grep -v "import"
```

**发现的问题文件**:

- `app/api/inventory/check-availability/route.ts` - checkAvailabilitySchema
- `app/api/product-variants/[id]/route.ts` - ProductVariantUpdateSchema
- `app/api/product-variants/check-sku/route.ts` - BatchCheckSkuSchema
- `app/api/auth/register/route.ts` - registerSchema (已使用 baseValidations,可优化)

#### 步骤 2: 迁移到 lib/validations

**示例: 迁移库存可用性检查 Schema**

1. 在 `lib/validations/inventory-queries.ts` 中添加:

```typescript
// 库存可用性检查验证规则
export const inventoryAvailabilityCheckSchema = z.object({
  productId: z.string().min(1, '产品ID不能为空').uuid('产品ID格式不正确'),
  quantity: z
    .number()
    .min(1, '数量必须大于0')
    .max(999999, '数量不能超过999,999'),
  variantId: z.string().uuid('变体ID格式不正确').optional(),
  batchNumber: z.string().max(50, '批次号不能超过50个字符').optional(),
  location: z.string().max(100, '位置不能超过100个字符').optional(),
});

export type InventoryAvailabilityCheckInput = z.infer<
  typeof inventoryAvailabilityCheckSchema
>;
```

2. 更新 `lib/validations/inventory.ts` 导出:

```typescript
export {
  inventoryAvailabilityCheckSchema,
  // ... 其他导出
} from './inventory-queries';

export type {
  InventoryAvailabilityCheckInput,
  // ... 其他类型
} from './inventory-queries';
```

3. 更新 API 文件:

```typescript
// app/api/inventory/check-availability/route.ts
import { inventoryAvailabilityCheckSchema } from '@/lib/validations/inventory';

// 删除内联定义,直接使用导入的 Schema
```

#### 步骤 3: 验证迁移结果

```bash
# 运行类型检查
npm run type-check

# 运行 ESLint
npm run lint

# 运行测试(如果有)
npm run test
```

---

### 第二阶段: 优化 Prisma Schema

#### Prisma 中应保留的约束

1. **主键和外键**

   ```prisma
   id String @id @default(uuid())
   customerId String @map("customer_id")
   customer Customer @relation(fields: [customerId], references: [id])
   ```

2. **数据库级别的唯一性约束**

   ```prisma
   email String @unique
   @@unique([productId, colorCode])
   ```

3. **枚举类型**(如果数据库支持)

   ```prisma
   enum UserRole {
     ADMIN
     SALES
   }
   ```

4. **索引**(性能优化)
   ```prisma
   @@index([customerId])
   @@index([status, createdAt(sort: Desc)])
   ```

#### Prisma 中应移除的约束

1. **业务规则校验**
   - ❌ 不在 Prisma 中定义"价格必须大于0"
   - ✅ 在 Zod Schema 中定义

2. **字段长度的业务含义**
   - ❌ 不在 Prisma 中定义"用户名3-20字符"
   - ✅ 在 Zod Schema 中定义
   - ⚠️ Prisma 中仅定义数据库字段类型: `@db.VarChar(20)`

3. **复杂的条件校验**
   - ❌ 不在 Prisma 中定义"退货数量不能超过原订单数量"
   - ✅ 在 Zod Schema 或业务逻辑中定义

#### 优化示例

**当前 Prisma Schema**:

```prisma
model Product {
  code String @unique
  name String
  // ... 其他字段
}
```

**对应的 Zod Schema** (lib/validations/product.ts):

```typescript
export const productCreateSchema = z.object({
  code: z
    .string()
    .min(1, '产品编码不能为空')
    .max(50, '产品编码不能超过50个字符')
    .regex(/^[A-Z0-9\-]+$/, '产品编码只能包含大写字母、数字和连字符'),

  name: z
    .string()
    .min(1, '产品名称不能为空')
    .max(100, '产品名称不能超过100个字符'),

  // ... 其他字段
});
```

**说明**:

- Prisma: 定义数据库结构和唯一性约束
- Zod: 定义所有业务规则和格式校验

---

### 第三阶段: 统一验证错误处理

#### 创建验证中间件

**文件**: `lib/api/validation-middleware.ts`

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { type ZodSchema, ZodError } from 'zod';

/**
 * 统一的 Zod 验证错误处理
 */
export function handleValidationError(error: ZodError) {
  const errors = error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
  }));

  return NextResponse.json(
    {
      success: false,
      error: '数据验证失败',
      details: errors,
    },
    { status: 400 }
  );
}

/**
 * 验证请求体的中间件工厂函数
 */
export function withBodyValidation<T>(
  schema: ZodSchema<T>,
  handler: (request: NextRequest, validatedData: T) => Promise<Response>
) {
  return async (request: NextRequest) => {
    try {
      const body = await request.json();
      const validatedData = schema.parse(body);
      return await handler(request, validatedData);
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(error);
      }
      throw error;
    }
  };
}

/**
 * 验证查询参数的中间件工厂函数
 */
export function withQueryValidation<T>(
  schema: ZodSchema<T>,
  handler: (request: NextRequest, validatedQuery: T) => Promise<Response>
) {
  return async (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const query = Object.fromEntries(searchParams.entries());
      const validatedQuery = schema.parse(query);
      return await handler(request, validatedQuery);
    } catch (error) {
      if (error instanceof ZodError) {
        return handleValidationError(error);
      }
      throw error;
    }
  };
}
```

#### 使用示例

```typescript
// app/api/products/route.ts
import { withBodyValidation } from '@/lib/api/validation-middleware';
import { productCreateSchema } from '@/lib/validations/product';

export const POST = withBodyValidation(
  productCreateSchema,
  async (request, validatedData) => {
    // validatedData 已经通过验证,类型安全
    const product = await prisma.product.create({
      data: validatedData,
    });

    return NextResponse.json({
      success: true,
      data: product,
    });
  }
);
```

---

## 📚 最佳实践指南

### 1. Zod Schema 组织规范

#### 文件结构

```
lib/validations/
├── base.ts              # 基础验证规则(ID、邮箱、手机号等)
├── product.ts           # 产品相关验证
├── customer.ts          # 客户相关验证
├── inventory.ts         # 库存相关验证(统一导出)
│   ├── inventory-base.ts      # 基础验证
│   ├── inventory-operations.ts # 操作验证
│   └── inventory-queries.ts    # 查询验证
└── ...
```

#### 命名规范

```typescript
// 创建操作
export const productCreateSchema = z.object({...});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

// 更新操作
export const productUpdateSchema = z.object({...});
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

// 查询操作
export const productQuerySchema = z.object({...});
export type ProductQueryParams = z.infer<typeof productQuerySchema>;

// 搜索操作
export const productSearchSchema = z.object({...});
export type ProductSearchParams = z.infer<typeof productSearchSchema>;
```

### 2. 表单集成规范

```typescript
// hooks/use-product-form.ts
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  productCreateSchema,
  type ProductCreateInput,
} from '@/lib/validations/product';

export function useProductForm() {
  const form = useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: {
      // ... 默认值
    },
  });

  return form;
}
```

### 3. API 集成规范

```typescript
// app/api/products/route.ts
import { withAuth } from '@/lib/auth/api-helpers';
import { withBodyValidation } from '@/lib/api/validation-middleware';
import { productCreateSchema } from '@/lib/validations/product';

export const POST = withAuth(
  withBodyValidation(productCreateSchema, async (request, validatedData) => {
    // 业务逻辑
  })
);
```

---

## ✅ 验证清单

### 迁移完成后检查

- [ ] 所有内联 Schema 已迁移到 `lib/validations/`
- [ ] 所有 API 使用统一的验证中间件
- [ ] 所有表单使用 `zodResolver` 复用 Schema
- [ ] Prisma Schema 仅保留数据库层面约束
- [ ] `npm run type-check` 通过
- [ ] `npm run lint` 通过
- [ ] 所有 API 测试通过

### 代码质量检查

- [ ] 无重复的验证规则定义
- [ ] 验证错误信息统一且友好
- [ ] TypeScript 类型全部从 Zod 推导
- [ ] 文档更新完整

---

## 🔄 持续维护

### 新增功能时的规范

1. **先定义 Zod Schema**

   ```typescript
   // lib/validations/new-feature.ts
   export const newFeatureSchema = z.object({...});
   ```

2. **服务端使用**

   ```typescript
   // app/api/new-feature/route.ts
   import { newFeatureSchema } from '@/lib/validations/new-feature';
   ```

3. **客户端复用**
   ```typescript
   // hooks/use-new-feature-form.ts
   const form = useForm({
     resolver: zodResolver(newFeatureSchema),
   });
   ```

### Code Review 检查点

- ❌ 禁止在 API 文件中内联定义 Zod Schema
- ❌ 禁止在 Prisma Schema 中定义业务规则
- ❌ 禁止手动编写与 Zod Schema 重复的 TypeScript 类型
- ✅ 所有验证规则必须在 `lib/validations/` 中定义
- ✅ 所有 API 必须使用验证中间件
- ✅ 所有表单必须使用 `zodResolver`

---

## 📖 参考资源

- [Zod 官方文档](https://zod.dev/)
- [React Hook Form 官方文档](https://react-hook-form.com/)
- [Prisma 最佳实践](https://www.prisma.io/docs/guides/performance-and-optimization)
- [项目硬规则](../.augment/rules/项目硬规则.md)

---

**最后更新**: 2025-10-06
**维护者**: 开发团队
