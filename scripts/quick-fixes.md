# 快速修复指南

## 1. 修复 TypeScript 类型错误

### 1.1 修复日期类型问题

**文件**: `app/(dashboard)/factory-shipments/page.tsx`

```typescript
// ❌ 当前代码 (第63行)
const { data, isLoading, error } = useQuery({
  queryKey: ['factory-shipments', queryParams],
  queryFn: () => getFactoryShipmentOrders({
    ...queryParams,
    startDate: queryParams.startDate, // string | undefined
    endDate: queryParams.endDate,     // string | undefined
  }),
});

// ✅ 修复后
const { data, isLoading, error } = useQuery({
  queryKey: ['factory-shipments', queryParams],
  queryFn: () => getFactoryShipmentOrders({
    ...queryParams,
    startDate: queryParams.startDate ? new Date(queryParams.startDate) : undefined,
    endDate: queryParams.endDate ? new Date(queryParams.endDate) : undefined,
  }),
});
```

### 1.2 修复 pagination 属性问题

**文件**: `app/(dashboard)/factory-shipments/page.tsx` (第68行)

```typescript
// ❌ 当前代码
const pagination = data?.pagination;

// ✅ 修复后 - 方案1: 直接使用返回的字段
const pagination = data ? {
  page: data.page,
  limit: data.limit,
  total: data.total,
} : undefined;

// ✅ 修复后 - 方案2: 更新 API 返回类型
// 在 lib/api/factory-shipments.ts 中
export interface FactoryShipmentListResponse {
  data: FactoryShipmentOrder[];
  total: number;
  page: number;
  limit: number;
  pagination: {  // 添加这个字段
    page: number;
    limit: number;
    total: number;
  };
}
```

**文件**: `app/(dashboard)/return-orders/page.tsx` (第83行)

```typescript
// ❌ 当前代码
const pagination = data?.pagination;

// ✅ 修复后
const pagination = data ? {
  page: data.page,
  limit: data.limit,
  total: data.total,
} : undefined;
```

### 1.3 修复客户表单类型问题

**文件**: `components/customers/customer-form.tsx`

#### 步骤1: 更新 Zod Schema

```typescript
// 在 lib/validations/customer.ts 中

// ❌ 当前 schema
export const customerCreateSchema = z.object({
  name: z.string().min(1, '客户名称不能为空'),
  phone: z.string().optional(),
  address: z.string().optional(),
  extendedInfo: z.object({
    contactPerson: z.string().optional(),
    email: z.string().optional(),
    notes: z.string().optional(),
  }).optional(),
});

// ✅ 修复后 - 添加缺失字段
export const customerCreateSchema = z.object({
  name: z.string().min(1, '客户名称不能为空'),
  phone: z.string().optional(),
  address: z.string().optional(),
  parentCustomerId: z.string().optional(), // 添加
  extendedInfo: z.object({
    contactPerson: z.string().optional(),
    email: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(), // 添加
  }).optional(),
});

export const customerUpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, '客户名称不能为空').optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  parentCustomerId: z.string().optional(), // 添加
  extendedInfo: z.object({
    contactPerson: z.string().optional(),
    email: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(), // 添加
  }).optional(),
});
```

#### 步骤2: 更新表单组件

```typescript
// 在 components/customers/customer-form.tsx 中

// ❌ 当前代码 (第169-182行)
const currentTags = form.getValues('extendedInfo.tags');
if (currentTags?.includes(tag)) {
  return;
}

form.setValue(
  'extendedInfo.tags',
  [...(currentTags || []), tag]
);

// ✅ 修复后
const extendedInfo = form.getValues('extendedInfo');
const currentTags = extendedInfo?.tags || [];

if (currentTags.includes(tag)) {
  return;
}

form.setValue('extendedInfo', {
  ...extendedInfo,
  tags: [...currentTags, tag],
});
```

#### 步骤3: 修复表单提交类型

