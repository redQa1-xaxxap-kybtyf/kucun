# URL参数管理重构方案 - 最佳实践

## 📊 当前问题分析

### 发现的代码重复模式

在20+个文件中发现了相同的URL参数管理模式,存在以下问题:

#### 1. **重复的参数构建逻辑**

```typescript
// ❌ 在多个文件中重复 20+ 次
const replaceURL = overrides => {
  const params = new URLSearchParams();
  if (next.search) params.set('search', next.search);
  if (next.status) params.set('status', next.status);
  if (next.customerId) params.set('customerId', next.customerId);
  if (next.sortBy) params.set('sortBy', next.sortBy);
  if (next.sortOrder) params.set('sortOrder', next.sortOrder);
  if (next.page > 1) params.set('page', next.page.toString());
  // ... 更多重复代码
};
```

**影响的文件**:

- `app/(dashboard)/sales-orders/page-client.tsx`
- `app/(dashboard)/inventory/page-client.tsx`
- `app/(dashboard)/factory-shipments/page-client.tsx`
- `components/finance/receivables-client/useReceivablesController.ts`
- `hooks/use-product-list-state.ts`
- ... 共20个文件

#### 2. **重复的状态同步逻辑**

```typescript
// ❌ 每个组件都重复实现
const latestParamsRef = useRef({...});
useEffect(() => {
  latestParamsRef.current = {...initialParams};
}, [initialParams.search, initialParams.status, ...]);
```

#### 3. **缺乏类型安全**

```typescript
// ❌ 参数类型在多处定义,容易不一致
type LatestQueryState = {
  search: string;
  status?: string;
  // ... 每个文件可能定义不同
};
```

### 问题总结

| 问题类型       | 严重程度 | 影响                             |
| -------------- | -------- | -------------------------------- |
| **代码重复**   | 🔴 高    | 20+个文件重复相同逻辑,维护成本高 |
| **可扩展性差** | 🟡 中    | 添加新筛选器需要修改多处         |
| **错误风险**   | 🟡 中    | 容易遗漏参数同步或URL构建错误    |
| **类型不一致** | 🟢 低    | 参数类型定义分散,缺乏统一标准    |

---

## 🎯 解决方案设计

### 方案对比

#### 方案1: 自定义 `useUrlSearchParams` Hook (推荐)

**优点**:

- ✅ 完全控制,适配项目特定需求
- ✅ 零额外依赖,包体积小
- ✅ 学习成本低,基于现有模式
- ✅ 类型安全,与项目类型系统完美集成

**缺点**:

- ⚠️ 需要自己维护和测试
- ⚠️ 功能可能不如专业库全面

#### 方案2: 使用 `nuqs` 库

**优点**:

- ✅ 成熟的类型安全解决方案
- ✅ 类似 `useState` 的API,易于使用
- ✅ 支持批量更新、服务端渲染
- ✅ 社区维护,功能丰富

**缺点**:

- ⚠️ 额外依赖 (~5.5KB gzipped)
- ⚠️ 需要学习新API
- ⚠️ 可能与现有代码风格不一致

**推荐**: **方案1 - 自定义Hook**

- 因为项目已有清晰的URL参数管理模式
- 可以保持与现有代码风格一致
- 避免引入新依赖增加复杂度

---

## 🛠️ 实施方案: 自定义 `useUrlSearchParams` Hook

### 设计原则

#### 1. **类型安全优先**

```typescript
// 使用泛型确保类型安全
function useUrlSearchParams<T extends Record<string, any>>(
  schema: ParamSchema<T>,
  options?: Options
): UrlSearchParamsResult<T>;
```

#### 2. **声明式配置**

```typescript
// 通过schema配置参数行为
const schema = {
  search: { type: 'string', default: '' },
  status: { type: 'enum', values: ['active', 'inactive'] },
  page: { type: 'number', default: 1 },
  sortOrder: { type: 'enum', values: ['asc', 'desc'] as const },
};
```

#### 3. **单一职责**

