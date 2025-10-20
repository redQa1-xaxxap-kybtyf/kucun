# 产品列表缓存问题修复报告

## 问题描述

用户反馈：创建新产品后返回产品列表页面，新创建的产品不能立即显示。

## 问题日期

2025-01-20

## 🔥 真正的根本原因（第三次深入排查）

经过彻底排查，发现了**最关键的Bug**：**Redis 缓存失效的键匹配错误**！

### Redis 缓存键匹配Bug

**问题代码位置**: `E:\kucun\lib\cache\revalidate.ts:69-74`

```typescript
// ❌ 错误的实现
if (opts.redis) {
  const redisKey = tagToRedisKey(tag); // 添加了 'query:' 前缀
  await redis.scanDel(`${redisKey}*`); // 扫描错误的模式
}
```

**问题分析**:

1. **缓存键生成**（`products-server.ts:73`）：

   ```typescript
   const cacheKey = buildCacheKey('products:list', { ...params });
   // 生成: 'products:list:{hash}'
   await redis.getJson(cacheKey);
   // 实际 Redis 键: 'inv:products:list:abc123def456'
   ```

2. **缓存失效尝试**（`revalidate.ts`）：

   ```typescript
   revalidateCache('products:list')
   ↓
   const redisKey = tagToRedisKey('products:list');
   // 返回: 'query:products:list'  ← 添加了错误的前缀！
   ↓
   await redis.scanDel('query:products:list*');
   ↓
   scanDel 添加命名空间: 'inv:query:products:list*'
   ↓
   ❌ 无法匹配实际的键: 'inv:products:list:*'
   ```

3. **结果**：Redis 缓存**从未被清除**，所以一直返回旧数据！

## 其他发现的缓存问题

经过深入排查，还发现了其他两层缓存问题：

### 1. React Query 缓存配置问题

**位置**: `E:\kucun\components\products\erp-product-list.tsx:62`

**问题代码**:

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: productQueryKeys.list(initialParams),
  queryFn: () => getProducts(initialParams),
  staleTime: 30 * 1000, // ❌ 问题：30秒缓存时间
  refetchOnWindowFocus: false,
  initialData: _initialData,
});
```

**问题分析**:

- `staleTime: 30 * 1000` 表示数据在 30 秒内被认为是"新鲜"的
- 即使调用了 `removeQueries()` 清除缓存，如果在 30 秒内再次查询，React Query 仍然不会重新获取数据
- `initialData: _initialData` 使用服务端预取数据，但没有标记为过期
- 缺少 `refetchOnMount` 配置，导致组件重新挂载时不会自动刷新

### 2. 导航时序问题

**位置**: `E:\kucun\hooks\use-product-form.ts:87-91`

**原问题代码**:

```typescript
const navigateToList = useCallback(() => {
  router.refresh(); // ❌ 异步操作，但没有等待
  router.push('/products'); // 立即执行，导致在刷新完成前就跳转
}, [router]);
```

**问题分析**:

- `router.refresh()` 是异步的，但代码没有等待它完成
- `router.push()` 立即执行，导致页面跳转发生在服务端组件刷新之前
- 用户看到的是旧数据

### 3. 服务端缓存失效缺失

**位置**:

- `E:\kucun\app\api\products\route.ts` (创建 API)
- `E:\kucun\lib\api\handlers\products.ts` (更新/删除处理器)

**原问题**:

- 缺少 Next.js 15 推荐的 `revalidatePath()` 调用
- 只有客户端缓存失效，没有服务端缓存失效

## 修复方案

### 🔥 修复 0: Redis 缓存失效逻辑（最关键）

**文件**: `E:\kucun\lib\cache\revalidate.ts:69-75`

```typescript
// ✅ 修复后的实现
if (opts.redis) {
  // ✅ 修复：直接使用标签作为模式，不添加前缀
  // 因为缓存键已经是 'products:list:{hash}' 格式
  // scanDel 会自动添加命名空间前缀
  await redis.scanDel(`${tag}*`);
}
```

**修复说明**:

- 移除 `tagToRedisKey` 调用，直接使用标签
- `scanDel` 会自动添加命名空间前缀（`inv:`）
- 现在可以正确匹配：`inv:products:list:*`

### 修复 1: React Query 缓存配置

**文件**: `E:\kucun\components\products\erp-product-list.tsx`

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: productQueryKeys.list(initialParams),
  queryFn: () => getProducts(initialParams),
  staleTime: 0, // ✅ 修复：设置为0，确保每次导航都重新获取最新数据
  refetchOnWindowFocus: false,
  refetchOnMount: 'always', // ✅ 修复：每次挂载都重新获取，确保数据最新
  initialData: _initialData,
  initialDataUpdatedAt: 0, // ✅ 修复：标记初始数据为过期，强制重新验证
});
```

**关键改进**:

- `staleTime: 0` - 数据永远被认为是过期的，每次查询都会重新获取
- `refetchOnMount: 'always'` - 组件每次挂载都重新获取数据
- `initialDataUpdatedAt: 0` - 将初始数据时间戳设置为 0，标记为过期