```typescript
// ❌ 当前代码 (第215行)
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>

// ✅ 修复后 - 明确指定表单类型
const form = useForm<CustomerCreateFormData | CustomerUpdateFormData>({
  resolver: zodResolver(mode === 'create' ? customerCreateSchema : customerUpdateSchema),
  defaultValues: initialData || {
    name: '',
    phone: '',
    address: '',
    extendedInfo: {
      contactPerson: '',
      email: '',
      notes: '',
      tags: [],
    },
  },
});
```

## 2. 移除 Console 语句

### 方案1: 手动移除

```bash
# 搜索所有 console 语句
grep -rn "console\." app/ components/ --include="*.tsx" --include="*.ts"

# 逐个文件移除或替换
```

### 方案2: 使用日志库

```typescript
// 创建 lib/logger.ts
export const logger = {
  info: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  error: (message: string, error?: unknown) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ERROR] ${message}`, error);
    }
    // 生产环境可以发送到日志服务
  },
  warn: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
};

// 替换 console.log
// ❌ console.log('错误:', error);
// ✅ logger.error('错误:', error);
```

### 方案3: ESLint 自动修复

```javascript
// 在 eslint.config.mjs 中
export default [
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
];

// 然后运行
// npm run lint:fix
```

## 3. 修复 React Hooks 依赖

**文件**: `app/(dashboard)/customers/page-client.tsx` (第67行)

```typescript
// ❌ 当前代码
React.useEffect(() => {
  if (isSortField(sortBy)) {
    // ...
  }
}, [sortBy, sortOrder]); // 缺少 isSortField

// ✅ 修复后 - 方案1: 添加依赖
React.useEffect(() => {
  if (isSortField(sortBy)) {
    // ...
  }
}, [sortBy, sortOrder, isSortField]);

// ✅ 修复后 - 方案2: 将函数移到 useEffect 外部
const isSortFieldMemo = React.useCallback((field: string) => {
  return ['name', 'phone', 'createdAt'].includes(field);
}, []);

React.useEffect(() => {
  if (isSortFieldMemo(sortBy)) {
    // ...
  }
}, [sortBy, sortOrder, isSortFieldMemo]);
```

## 4. 批量修复命令

```bash
# 1. 运行类型检查
npm run type-check

# 2. 运行 ESLint 检查
npm run lint

# 3. 自动修复 ESLint 问题
npm run lint:fix

# 4. 格式化代码
npm run format

# 5. 再次检查
npm run type-check && npm run lint
```

## 5. Git 提交建议

```bash
# 分别提交不同类型的修复

# 1. 修复类型错误
git add .
git commit -m "fix(types): 修复 TypeScript 类型错误

- 修复日期类型转换问题
- 修复 pagination 属性访问
- 更新客户表单 schema 和类型定义"

# 2. 移除 console 语句
git add .
git commit -m "refactor: 移除 console 语句,使用日志库"

# 3. 修复 React Hooks
git add .
git commit -m "fix(hooks): 修复 useEffect 依赖警告"
```

## 6. 验证修复

```bash
# 1. 确保没有类型错误
npm run type-check
# 应该输出: Found 0 errors

# 2. 确保没有 ESLint 错误
npm run lint
# 应该只有警告,没有错误

# 3. 运行开发服务器测试
npm run dev
# 访问相关页面确保功能正常

# 4. 运行数据库健康检查
npx tsx scripts/database-health-check.ts
# 应该输出: 未发现任何问题
```

## 7. 预计修复时间

| 任务 | 预计时间 | 优先级 |
|------|---------|--------|
| 修复日期类型问题 | 15分钟 | 高 |
| 修复 pagination 问题 | 15分钟 | 高 |
| 修复客户表单类型 | 45分钟 | 高 |
| 移除 console 语句 | 30分钟 | 中 |
| 修复 Hooks 依赖 | 15分钟 | 中 |
| **总计** | **2小时** | - |

---

**建议**: 按照优先级顺序修复,每修复一项就提交一次,便于回滚和追溯。