- Hook只负责URL参数的读取、更新、序列化
- 不包含业务逻辑(如API调用、数据转换)

#### 4. **符合React最佳实践**

- 使用 `useTransition` 避免阻塞UI
- 使用 `useCallback` 避免不必要的重渲染
- 使用 `useRef` 避免闭包陷阱

### 核心API设计

```typescript
/**
 * 通用URL参数管理Hook
 *
 * @example
 * const { params, updateParams, setParam } = useUrlSearchParams(
 *   salesOrderSchema,
 *   { basePath: '/sales-orders' }
 * );
 *
 * // 使用参数
 * console.log(params.search); // 类型安全的访问
 *
 * // 更新单个参数
 * setParam('status', 'confirmed');
 *
 * // 批量更新参数
 * updateParams({ search: 'test', page: 1 });
 */
function useUrlSearchParams<T extends Record<string, any>>(
  schema: ParamSchema<T>,
  options?: {
    basePath?: string;
    debounceMs?: number;
    shallow?: boolean;
  }
): {
  /** 当前参数值(类型安全) */
  params: T;

  /** 更新单个参数 */
  setParam: <K extends keyof T>(key: K, value: T[K]) => void;

  /** 批量更新参数 */
  updateParams: (updates: Partial<T>) => void;

  /** 重置所有参数到默认值 */
  resetParams: () => void;

  /** 构建查询字符串 */
  buildQueryString: (overrides?: Partial<T>) => string;
};
```

### Schema定义示例

```typescript
import { z } from 'zod';

// 方式1: 使用Zod Schema(与现有验证系统集成)
const salesOrderSchema = z.object({
  search: z.string().default(''),
  status: z.enum(['pending', 'confirmed', 'shipped']).optional(),
  customerId: z.string().uuid().optional(),
  sortBy: z.enum(['createdAt', 'orderNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

type SalesOrderParams = z.infer<typeof salesOrderSchema>;

// 方式2: 简化的配置对象
const salesOrderConfig = {
  search: { type: 'string', default: '' },
  status: {
    type: 'enum',
    values: ['pending', 'confirmed', 'shipped'] as const,
  },
  page: { type: 'number', default: 1, min: 1 },
  sortOrder: {
    type: 'enum',
    values: ['asc', 'desc'] as const,
    default: 'desc',
  },
} as const;
```

---

## 📝 实施步骤

### Phase 1: 核心Hook实现

#### 文件结构

```
hooks/
├── url-search-params/
│   ├── index.ts                    # 主Hook导出
│   ├── types.ts                    # 类型定义
│   ├── schema-parser.ts            # Schema解析器
│   ├── url-builder.ts              # URL构建工具
│   └── __tests__/
│       └── useUrlSearchParams.test.ts
```

#### 实现清单

1. **创建类型定义** (`hooks/url-search-params/types.ts`)
   - ParamSchema类型
   - ParamValue类型
   - Hook返回类型

2. **实现Schema解析器** (`hooks/url-search-params/schema-parser.ts`)
   - 支持Zod schema
   - 支持简化配置对象
   - 类型转换和验证

3. **实现URL构建器** (`hooks/url-search-params/url-builder.ts`)
   - 序列化参数到URLSearchParams
   - 处理默认值(不添加到URL)
   - 处理空值/undefined

4. **实现核心Hook** (`hooks/url-search-params/index.ts`)
   - 读取初始参数
   - 同步URL变化
   - 提供更新函数
   - 集成useTransition

### Phase 2: 重构现有组件

#### 重构优先级

**第一批** (核心模块,用户使用频繁):

1. `app/(dashboard)/sales-orders/page-client.tsx` - 销售订单
2. `app/(dashboard)/inventory/page-client.tsx` - 库存管理
3. `components/finance/receivables-client/` - 应收账款

**第二批** (重要但使用频率中等): 4. `app/(dashboard)/factory-shipments/page-client.tsx` - 厂家发货 5. `app/(dashboard)/return-orders/page-client.tsx` - 退货订单 6. `hooks/use-product-list-state.ts` - 产品列表