### 修复 2: 导航时序优化

**文件**: `E:\kucun\hooks\use-product-form.ts`

```typescript
const navigateToList = useCallback(() => {
  // ✅ Next.js 15 最佳实践：直接导航，服务端组件会自动获取最新数据
  // 因为 API 路由已经调用了 revalidatePath()，不需要额外的 refresh
  router.push('/products');
}, [router]);
```

**改进说明**:

- 移除不必要的 `router.refresh()`
- 直接导航到目标页面
- 依赖服务端的 `revalidatePath()` 确保数据最新

### 修复 3: 服务端缓存失效

#### 3.1 产品创建 API

**文件**: `E:\kucun\app\api\products\route.ts`

```typescript
// 创建产品后
const formattedProduct = toProductResponse(productWithCategory);

// ✅ Next.js 15最佳实践：使用revalidatePath确保服务端缓存失效
const { revalidatePath } = await import('next/cache');
revalidatePath('/products', 'page'); // 失效产品列表页面缓存

// 使用新的统一缓存失效系统（处理React Query和Redis缓存）
await revalidateProducts();

// 发布实时更新事件
await publishDataUpdate('products', formattedProduct.id, 'create');
```

#### 3.2 产品更新处理器

**文件**: `E:\kucun\lib\api\handlers\products.ts`

```typescript
const updatedProduct = await prisma.product.update({
  where: { id },
  data: updateData,
  select: PRODUCT_WITH_RELATIONS_SELECT,
});

// ✅ Next.js 15最佳实践：使用revalidatePath确保服务端缓存失效
const { revalidatePath } = await import('next/cache');
revalidatePath('/products', 'page'); // 失效产品列表页面缓存
revalidatePath(`/products/${id}`, 'page'); // 失效产品详情页面缓存

await invalidateProductCache(id);
```

#### 3.3 产品删除处理器

**文件**: `E:\kucun\lib\api\handlers\products.ts`

```typescript
await prisma.product.delete({
  where: { id },
});

// ✅ Next.js 15最佳实践：使用revalidatePath确保服务端缓存失效
const { revalidatePath } = await import('next/cache');
revalidatePath('/products', 'page'); // 失效产品列表页面缓存
revalidatePath(`/products/${id}`, 'page'); // 失效产品详情页面缓存

await invalidateProductCache(id);
```

## 技术原理

### Next.js 15 App Router 缓存层级

```
┌─────────────────────────────────────────┐
│  1. React Query 客户端缓存              │
│     - staleTime 控制数据新鲜度          │
│     - refetchOnMount 控制重新获取时机   │
├─────────────────────────────────────────┤
│  2. Next.js Router Cache (客户端)       │
│     - router.refresh() 刷新             │
├─────────────────────────────────────────┤
│  3. Next.js Data Cache (服务端)         │
│     - revalidatePath() 失效路径缓存     │
│     - revalidateTag() 失效标签缓存      │
├─────────────────────────────────────────┤
│  4. Redis 缓存 (应用层)                 │
│     - invalidateProductCache() 失效     │
└─────────────────────────────────────────┘
```

### 数据流程（修复后）

```
用户创建产品
    ↓
POST /api/products
    ↓
数据库写入 + 返回数据
    ↓
revalidatePath('/products', 'page')  ← 服务端缓存失效
    ↓
revalidateProducts()  ← Redis 缓存失效
    ↓
publishDataUpdate()  ← 实时更新事件
    ↓
客户端收到响应
    ↓
removeQueries()  ← React Query 缓存清除
    ↓
router.push('/products')  ← 导航到列表页
    ↓
组件挂载触发 useQuery
    ↓
staleTime: 0 → 立即获取数据  ← 强制重新获取
refetchOnMount: 'always' → 每次都刷新
initialDataUpdatedAt: 0 → 初始数据标记为过期
    ↓
GET /api/products
    ↓
服务端组件重新渲染（缓存已失效）
    ↓
从数据库获取最新数据
    ↓
返回包含新产品的列表
    ↓
✅ 用户看到新产品
```

## 关键知识点

### 1. React Query staleTime vs cacheTime

- **staleTime**: 数据被认为是"新鲜"的时长，在此期间不会重新获取
  - `staleTime: 0` - 数据立即过期，每次查询都重新获取
  - `staleTime: 30000` - 30秒内数据被认为是新鲜的

- **cacheTime** (v5 中改名为 gcTime): 未使用的缓存数据保留时长
  - 默认 5 分钟
  - 与数据新鲜度无关，只控制内存清理

### 2. React Query refetchOnMount

- `false` - 组件挂载时不重新获取
- `true` - 组件挂载时，如果数据过期则重新获取
- `'always'` - 组件挂载时总是重新获取

### 3. Next.js revalidatePath

```typescript
revalidatePath(path, type?)
```

- `path`: 要失效的路径（如 '/products'）
- `type`:
  - `'page'` - 失效特定页面路径（默认）
  - `'layout'` - 失效布局及其所有子页面

### 4. initialDataUpdatedAt

标记初始数据的时间戳：

