# 架构真相与根本解决方案

> **基于**: TanStack Query v5 官方文档 + Next.js 15 最佳实践  
> **目的**: 回答根本性问题,停止打补丁  
> **结论**: 我们的实现是**正确的**,问题不在架构

---

## 🎯 您的核心疑问

### 1. 正常的开发逻辑应该是什么?

**您的理解 100% 正确**:

```
✅ 首次访问库存管理 → 加载数据 (正常)
✅ 切换到仪表盘 → 加载数据 (正常)
✅ 返回库存管理 → 从缓存读取 (不应该重复请求)
✅ 只有缓存过期或手动 invalidate 才重新请求
```

这就是 TanStack Query 的设计目标!

---

## 🔍 真相: 我们的架构是正确的

### 官方文档明确支持我们的实现

根据 TanStack Query v5 官方文档 [Advanced Server Rendering](https://tanstack.com/query/v5/docs/react/guides/advanced-ssr):

#### ✅ 每个页面创建新的 QueryClient (正确!)

**官方推荐代码**:

```typescript
// app/posts/page.tsx - 官方示例
export default async function PostsPage() {
  const queryClient = new QueryClient() // ✅ 每个页面创建新的

  await queryClient.prefetchQuery({
    queryKey: ['posts'],
    queryFn: getPosts,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Posts />
    </HydrationBoundary>
  )
}
```

**官方解释**:

> "It's perfectly fine to use `<HydrationBoundary>` in multiple places, and create and dehydrate multiple `queryClient` for prefetching."

**我们的实现**: ✅ 完全符合官方推荐

---

#### ✅ 全局 QueryClient 应该跨路由保持缓存 (正确!)

**官方推荐代码**:

```typescript
// app/providers.tsx - 官方示例
'use client'

let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (isServer) {
    return makeQueryClient() // 服务端: 每次新建
  } else {
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient // 客户端: 单例,跨路由共享
  }
}

export default function Providers({ children }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

**官方解释**:

> "Browser: make a new query client if we don't already have one. This is very important, so we don't re-make a new client if React suspends during the initial render."

**我们的实现**: ✅ 完全符合官方推荐

---

## 💡 那么问题到底在哪里?

### 问题不在架构,在于 Next.js 15 的路由行为

#### Next.js 15 App Router 的实际行为

**官方文档警告**:

> "With Server Components, it's important to think about data ownership and revalidation."

**实际发生的事情**:

```
用户操作: 仪表盘 → 库存管理 → 仪表盘

第1步: 访问仪表盘
- 服务端: 创建 QueryClient A,预取仪表盘数据
- 客户端: dehydrate(QueryClient A) → 全局 QueryClient
- 结果: 全局 QueryClient 有仪表盘数据 ✅

第2步: 切换到库存管理
- 服务端: 创建 QueryClient B,预取库存数据
- 客户端: dehydrate(QueryClient B) → 全局 QueryClient
- 问题: HydrationBoundary 会覆盖全局 QueryClient 的数据吗? ❓

第3步: 返回仪表盘
- 服务端: 创建 QueryClient C,预取仪表盘数据
- 客户端: dehydrate(QueryClient C) → 全局 QueryClient
- 问题: 为什么需要重新请求? ❓
```

---

## 🔬 深入分析: HydrationBoundary 的工作原理

### HydrationBoundary 不会覆盖现有缓存

**官方文档说明**:

```typescript
// HydrationBoundary 的行为
<HydrationBoundary state={dehydratedState}>
  <Posts />
</HydrationBoundary>
```

**实际行为**:

1. **Hydrate 时**: 将 `dehydratedState` 中的数据合并到全局 QueryClient
2. **不会覆盖**: 如果全局 QueryClient 已有相同 queryKey 的数据,不会覆盖
3. **保留缓存**: 旧页面的缓存应该保留在全局 QueryClient 中

**理论上应该工作**:

```
仪表盘 → 库存管理:
- 全局 QueryClient: {仪表盘数据, 库存数据}

库存管理 → 仪表盘:
- 全局 QueryClient: {仪表盘数据 (缓存), 库存数据}
- 应该从缓存读取,不重新请求 ✅
```

---

## 🐛 真正的问题: Next.js 15 的路由切换行为

### Next.js 15 App Router 的特殊行为

**官方文档警告**:

> "Server Components are guaranteed to only run on the server, both for the initial page view **and also on page transitions**."

**这意味着**:

```
每次路由切换 (包括返回):
1. Next.js 在服务端重新渲染 Server Component
2. 创建新的 QueryClient,预取数据
3. 将新的 dehydratedState 发送到客户端
4. 客户端 HydrationBoundary 接收新的 state

问题: Next.js 是否会强制使用新的 state,忽略现有缓存?
```

---

## 📊 实际测试需要验证的假设

### 假设 1: HydrationBoundary 正确保留缓存

**如果这是真的**:

- 返回仪表盘时,应该从缓存读取
- 不应该有新的网络请求
- 加载时间应该 < 100ms

**如果这是假的**:

- 每次路由切换都重新请求
- 缓存命中率 0%
- 加载时间 150-200ms

---

### 假设 2: Next.js 强制使用新的 dehydratedState

**如果这是真的**:

- 即使全局 QueryClient 有缓存,也会被新的 state 覆盖
- 这是 Next.js 的设计,不是 TanStack Query 的问题
- 需要不同的解决方案

---

## 🎯 根本解决方案

### 方案 1: 验证当前实现是否正常工作

**步骤**:

1. **检查全局 QueryClient 配置**

   ```typescript
   // components/providers/query-provider.tsx
   staleTime: 2 * 60 * 1000, // ✅ 2分钟
   ```

2. **检查页面级 staleTime**

   ```typescript
   // hooks/use-optimized-inventory-query.ts
   staleTime = Infinity, // ❌ 改为 5 * 60 * 1000
   ```

3. **使用浏览器测试**
   - 打开 React Query Devtools
   - 切换菜单,观察缓存状态
   - 检查是否有重复请求

---

### 方案 2: 如果缓存确实被覆盖,使用 Router Cache

**Next.js 15 的 Router Cache**:

```typescript
// next.config.js
module.exports = {
  experimental: {
    staleTimes: {
      dynamic: 30, // 动态路由缓存 30 秒
      static: 180, // 静态路由缓存 180 秒
    },
  },
};
```

**优点**:

- Next.js 原生支持
- 自动缓存整个路由
- 不依赖 TanStack Query

**缺点**:

- 缓存时间固定
- 无法精确控制

---

### 方案 3: 使用 Link prefetch (已实现)

**当前实现**:

```typescript
// components/common/SidebarNavItem.tsx
<Link href="/inventory" prefetch={true}>
  库存管理
</Link>
```

**工作原理**:

1. **Hover 时**: Next.js 预取路由
2. **点击时**: 从 Next.js Router Cache 读取
3. **结果**: 快速加载,无需等待服务端

**这应该已经解决了大部分问题!**

---

## 🔍 诊断步骤

### 立即执行的测试

1. **检查 staleTime 配置**

   ```bash
   # 查看当前配置
   grep -r "staleTime" hooks/use-optimized-inventory-query.ts
   grep -r "staleTime" components/providers/query-provider.tsx
   ```

2. **修改 staleTime**

   ```typescript
   // hooks/use-optimized-inventory-query.ts
   staleTime = 5 * 60 * 1000, // 从 Infinity 改为 5分钟
   ```

3. **测试缓存行为**
   - 打开应用
   - 打开 React Query Devtools
   - 切换菜单: 仪表盘 → 库存管理 → 仪表盘
   - 观察:
     - 是否有重复请求?
     - 缓存状态是什么?
     - 数据是从哪里来的?

---

## 📚 官方文档的明确建议

### TanStack Query 官方建议

**关于 Server Components**:

> "If you are just starting out with a new Server Components app, we suggest you start out with any tools for data fetching your framework provides you with and avoid bringing in React Query until you actually need it."

**关于数据所有权**:

> "From the React Query perspective, treat Server Components as a place to prefetch data, nothing more."

**关于 staleTime**:

> "With SSR, we usually want to set some default staleTime above 0 to avoid refetching immediately on the client."

---

## ✅ 最终结论

### 我们的架构是正确的

1. ✅ **每个页面创建新的 QueryClient** - 官方推荐
2. ✅ **全局 QueryClient 单例** - 官方推荐
3. ✅ **HydrationBoundary 传递数据** - 官方推荐
4. ✅ **Link prefetch={true}** - 官方推荐

### 可能的问题

1. ⚠️ **staleTime=Infinity** - 应该改为 5分钟
2. ⚠️ **需要验证缓存是否真的被保留** - 需要实际测试
3. ⚠️ **Next.js Router Cache 可能需要配置** - 可选优化

---

## 🚀 立即行动

### 第一步: 修改 staleTime (5分钟)

```typescript
// hooks/use-optimized-inventory-query.ts
export function useOptimizedInventoryQuery({
  params,
  enabled = true,
  staleTime = 5 * 60 * 1000, // ✅ 改为 5分钟
  cacheTime = 10 * 60 * 1000,
}: UseOptimizedInventoryQueryOptions) {
  // ...
}
```

### 第二步: 实际测试 (10分钟)

1. 打开应用 + React Query Devtools
2. 切换菜单,观察缓存
3. 记录实际行为

### 第三步: 根据测试结果决定

**如果缓存正常工作**:

- ✅ 问题解决,只需调整 staleTime

**如果缓存被覆盖**:

- 📝 这是 Next.js 的设计
- 🔧 需要使用 Router Cache 或其他方案

---

## 📖 权威参考

1. **TanStack Query v5 官方文档**
   - [Advanced Server Rendering](https://tanstack.com/query/v5/docs/react/guides/advanced-ssr)
   - [Server Rendering & Hydration](https://tanstack.com/query/v5/docs/react/guides/ssr)

2. **Next.js 15 官方文档**
   - [App Router](https://nextjs.org/docs/app)
   - [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

3. **官方示例**
   - [Next.js App with Prefetching](https://tanstack.com/query/v5/docs/framework/react/examples/nextjs-app-prefetching)

---

**结论**: 停止打补丁,先验证假设,再决定方案!
