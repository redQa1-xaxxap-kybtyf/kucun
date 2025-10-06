# 表单校验架构优化 - 实施任务清单

> 分阶段执行,确保每个步骤可验证、可回滚

## 📋 任务总览

- **总任务数**: 15 个
- **预计工时**: 8-12 小时
- **风险等级**: 低(有自动化测试和类型检查保护)
- **可回滚**: 是(通过 Git)

---

## 🎯 第一阶段: 消除内联 Schema 定义 (4小时)

### 任务 1.1: 审计内联 Schema

**目标**: 找出所有在 API 文件中内联定义的 Zod Schema

**执行命令**:

```bash
# 查找所有内联定义的 Schema
grep -rn "const.*Schema.*=.*z\.object" app/api --include="*.ts" > inline-schemas-audit.txt

# 查看结果
cat inline-schemas-audit.txt
```

**预期结果**: 生成包含所有内联 Schema 位置的清单

**验证标准**:

- [ ] 清单文件已生成
- [ ] 已识别所有内联 Schema

---

### 任务 1.2: 迁移库存可用性检查 Schema

**文件**: `app/api/inventory/check-availability/route.ts`

**步骤**:

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

2. 更新 `lib/validations/inventory.ts`:

```typescript
export { inventoryAvailabilityCheckSchema } from './inventory-queries';
export type { InventoryAvailabilityCheckInput } from './inventory-queries';
```

3. 更新 `app/api/inventory/check-availability/route.ts`:

```typescript
// 删除内联定义
// const checkAvailabilitySchema = z.object({...});

// 添加导入
import { inventoryAvailabilityCheckSchema } from '@/lib/validations/inventory';

// 使用导入的 Schema
const validationResult = inventoryAvailabilityCheckSchema.safeParse(body);
```

**验证**:

```bash
npm run type-check
npm run lint
```

**验证标准**:

- [ ] 类型检查通过
- [ ] ESLint 检查通过
- [ ] API 功能正常

---

### 任务 1.3: 迁移产品变体更新 Schema

**文件**: `app/api/product-variants/[id]/route.ts`

**步骤**:

1. 在 `lib/validations/product.ts` 中添加:

```typescript
// 产品变体更新验证规则
export const productVariantUpdateSchema = z.object({
  colorCode: z
    .string()
    .min(1, '色号不能为空')
    .max(20, '色号不能超过20个字符')
    .optional(),
  colorName: z.string().max(50, '色号名称不能超过50个字符').optional(),
  colorValue: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, '颜色值格式不正确')
    .optional(),
  sku: z.string().max(50, 'SKU不能超过50个字符').optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export type ProductVariantUpdateInput = z.infer<
  typeof productVariantUpdateSchema
>;
```

2. 更新 `app/api/product-variants/[id]/route.ts`:

```typescript
import { productVariantUpdateSchema } from '@/lib/validations/product';

// 删除内联定义
// const ProductVariantUpdateSchema = z.object({...});

// 使用导入的 Schema
const validationResult = productVariantUpdateSchema.safeParse(body);
```

**验证标准**:

- [ ] 类型检查通过
- [ ] ESLint 检查通过
- [ ] API 功能正常

---

### 任务 1.4: 迁移批量 SKU 检查 Schema

**文件**: `app/api/product-variants/check-sku/route.ts`

**步骤**:

1. 在 `lib/validations/product.ts` 中添加:

```typescript
// 批量 SKU 检查验证规则
export const batchCheckSkuSchema = z.object({
  skus: z
    .array(
      z.object({
        sku: z.string().min(1, 'SKU不能为空').max(50, 'SKU不能超过50个字符'),
        excludeId: z.string().uuid('排除的变体ID格式不正确').optional(),
      })
    )
    .min(1, '至少需要一个SKU')
    .max(100, '批量检查最多支持100个SKU'),
});

export type BatchCheckSkuInput = z.infer<typeof batchCheckSkuSchema>;
```

2. 更新 `app/api/product-variants/check-sku/route.ts`:

```typescript
import { batchCheckSkuSchema } from '@/lib/validations/product';

// 删除内联定义
// const BatchCheckSkuSchema = z.object({...});

// 使用导入的 Schema
const validationResult = batchCheckSkuSchema.safeParse(body);
```

**验证标准**:

- [ ] 类型检查通过
- [ ] ESLint 检查通过
- [ ] API 功能正常

---

### 任务 1.5: 优化注册 Schema

**文件**: `app/api/auth/register/route.ts`

**当前状态**: 已使用 `baseValidations`,但可以进一步优化

**步骤**:

1. 在 `lib/validations/user.ts` 中确认已有:

```typescript
export const userRegisterSchema = z.object({
  username: baseValidations.username,
  email: baseValidations.email,
  password: baseValidations.password,
  name: baseValidations.name,
});

export type UserRegisterInput = z.infer<typeof userRegisterSchema>;
```

2. 更新 `app/api/auth/register/route.ts`:

```typescript
import { userRegisterSchema } from '@/lib/validations/user';

// 删除内联定义
// const registerSchema = z.object({...});

// 使用导入的 Schema
const validatedData = userRegisterSchema.parse(body);
```

**验证标准**:

- [ ] 类型检查通过
- [ ] ESLint 检查通过
- [ ] 注册功能正常

---

## 🎯 第二阶段: 创建统一验证中间件 (2小时)

### 任务 2.1: 创建验证中间件