- `0` - 数据被认为是无限过期的，强制重新验证
- `Date.now()` - 当前时间，配合 staleTime 使用
- `undefined` - 不设置时间戳（默认）

## 性能考虑

### 修复前（有问题）

```typescript
staleTime: 30 * 1000; // 30秒缓存
```

- ✅ 优点：减少 API 调用，性能更好
- ❌ 缺点：数据可能不是最新的，用户体验差

### 修复后

```typescript
staleTime: 0;
refetchOnMount: 'always';
initialDataUpdatedAt: 0;
```

- ✅ 优点：数据始终最新，用户体验好
- ⚠️ 考虑：每次导航都会发起 API 请求

### 性能优化建议

如果担心性能问题，可以考虑：

1. **智能缓存策略**

```typescript
staleTime: 5 * 1000,  // 5秒内复用缓存
refetchOnMount: true,  // 只在数据过期时重新获取
```

2. **使用 Server-Sent Events (SSE) 或 WebSocket**
   - 实时推送数据更新
   - 减少轮询和主动刷新

3. **乐观更新**

```typescript
onMutate: async (newProduct) => {
  // 取消正在进行的查询
  await queryClient.cancelQueries({ queryKey: productQueryKeys.lists() });

  // 获取当前缓存数据
  const previousData = queryClient.getQueryData(productQueryKeys.lists());

  // 乐观更新缓存
  queryClient.setQueryData(productQueryKeys.lists(), (old) => {
    return {
      ...old,
      data: [newProduct, ...old.data],
    };
  });

  return { previousData };
},
```

## 测试验证

### 测试步骤

1. **创建产品测试**
   - 访问 `/products/create`
   - 填写产品信息并提交
   - 观察是否立即返回列表页
   - ✅ 验证：新产品应该立即出现在列表中

2. **更新产品测试**
   - 访问产品详情页 `/products/[id]`
   - 修改产品信息并保存
   - 返回列表页
   - ✅ 验证：修改后的信息应该立即显示

3. **删除产品测试**
   - 在列表页删除一个产品
   - ✅ 验证：产品应该立即从列表中消失

4. **并发操作测试**
   - 打开两个浏览器标签页
   - 在标签页 A 创建产品
   - 在标签页 B 刷新列表
   - ✅ 验证：标签页 B 应该看到新产品（依赖 revalidatePath）

### 预期行为

- ✅ 创建产品后，列表立即显示新产品
- ✅ 更新产品后，列表和详情页立即更新
- ✅ 删除产品后，列表立即移除该产品
- ✅ 页面刷新能获取最新数据
- ✅ 不同标签页之间数据一致（通过服务端缓存失效）

## 相关文件

### 修改的文件

1. `E:\kucun\components\products\erp-product-list.tsx` - React Query 配置
2. `E:\kucun\hooks\use-product-form.ts` - 导航逻辑
3. `E:\kucun\app\api\products\route.ts` - 创建 API
4. `E:\kucun\lib\api\handlers\products.ts` - 更新/删除处理器

### 相关配置文件

- `E:\kucun\app\(dashboard)\products\page.tsx` - 服务端组件配置
- `E:\kucun\lib\cache\revalidate.ts` - 统一缓存失效系统
- `E:\kucun\lib\cache\product-cache.ts` - 产品缓存函数

## 经验教训

### 1. 理解多层缓存系统

- Next.js 应用有多层缓存（React Query、Router Cache、Data Cache、Redis）
- 必须在所有层级都正确失效缓存才能保证数据一致性

### 2. staleTime 的影响

- `staleTime` 是 React Query 中最容易被误解的配置
- 设置不当会导致即使清除缓存也看不到最新数据

### 3. initialData 的双刃剑

- `initialData` 可以提供更好的首屏体验
- 但必须配合 `initialDataUpdatedAt` 正确管理，否则会导致数据不更新

### 4. 异步操作要等待

- `router.refresh()` 等异步操作必须等待完成
- 或者依赖服务端的 `revalidatePath()` 确保数据最新

### 5. Next.js 15 最佳实践

- 数据变更后，在服务端调用 `revalidatePath()` 是关键
- 这是 App Router 的推荐做法，比客户端 `router.refresh()` 更可靠

## 后续优化建议

1. **监控和日志**
   - 添加缓存命中率监控
   - 记录 API 调用频率
   - 追踪数据一致性问题

2. **性能优化**
   - 考虑使用乐观更新减少用户等待
   - 实现 SSE 或 WebSocket 实时推送
   - 优化 `staleTime` 配置，平衡性能和新鲜度

3. **用户体验**
   - 添加加载状态指示器
   - 实现骨架屏提升感知性能
   - 添加成功提示动画

4. **代码规范**
   - 建立缓存配置规范文档
   - 创建缓存配置模板
   - 代码审查检查清单

## 参考资料

- [Next.js 15 Data Fetching and Caching](https://nextjs.org/docs/app/building-your-application/data-fetching/fetching-caching-and-revalidating)
- [React Query staleTime vs cacheTime](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- [Next.js revalidatePath API](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [React Query refetchOnMount](https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching)
