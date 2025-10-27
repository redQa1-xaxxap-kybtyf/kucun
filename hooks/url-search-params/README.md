# useUrlSearchParams Hook

类型安全的URL参数管理Hook,用于Next.js 14 App Router。

## 功能特性

- ✅ **类型安全**: TypeScript泛型支持,编译时类型检查
- ✅ **Zod集成**: 支持Zod schema和简化配置对象
- ✅ **防抖支持**: 配置搜索框防抖延迟
- ✅ **默认值处理**: 智能跳过默认值,保持URL简洁
- ✅ **验证**: 参数类型、范围、枚举值验证
- ✅ **React优化**: useTransition、useCallback、useRef优化性能
- ✅ **服务端渲染**: 支持initialParams从服务端传入

## 安装

Hook已内置于项目中,无需额外安装。

```typescript
import { useUrlSearchParams } from '@/hooks/url-search-params';
```

## 基础用法

### 1. 使用Zod Schema (推荐)

```typescript
'use client';

import { z } from 'zod';
import { useUrlSearchParams } from '@/hooks/url-search-params';

// 定义schema
const salesOrderSchema = z.object({
  search: z.string().default(''),
  status: z.enum(['pending', 'confirmed', 'shipped']).optional(),
  page: z.number().int().positive().default(1),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export function SalesOrdersPageClient() {
  const { params, setParam, updateParams } = useUrlSearchParams(
    salesOrderSchema,
    {
      basePath: '/sales-orders',
      debounceMs: 300, // 搜索框防抖300ms
    }
  );

  return (
    <div>
      <input
        value={params.search}
        onChange={(e) => updateParams({ search: e.target.value, page: 1 })}
      />

      <select
        value={params.status || ''}
        onChange={(e) =>
          setParam('status', e.target.value as 'pending' | 'confirmed')
        }
      >
        <option value="">All</option>
        <option value="pending">Pending</option>
        <option value="confirmed">Confirmed</option>
      </select>

      <button onClick={() => setParam('page', params.page + 1)}>
        Next Page
      </button>
    </div>
  );
}
```

### 2. 使用配置对象

```typescript
import { useUrlSearchParams } from '@/hooks/url-search-params';
import type { ParamConfig } from '@/hooks/url-search-params/types';

const inventoryConfig: Record<string, ParamConfig> = {
  search: { type: 'string', default: '' },
  lowStock: { type: 'boolean', default: false },
  page: { type: 'number', default: 1, min: 1 },
  categoryIds: { type: 'array', default: [], separator: ',' },
};

export function InventoryPageClient() {
  const { params, updateParams, resetParams } = useUrlSearchParams(
    inventoryConfig,
    { basePath: '/inventory' }
  );

  return (
    <div>
      <input
        type="checkbox"
        checked={params.lowStock}
        onChange={(e) => updateParams({ lowStock: e.target.checked, page: 1 })}
      />
      <span>Only Low Stock</span>

      <button onClick={resetParams}>Reset Filters</button>
    </div>
  );
}
```

## API参考

### `useUrlSearchParams<T>(schema, options?)`

**参数**:

- `schema`: Zod Schema 或 配置对象
- `options` (可选):
  - `basePath?: string` - 基础路径,默认使用当前pathname
  - `debounceMs?: number` - 防抖延迟(毫秒),默认0
  - `shallow?: boolean` - 是否使用浅路由(不重新加载数据),默认false
  - `initialParams?: Record<string, any>` - 服务端传入的初始参数

**返回值**:

```typescript
{
  // 当前参数值 (类型安全)
  params: T;

  // 更新单个参数
  setParam: <K extends keyof T>(key: K, value: T[K] | undefined) => void;

  // 批量更新参数
  updateParams: (updates: Partial<T>) => void;

  // 重置所有参数到默认值
  resetParams: () => void;

  // 构建查询字符串 (不包含"?")
  buildQueryString: (overrides?: Partial<T>) => string;

  // 是否正在更新URL
  isPending: boolean;
}
```

## 高级用法

### 服务端渲染 (SSR)

```typescript
// app/(dashboard)/sales-orders/page.tsx (Server Component)
import { z } from 'zod';
import SalesOrdersPageClient from './page-client';

const salesOrderSchema = z.object({
  search: z.string().default(''),
  page: z.number().default(1),
});

export default function Page({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // 验证和解析服务端参数
  const validatedParams = salesOrderSchema.parse({
    search: searchParams.search || '',
    page: searchParams.page ? parseInt(searchParams.page as string, 10) : 1,
  });

  return <SalesOrdersPageClient initialParams={validatedParams} />;
}
```

```typescript
// app/(dashboard)/sales-orders/page-client.tsx (Client Component)
'use client';

import { useUrlSearchParams } from '@/hooks/url-search-params';
import { salesOrderSchema } from './schema';

export default function SalesOrdersPageClient({
  initialParams,
}: {
  initialParams: any;
}) {
  const { params } = useUrlSearchParams(salesOrderSchema, {
    basePath: '/sales-orders',
    initialParams, // 从服务端传入
  });

  // initialParams优先级高于URL,用于SSR hydration
  return <div>Search: {params.search}</div>;
}
```

### 防抖搜索

```typescript
const { params, updateParams } = useUrlSearchParams(schema, {
  basePath: '/products',
  debounceMs: 300, // 搜索输入防抖300ms
});

// 用户输入时,300ms后才更新URL
<input
  value={params.search}
  onChange={(e) => updateParams({ search: e.target.value, page: 1 })}
/>;
```

### 删除参数

使用 `undefined` 删除URL中的参数:

```typescript
const { params, setParam } = useUrlSearchParams(schema);

// 删除status参数
setParam('status', undefined);

// 或批量删除
updateParams({
  status: undefined,
  customerId: undefined,
});
```

