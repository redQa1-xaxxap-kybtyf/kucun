# 产品选择器性能优化方案

## 问题诊断

### 当前实现问题

在 `lib/api/inbound.ts` 的 `useProductSearch` 函数中：

```typescript
// 1. 搜索产品列表 (1次请求)
const response = await fetch(`${PRODUCTS_API}?${searchParams}`);

// 2. 为每个产品并行请求库存 (N次请求)
const inventoryResponse = await fetch(`/api/inventory?productId=${product.id}`);

// 3. 为每个产品并行请求批次规格 (N次请求)
const batchSpecResponse = await fetch(
  `/api/batch-specifications?productId=${product.id}`
);
```

**性能影响**：

- 搜索20个产品 = 1 + 20 + 20 = **41次API请求**
- 网络延迟250ms × 41 = **10秒+**
- 这是典型的 **Request Waterfall** 问题

## 优化方案对比

### 方案1：后端API重构（推荐）✅

**实施方式**：
修改 `/api/products` 端点，支持 `includeBatchSpecs=true` 参数，一次性返回：

- 产品基本信息
- 库存汇总数据
- 批次规格详情

**优点**：

- ✅ 只需1次HTTP请求
- ✅ 服务端批量查询更快
- ✅ 客户端体验最佳
- ✅ 符合React Query最佳实践

**缺点**：

- ⚠️ 需要修改后端API

**实施步骤**：

1. 在产品API中添加关联查询
2. 优化SQL查询性能
3. 修改前端使用新API

---

### 方案2：懒加载批次数据

**实施方式**：

- 搜索时只返回产品基本信息
- 用户选择产品后再加载批次数据

**优点**：

- ✅ 搜索快速（1次请求）
- ✅ 前端改动小

**缺点**：

- ❌ 选择产品后需等待加载
- ❌ 用户体验不连贯

---

### 方案3：DataLoader批量请求

**实施方式**：
使用批量请求模式：

```typescript
// 收集所有产品ID
const productIds = products.map(p => p.id);

// 批量请求
const [inventories, batchSpecs] = await Promise.all([
  fetch(`/api/inventory/batch?ids=${productIds.join(',')}`),
  fetch(`/api/batch-specifications/batch?ids=${productIds.join(',')}`),
]);
```

**优点**：

- ✅ 请求数大幅减少 (41 → 3)
- ✅ 适合现有架构

**缺点**：

- ⚠️ 需要新增批量API
- ⚠️ 前端数据组装复杂

## 推荐方案：方案1

根据 TanStack Query 官方最佳实践：

> "For optimal performance it's better to restructure your API so you can fetch both of these in a single query"

## 技术参考

- [TanStack Query: Request Waterfalls](https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls)
- [React Query Performance Best Practices](https://tkdodo.eu/blog/react-query-render-optimizations)
- [Avoiding API Waterfalls](https://betterprogramming.pub/request-batching-in-react-b8fd0656b28b)

## 预期效果

**优化前**：

- 请求数：41次
- 响应时间：~10秒 (250ms × 41)

**优化后**：

- 请求数：1次
- 响应时间：~500ms (单次请求)

**性能提升**：**20倍**

## 实施状态

✅ **已完成** (2025-10-20)

### 实施的修改

1. **新增批量获取函数** (`lib/api/handlers/products-list.ts`)
   - 新增 `getProductsBatchSpecifications()` 函数
   - 使用 Prisma 的批量查询避免 N+1 问题
   - 一次性获取所有产品的库存记录和批次规格

2. **修改格式化函数** (`lib/api/handlers/products-list.ts`)
   - `formatProductList()` 支持可选的 `batchSpecsMap` 参数
   - 在产品响应中包含 `batchSpecs` 字段

3. **服务端数据获取** (`lib/api/products-server.ts`)
   - `getProductsForServer()` 支持 `includeBatchSpecs` 参数
   - 当参数为 `true` 时调用批量获取函数
   - 更新缓存键包含新参数

4. **API路由层** (`app/api/products/route.ts`)
   - `parseProductQueryParams()` 解析 `includeBatchSpecs` 查询参数
   - 传递给服务端数据获取函数

5. **前端Hook优化** (`lib/api/inbound.ts`)
   - `useProductSearch()` 添加 `includeBatchSpecs=true` 参数
   - 移除 N+1 的请求瀑布代码（保存约150行）
   - 直接使用后端返回的批次数据

### 技术细节

**批量查询策略**：

```typescript
// 1. 批量获取库存记录（包含批次号）
prisma.inventory.findMany({ where: { productId: { in: productIds } } });

// 2. 批量获取批次规格
prisma.batchSpecification.findMany({
  where: { batchNumber: { in: batchNumbers } },
});

// 3. 在内存中组装数据
// 避免数据库多次往返
```

**缓存策略**：

- Redis 缓存包含批次数据
- 缓存键包含 `includeBatchSpecs` 参数
- 5分钟TTL + 随机偏移防止雪崩

### 测试验证

需要验证以下场景：

- [ ] 产品入库搜索响应时间 < 1秒
- [ ] 批次数据正确性（批次号、每件片数、数量）
- [ ] 缓存命中率
- [ ] 不同产品数量的性能（5个、10个、20个）