**文件**: `lib/api/validation-middleware.ts`

**步骤**:

1. 创建文件并添加内容(见优化方案文档)

2. 导出验证中间件:
   - `handleValidationError`
   - `withBodyValidation`
   - `withQueryValidation`

**验证**:

```bash
npm run type-check
```

**验证标准**:

- [ ] 文件创建成功
- [ ] 类型检查通过
- [ ] 导出函数可用

---

### 任务 2.2: 更新现有 API 使用验证中间件

**目标**: 选择 3-5 个 API 作为试点,使用新的验证中间件

**试点 API**:

1. `app/api/products/route.ts` - POST
2. `app/api/customers/route.ts` - POST
3. `app/api/inventory/check-availability/route.ts` - POST

**步骤**(以 products 为例):

```typescript
// 之前
export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json();
  const validatedData = productCreateSchema.parse(body);
  // ...
});

// 之后
import { withBodyValidation } from '@/lib/api/validation-middleware';

export const POST = withAuth(
  withBodyValidation(productCreateSchema, async (request, validatedData) => {
    // validatedData 已验证,类型安全
    // ...
  })
);
```

**验证标准**:

- [ ] 试点 API 功能正常
- [ ] 验证错误格式统一
- [ ] 类型推导正确

---

## 🎯 第三阶段: 优化 Prisma Schema (2小时)

### 任务 3.1: 审计 Prisma Schema 约束

**目标**: 识别可以移除的业务规则约束

**执行**:

```bash
# 查看 Prisma Schema
cat prisma/schema.prisma | grep -E "@db\.|@unique|@@unique" > prisma-constraints.txt
```

**分析**:

- 哪些约束是数据库层面必需的?
- 哪些约束应该在 Zod Schema 中定义?

**验证标准**:

- [ ] 已识别所有约束
- [ ] 已分类约束类型

---

### 任务 3.2: 简化 Prisma Schema

**原则**:

- ✅ 保留: 主键、外键、唯一性约束、索引
- ❌ 移除: 业务规则、字段长度的业务含义

**示例**:

```prisma
// 之前
model Product {
  code String @unique @db.VarChar(50)
  name String @db.VarChar(100)
  // ...
}

// 之后(如果数据库支持更大的字段)
model Product {
  code String @unique @db.VarChar(255)  // 数据库层面的最大长度
  name String @db.VarChar(255)
  // 业务规则在 Zod Schema 中定义
}
```

**注意**: 这一步需要谨慎,确保不影响现有数据

**验证**:

```bash
# 生成迁移(不执行)
npx prisma migrate dev --create-only --name simplify_constraints

# 检查迁移 SQL
cat prisma/migrations/*/migration.sql
```

**验证标准**:

- [ ] 迁移 SQL 正确
- [ ] 不会丢失数据
- [ ] 不会破坏现有功能

---

## 🎯 第四阶段: 文档和测试 (2小时)

### 任务 4.1: 更新开发文档

**文件**:

- `docs/VALIDATION_ARCHITECTURE_OPTIMIZATION.md` (已创建)
- `README.md` (添加验证架构说明)
- `.augment/rules/项目硬规则.md` (更新验证规范)

**验证标准**:

- [ ] 文档完整
- [ ] 示例代码正确
- [ ] 易于理解

---

### 任务 4.2: 编写验证测试

**文件**: `__tests__/validations/` (新建)

**测试内容**:

1. Zod Schema 验证规则测试
2. 验证中间件功能测试
3. 边界条件测试

**示例**:

```typescript
// __tests__/validations/product.test.ts
import { describe, it, expect } from 'vitest';
import { productCreateSchema } from '@/lib/validations/product';

describe('Product Validation', () => {
  it('should validate correct product data', () => {
    const validData = {
      code: 'PROD-001',
      name: '测试产品',
      // ...
    };

    const result = productCreateSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid product code', () => {
    const invalidData = {
      code: '', // 空字符串
      name: '测试产品',
    };

    const result = productCreateSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
```

**验证**:

```bash
npm run test
```

**验证标准**:

- [ ] 所有测试通过
- [ ] 覆盖率 > 80%

---

## ✅ 最终验证清单

### 代码质量

- [ ] `npm run type-check` 通过
- [ ] `npm run lint` 通过
- [ ] `npm run test` 通过
- [ ] `npm run build` 成功

### 功能验证

- [ ] 所有 API 功能正常
- [ ] 所有表单验证正常
- [ ] 验证错误信息友好
- [ ] 无重复的验证规则

### 文档完整性

- [ ] 优化方案文档完整
- [ ] 实施任务清单完整
- [ ] 代码注释清晰
- [ ] README 更新

---

## 🔄 回滚计划

如果出现问题,可以通过 Git 回滚:

```bash
# 查看修改
git status
git diff

# 回滚所有修改
git checkout .

# 或回滚特定文件
git checkout lib/validations/
git checkout app/api/
```

---

## 📊 进度跟踪

| 阶段     | 任务数 | 完成  | 进度   |
| -------- | ------ | ----- | ------ |
| 第一阶段 | 5      | 0     | 0%     |
| 第二阶段 | 2      | 0     | 0%     |
| 第三阶段 | 2      | 0     | 0%     |
| 第四阶段 | 2      | 0     | 0%     |
| **总计** | **11** | **0** | **0%** |

---

**开始日期**: 待定
**预计完成**: 待定
**负责人**: 待定