### 构建查询字符串

```typescript
const { buildQueryString } = useUrlSearchParams(schema);

// 基于当前参数
const currentQueryString = buildQueryString();
// => "search=test&page=2"

// 使用覆盖值
const customQueryString = buildQueryString({
  search: 'new search',
  page: 1,
});
// => "search=new+search&page=1"
```

## Schema类型支持

### 支持的参数类型

| 类型     | Zod Schema               | 配置对象                                 | 示例                      |
| -------- | ------------------------ | ---------------------------------------- | ------------------------- |
| string   | `z.string()`             | `{ type: 'string' }`                     | `"hello world"`           |
| number   | `z.number()`             | `{ type: 'number', min?: 1, max?: 100 }` | `42`                      |
| boolean  | `z.boolean()`            | `{ type: 'boolean' }`                    | `true` (false不添加到URL) |
| enum     | `z.enum(['a', 'b'])`     | `{ type: 'enum', values: ['a', 'b'] }`   | `"active"`                |
| array    | `z.array(z.string())`    | `{ type: 'array', separator: ',' }`      | `["tag1", "tag2"]`        |
| optional | `z.string().optional()`  | N/A (通过default控制)                    | `undefined` or `"value"`  |
| default  | `z.string().default('')` | `{ type: 'string', default: '' }`        | 未提供时使用默认值        |

### 类型验证

- **number**: 自动限制在min/max范围内
- **enum**: 无效值回退到默认值
- **boolean**: `true` or `false`,只有`true`添加到URL
- **array**: 使用分隔符连接,默认逗号

## 最佳实践

### 1. Schema定义位置

将Schema定义在独立文件中,便于复用:

```typescript
// lib/schemas/sales-order-params.ts
import { z } from 'zod';

export const salesOrderParamsSchema = z.object({
  search: z.string().default(''),
  status: z.enum(['pending', 'confirmed', 'shipped']).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type SalesOrderParams = z.infer<typeof salesOrderParamsSchema>;
```

### 2. 分页重置

筛选器变更时总是重置分页:

```typescript
// ✅ 正确: 重置page到1
updateParams({ search: 'new search', page: 1 });

// ❌ 错误: 不重置page,可能显示空结果
updateParams({ search: 'new search' });
```

### 3. 防抖配置

- **搜索框**: 300-500ms
- **其他筛选器**: 0ms (立即更新)

```typescript
const { params, setParam, updateParams } = useUrlSearchParams(schema, {
  debounceMs: 300, // 只对updateParams和setParam生效
});
```

### 4. 服务端渲染

始终验证`searchParams`,避免注入攻击:

```typescript
// ✅ 正确: 使用schema验证
const validatedParams = schema.parse(searchParams);

// ❌ 错误: 直接使用未验证的参数
const { search } = searchParams; // 可能是数组或undefined
```

### 5. URL格式一致性

默认值不添加到URL,保持URL简洁:

```typescript
// URL: /sales-orders (不显示默认值)
{ search: '', page: 1, sortOrder: 'desc' }

// URL: /sales-orders?search=test&page=2
{ search: 'test', page: 2, sortOrder: 'desc' }
```

## 性能优化

Hook已内置以下优化:

1. **useRef**: 避免闭包陷阱,始终使用最新参数值
2. **useTransition**: URL更新不阻塞UI渲染
3. **useCallback**: 避免不必要的函数重新创建
4. **useMemo**: 缓存Schema解析结果
5. **防抖**: 减少频繁的URL更新

## 兼容性

- **Next.js**: 14+ (App Router)
- **React**: 18+
- **TypeScript**: 5+
- **Zod**: 3+

## 故障排查

### Q: 参数更新后没有反映到URL

**A**: 检查是否在服务端组件中使用。Hook必须在客户端组件中使用(`'use client'`)。

### Q: initialParams不生效

**A**: `initialParams`仅在首次渲染时生效。之后URL变化会覆盖initialParams。

### Q: 布尔值false没有添加到URL

**A**: 这是设计行为。布尔参数只有`true`时才添加到URL,`false`等同于参数不存在,保持URL简洁。

### Q: 防抖不生效

**A**: 确保设置了`debounceMs > 0`。防抖只对`setParam`和`updateParams`生效。

### Q: TypeScript类型错误

**A**: 确保Schema类型与使用的参数一致:

```typescript
const schema = z.object({
  status: z.enum(['active', 'inactive']),
});

// ✅ 正确
setParam('status', 'active');

// ❌ 错误: 类型不匹配
setParam('status', 'invalid'); // TypeScript error
```

## 迁移指南

从旧代码迁移到`useUrlSearchParams`:

**迁移前** (~130行):

```typescript
const [searchInput, setSearchInput] = useState('');
const latestParamsRef = useRef({...});

useEffect(() => {
  latestParamsRef.current = {...initialParams};
}, [initialParams.search, initialParams.status, ...]);

const replaceURL = useCallback((overrides) => {
  const next = { ...latestParamsRef.current, ...overrides };
  const params = new URLSearchParams();
  if (next.search) params.set('search', next.search);
  // ... 20+ 行重复代码
}, [router]);

const handleSearch = useCallback((value) => {
  setSearchInput(value);
  replaceURL({ search: value, page: 1 });
}, [replaceURL]);
```

**迁移后** (~10行):

```typescript
const { params, updateParams } = useUrlSearchParams(schema, {
  basePath: '/sales-orders',
  debounceMs: 300,
});

const handleSearch = useCallback(
  (value: string) => updateParams({ search: value, page: 1 }),
  [updateParams]
);
```

**收益**: 代码量减少92%,类型安全,无闭包陷阱,统一的防抖策略。

## License

MIT