**第三批** (其他模块):
7-20. 其余15个文件

#### 重构示例: 销售订单

**重构前** (130行):

```typescript
// ❌ 复杂的手动管理
const [searchInput, setSearchInput] = useState('');
const latestParamsRef = useRef({...});

useEffect(() => {
  latestParamsRef.current = {...initialParams};
}, [initialParams.search, initialParams.status, ...]);

const replaceURL = useCallback((overrides) => {
  const next = { ...latestParamsRef.current, ...overrides };
  const params = new URLSearchParams();
  if (next.search) params.set('search', next.search);
  if (next.status) params.set('status', next.status);
  // ... 20+ 行重复代码
}, [router]);

const handleSearch = useCallback((value) => {
  setSearchInput(value);
  const overrides = { search: value, page: 1 };
  latestParamsRef.current = { ...latestParamsRef.current, ...overrides };
  replaceURL(overrides);
}, [replaceURL]);
```

**重构后** (10行):

```typescript
// ✅ 简洁的声明式使用
const { params, setParam, updateParams } = useUrlSearchParams(
  salesOrderSchema,
  { basePath: '/sales-orders', debounceMs: 300 }
);

const handleSearch = useCallback(
  (value: string) => {
    updateParams({ search: value, page: 1 });
  },
  [updateParams]
);
```

**改进效果**:

- 代码量减少 **92%** (130行 → 10行)
- 类型安全: 编译时检查参数类型
- 无闭包陷阱: Hook内部处理
- 统一的防抖: 配置中指定
- 更易测试: 业务逻辑与URL管理解耦

### Phase 3: 测试和验证

#### 单元测试

```typescript
// hooks/url-search-params/__tests__/useUrlSearchParams.test.ts
describe('useUrlSearchParams', () => {
  it('应该从URL读取初始参数', () => {
    const { params } = renderHook(() =>
      useUrlSearchParams(schema, { initialUrl: '?search=test&page=2' })
    );

    expect(params.search).toBe('test');
    expect(params.page).toBe(2);
  });

  it('应该正确更新单个参数', async () => {
    const { params, setParam } = renderHook(() => useUrlSearchParams(schema));

    act(() => {
      setParam('search', 'new value');
    });

    await waitFor(() => {
      expect(params.search).toBe('new value');
    });
  });

  it('应该批量更新参数', async () => {
    const { params, updateParams } = renderHook(() =>
      useUrlSearchParams(schema)
    );

    act(() => {
      updateParams({ search: 'test', page: 1, status: 'confirmed' });
    });

    await waitFor(() => {
      expect(params).toEqual({
        search: 'test',
        page: 1,
        status: 'confirmed',
        // ... other defaults
      });
    });
  });
});
```

#### 集成测试

- 测试URL同步
- 测试浏览器前进/后退
- 测试并发更新
- 测试防抖功能

---

## 🎨 使用示例

### 示例1: 销售订单列表

```typescript
'use client';

import { useUrlSearchParams } from '@/hooks/url-search-params';
import { salesOrderSchema } from '@/lib/types/sales-order';

export function SalesOrdersPageClient() {
  const { params, setParam, updateParams } = useUrlSearchParams(
    salesOrderSchema,
    {
      basePath: '/sales-orders',
      debounceMs: 300 // 搜索框防抖
    }
  );

  // 使用参数进行API查询
  const { data, isLoading } = useSalesOrders(params);

  return (
    <>
      <SalesOrderPageHeader
        onSearch={value => updateParams({ search: value, page: 1 })}
        onStatusChange={status => updateParams({ status, page: 1 })}
        currentStatus={params.status}
      />

      <ERPSalesOrderList
        searchQuery={params.search}
        status={params.status}
        sortBy={params.sortBy}
        sortOrder={params.sortOrder}
        onSortChange={(sortBy, sortOrder) =>
          updateParams({ sortBy, sortOrder })
        }
        onPageChange={page => setParam('page', page)}
      />
    </>
  );
}
```

### 示例2: 库存列表

