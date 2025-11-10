# 表单开发最佳实践

## 验证逻辑分层

### 模块化验证结构（推荐）

将验证逻辑拆分为三个独立文件，遵循 SOLID 原则：

```
lib/validations/[module]/
├── schemas.ts      # 基础字段验证（类型、长度、格式）
├── validators.ts   # 业务逻辑验证（状态、所有权、动态规则）
└── index.ts        # 组合导出
```

**参考实现：**

- ✅ `lib/validations/sales-order/` - 销售订单验证（标准模板）
- ✅ `lib/validations/factory-shipment/` - 厂家发货验证（最新实践）

### schemas.ts - 基础字段验证

**职责：** 只负责字段类型、长度、格式等静态验证

**示例：**

```typescript
// ✅ 正确：只定义字段类型和基本约束
export const orderItemSchema = z.object({
  productCode: z.string().min(1).max(50),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
});

// ❌ 错误：不要在 schema 中写业务逻辑
export const orderItemSchema = z
  .object({
    productCode: z.string().min(1).max(50),
    quantity: z.number().positive(),
  })
  .refine(data => {
    // 不要在这里写状态相关的验证！
    if (status === 'confirmed' && !data.productCode) {
      return false;
    }
    return true;
  });
```

### validators.ts - 业务逻辑验证

**职责：** 处理复杂的业务规则、状态依赖、动态验证

**命名规范：**

- `validate[Entity][Aspect]` - 如 `validateManualProductFields`
- `validate[Aspect]By[Condition]` - 如 `validateRequiredFieldsByStatus`

**示例：**

```typescript
// ✅ 正确：独立的验证函数，易于测试和复用
export function validateManualProductFields(
  items: OrderItem[],
  ctx: z.RefinementCtx,
  status: OrderStatus
) {
  items.forEach((item, index) => {
    if (item.isManualProduct && !item.manualProductName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '手工产品必须填写产品名称',
        path: ['items', index, 'manualProductName'],
      });
    }
  });
}

export function validateRequiredFieldsByStatus(
  items: OrderItem[],
  status: OrderStatus,
  ctx: z.RefinementCtx
) {
  if (status === 'draft') return; // 草稿模式放宽验证

  items.forEach((item, index) => {
    if (!item.productCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '确认订单必须填写产品编码',
        path: ['items', index, 'productCode'],
      });
    }
  });
}
```

### index.ts - 组合导出

**职责：** 使用 `superRefine` 组合所有验证规则

**示例：**

```typescript
import { orderItemSchema } from './schemas';
import {
  validateManualProductFields,
  validateRequiredFieldsByStatus,
} from './validators';

export const createOrderSchema = z
  .object({
    status: z.enum(['draft', 'confirmed']),
    items: z.array(orderItemSchema),
  })
  .superRefine((data, ctx) => {
    // 组合所有业务验证
    validateManualProductFields(data.items, ctx, data.status);
    validateRequiredFieldsByStatus(data.items, data.status, ctx);
  });

// 导出所有验证函数供测试使用
export * from './schemas';
export * from './validators';
```

### 验证规则更新流程

任何新增字段需同时更新：

1. **schemas.ts** - 添加字段类型定义
2. **validators.ts** - 添加业务验证逻辑（如果需要）
3. **index.ts** - 在 `superRefine` 中调用新的验证函数
4. **UI 表单** - 添加表单控件和默认值
5. **数据转换层** - 更新 `prepare…ForSubmit` 和 `transform…FromAPI`

## 错误处理与交互

- 所有表单统一使用 `useFormErrorHandling` 提供的 `notifyBlur`、`focusField`、`scrollToError`、`showValidationToast`，禁止直接把 `ZodError` 暴露给用户。
- 自定义选择器组件（客户、供应商、智能搜索等）在 `onBlur` 时必须调用 `notifyBlur`，以便触发 react-hook-form 的触摸态并吞掉潜在的 `ZodError`。
- 表单提交必须提供友好的 toast，并自动聚焦第一个错误字段，避免“提交后无响应”的体验。

## 数据转换层

- UI 默认值与 API 期望值之间通过 `lib/utils/*-transforms.ts` 解耦。提交前使用 `prepare…ForSubmit` 做字段清洗、默认值补齐、空字符串 → `undefined`、数值归一化等操作。
- API → UI 的详情加载必须经过 `transform…FromAPI`，确保空字段有合理的初始值，草稿模式下也能继续编辑。
- 任何新字段在提交前后都要在转换层补齐映射，避免 UI/接口结构漂移。

## 提交流程

- 先走转换层 → 验证 helper → API 调用；禁止跳过任一步骤。
- Mutation/Action 失败时优先解析服务端的 `validationErrors`，并调用 `applyServerValidationErrors` 设置精确的字段错误。
- 成功后根据业务场景自动刷新 Query/重置表单，保持 UI 与数据源一致。

## Checklist（新增）

- ✅ 表单使用 `useFormErrorHandling` 统一错误处理（无裸露 ZodError）。
- ✅ Factory/Purchase 等表单提交前调用 `prepare…ForSubmit`，详情加载使用 `transform…FromAPI`。
- ✅ helper 函数覆盖了新增字段、状态和 item 级业务规则。
- ✅ 自定义选择器在 `onBlur` 时调用 `notifyBlur`。
- ✅ 失败提示需要 `toast + scroll + focus`，并定位到首个错误字段。