```typescript
'use client';

import { useUrlSearchParams } from '@/hooks/url-search-params';
import { z } from 'zod';

const inventorySchema = z.object({
  search: z.string().default(''),
  lowStock: z.boolean().default(false),
  categoryId: z.string().uuid().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export function InventoryPageClient() {
  const { params, updateParams, resetParams } = useUrlSearchParams(
    inventorySchema,
    { basePath: '/inventory' }
  );

  return (
    <>
      <InventoryToolbar
        filters={{
          search: params.search,
          lowStock: params.lowStock,
          categoryId: params.categoryId,
        }}
        onFilterChange={updateParams}
        onResetFilters={resetParams}
      />

      <InventoryList
        filters={params}
        page={params.page}
        limit={params.limit}
        onPageChange={page => updateParams({ page })}
      />
    </>
  );
}
```

### 示例3: 带日期范围的财务报表

```typescript
'use client';

import { useUrlSearchParams } from '@/hooks/url-search-params';
import { z } from 'zod';

const financialReportSchema = z.object({
  customerId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reportType: z.enum(['summary', 'detailed']).default('summary'),
  page: z.number().int().positive().default(1),
});

export function FinancialReportClient() {
  const { params, updateParams } = useUrlSearchParams(
    financialReportSchema,
    { basePath: '/finance/reports' }
  );

  const handleDateRangeChange = useCallback((range: DateRange) => {
    updateParams({
      startDate: range.from?.toISOString().split('T')[0],
      endDate: range.to?.toISOString().split('T')[0],
      page: 1, // 重置分页
    });
  }, [updateParams]);

  return (
    <>
      <DateRangePicker
        from={params.startDate ? new Date(params.startDate) : undefined}
        to={params.endDate ? new Date(params.endDate) : undefined}
        onChange={handleDateRangeChange}
      />

      <FinancialReportTable
        filters={params}
        onPageChange={page => updateParams({ page })}
      />
    </>
  );
}
```

---

## 📊 预期收益

### 定量收益

| 指标         | 重构前                    | 重构后                              | 改进      |
| ------------ | ------------------------- | ----------------------------------- | --------- |
| **代码行数** | ~2,600行 (20文件 × 130行) | ~500行 (Hook 200行 + 20文件 × 15行) | **-81%**  |
| **重复代码** | 20处重复                  | 0处重复                             | **-100%** |
| **类型定义** | 20处分散定义              | 1处集中定义                         | **-95%**  |
| **维护点**   | 20个文件需同步修改        | 1个Hook集中维护                     | **-95%**  |

### 定性收益

#### 1. **可维护性提升** 🟢

- ✅ 统一管理: 所有URL参数逻辑集中在一个Hook
- ✅ 单一修改点: 添加新功能只需修改Hook
- ✅ 易于调试: 问题定位更快速

#### 2. **开发效率提升** 🟢

- ✅ 新功能开发更快: 10行代码 vs 130行代码
- ✅ 学习曲线平缓: 统一的API,新成员快速上手
- ✅ 代码审查更简单: 业务逻辑与URL管理分离

#### 3. **质量提升** 🟢

- ✅ 类型安全: 编译时捕获错误
- ✅ 测试覆盖: Hook单独测试,覆盖率高
- ✅ Bug减少: 避免手动同步错误

#### 4. **用户体验提升** 🟢

- ✅ 统一的防抖策略: 更流畅的搜索体验
- ✅ 正确的URL状态: 刷新页面状态保持
- ✅ 浏览器前进/后退支持: 符合用户预期

---

## ⚠️ 迁移注意事项

### 兼容性考虑

#### 1. **URL格式保持不变**

```typescript
// 确保重构后URL格式与之前一致
// 重构前: /sales-orders?search=test&status=confirmed&page=2
// 重构后: /sales-orders?search=test&status=confirmed&page=2
// ✅ 完全相同,不影响现有链接和书签
```

#### 2. **逐步迁移策略**

```typescript
// 可以在同一页面共存
// 旧方式(临时)
const oldParams = useOldUrlParams();

// 新方式
const { params } = useUrlSearchParams(schema);

// 逐步替换旧方式的使用
```

#### 3. **服务端渲染兼容**

```typescript
// Server Component: 使用searchParams prop
export default function Page({ searchParams }: PageProps) {
  const validatedParams = salesOrderSchema.parse(searchParams);
  return <SalesOrdersPageClient initialParams={validatedParams} />;
}

// Client Component: 使用useUrlSearchParams
function SalesOrdersPageClient({ initialParams }: Props) {
  const { params } = useUrlSearchParams(salesOrderSchema, {
    initialParams,  // 从服务端传入初始值
    basePath: '/sales-orders'
  });
  // ...
}
```

### 潜在风险和缓解措施

| 风险            | 影响  | 缓解措施                        |
| --------------- | ----- | ------------------------------- |
| **重构引入Bug** | 🟡 中 | 充分的单元测试和集成测试        |
| **性能影响**    | 🟢 低 | Hook使用useCallback和useRef优化 |
| **学习成本**    | 🟢 低 | API设计简单,文档完善            |
| **迁移工作量**  | 🟡 中 | 分阶段迁移,逐步完成             |

---

## 🚀 实施时间线

### Week 1: 设计和实现核心Hook

- Day 1-2: 类型定义和Schema解析器
- Day 3-4: URL构建器和核心Hook
- Day 5: 单元测试(覆盖率 > 90%)

### Week 2: 第一批组件重构(3个核心模块)

- Day 1-2: 销售订单模块重构 + 测试
- Day 3: 库存管理模块重构 + 测试
- Day 4: 应收账款模块重构 + 测试
- Day 5: 集成测试和回归测试

### Week 3: 第二批组件重构(6个重要模块)

- Day 1-5: 逐个模块重构和测试

### Week 4: 第三批组件重构(剩余11个模块)

- Day 1-4: 批量重构
- Day 5: 全面测试和文档更新

**总计**: 4周完成全部重构

---

## 📚 参考资料

### Next.js官方文档

- [useSearchParams Hook](https://nextjs.org/docs/app/api-reference/functions/use-search-params)
- [Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)

### React最佳实践

- [React Hooks规则](https://react.dev/reference/rules)
- [useTransition for non-blocking updates](https://react.dev/reference/react/useTransition)

### 类型安全

- [Zod Schema Validation](https://zod.dev/)
- [TypeScript Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)

### 替代方案

- [nuqs - Type-safe URL state management](https://nuqs.47ng.com/)
- [use-query-params](https://github.com/pbeshai/use-query-params)

---

## 💡 核心原则总结

### SOLID原则应用

1. **单一职责 (SRP)**
   - Hook只负责URL参数管理,不包含业务逻辑

2. **开放/封闭 (OCP)**
   - 通过Schema配置扩展功能,无需修改Hook代码

3. **依赖倒置 (DIP)**
   - 组件依赖抽象的Hook接口,不依赖具体实现

### DRY原则

- 20+个文件的重复代码提取为1个可复用Hook
- Schema定义可在项目中共享复用

### KISS原则

- API设计简单直观,类似useState
- 配置声明式,易于理解和使用

---

## ✅ 成功标准

### 功能完整性

- [ ] 所有现有功能正常工作
- [ ] URL格式与重构前完全一致
- [ ] 浏览器前进/后退正常

### 代码质量

- [ ] 单元测试覆盖率 > 90%
- [ ] 集成测试通过
- [ ] 无TypeScript类型错误
- [ ] 无ESLint警告

### 性能指标

- [ ] 页面加载时间无明显增加
- [ ] URL更新响应时间 < 50ms
- [ ] 无内存泄漏

### 文档完整性

- [ ] Hook API文档完整
- [ ] 使用示例清晰
- [ ] 迁移指南详细

---

**结论**: 通过实施自定义 `useUrlSearchParams` Hook,可以显著提升代码质量、可维护性和开发效率,同时保持与现有代码的兼容性。建议立即开始实施第一阶段。
