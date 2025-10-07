# 缓存决策指南 - 库存管理系统

## 目录

1. [什么时候应该缓存？](#什么时候应该缓存)
2. [什么时候不应该缓存？](#什么时候不应该缓存)
3. [缓存 TTL 建议](#缓存-ttl-建议)
4. [失效策略](#失效策略)
5. [常见场景](#常见场景)
6. [最佳实践](#最佳实践)
7. [避免的陷阱](#避免的陷阱)

---

## 什么时候应该缓存？

### ✅ 应该缓存的场景

| 场景           | 理由                   | 推荐 TTL   |
| -------------- | ---------------------- | ---------- |
| **产品详情**   | 变化频率低，读取频率高 | 30-60 分钟 |
| **分类列表**   | 基本不变，频繁查询     | 1-24 小时  |
| **配置数据**   | 很少变化，全局使用     | 1-24 小时  |
| **统计汇总**   | 计算成本高，可容忍延迟 | 1-10 分钟  |
| **供应商列表** | 变化不频繁             | 5-30 分钟  |
| **客户详情**   | 读多写少               | 10-30 分钟 |

### 判断标准

使用以下公式评估是否应该缓存：

```
缓存收益 = (读取频率 × 查询成本) - (失效成本 + 数据不一致风险)
```

- **读取频率高** (每秒/分钟多次) ✅
- **查询成本高** (复杂 JOIN、聚合计算) ✅
- **变化频率低** (每小时/天变化几次) ✅
- **可容忍短暂延迟** (1-60 秒) ✅

---

## 什么时候不应该缓存？

### ❌ 不应该缓存的场景

| 场景               | 理由                               | 替代方案                      |
| ------------------ | ---------------------------------- | ----------------------------- |
| **库存列表**       | 实时性要求高，用户期望立即看到变化 | 数据库查询优化（索引、分页）  |
| **订单列表**       | 用户创建后期望立即看到             | 直接查询，使用 WebSocket 推送 |
| **财务金额**       | 涉及金钱，必须准确                 | 直接查询，事务保证一致性      |
| **库存数量**       | 高频变更，缓存会导致超卖           | 实时查询或极短 TTL (5-10秒)   |
| **用户个性化数据** | 每个用户数据不同，缓存命中率低     | 按需查询，会话缓存            |
| **一次性操作结果** | 不会重复查询                       | 不缓存                        |

### 判断标准

以下任一条件满足，则**不应该缓存**：

- ❌ **实时性要求高**：用户期望立即看到变化（如订单状态）
- ❌ **涉及金额交易**：数据不一致会导致财务损失
- ❌ **高度个性化**：每个用户数据不同，缓存命中率 < 30%
- ❌ **数据高频变更**：每秒/分钟变化多次
- ❌ **查询成本低**：简单查询 (< 10ms)，缓存收益不明显

---

## 缓存 TTL 建议

### TTL 设置原则

```
TTL = min(数据稳定时间, 可容忍延迟时间) × 0.8
```

### 推荐 TTL

| 数据类型     | TTL              | 说明                           |
| ------------ | ---------------- | ------------------------------ |
| **配置数据** | 1 小时 - 1 天    | 系统配置、字典数据             |
| **产品详情** | 10 - 30 分钟     | 产品基本信息（名称、规格）     |
| **库存汇总** | 30 秒 - 2 分钟   | 产品总库存、可用库存           |
| **统计数据** | 1 - 10 分钟      | 仪表盘统计、销售汇总           |
| **列表数据** | 5 - 30 秒        | 如果必须缓存列表，使用极短 TTL |
| **搜索结果** | 1 - 5 分钟       | 搜索结果可以短暂缓存           |
| **用户会话** | 30 分钟 - 2 小时 | 用户登录信息                   |

### 特殊场景

#### 1. 防止缓存雪崩

使用随机 TTL，避免大量缓存同时失效：

```typescript
import { getRandomTTL } from '@/lib/cache';

// 基础 TTL 60 秒，随机 ±20% (48-72 秒)
const ttl = getRandomTTL(60, 20);
```

#### 2. 防止缓存击穿

对热点数据使用分布式锁：

```typescript
import { getOrSetWithLock } from '@/lib/cache';

const data = await getOrSetWithLock(
  cacheKey,
  () => fetchFromDatabase(),
  60 // TTL
);
```

#### 3. 防止缓存穿透

启用空值缓存：

```typescript
import { getOrSetJSON } from '@/lib/cache';

const data = await getOrSetJSON(
  cacheKey,
  () => fetchFromDatabase(),
  60,
  { enableNullCache: true } // 缓存 null 值，防止穿透
);
```

---

## 失效策略

### 1. 精准失效

**原则**：只失效直接相关的缓存，不失效无关缓存

```typescript
// ❌ 错误示例：过度失效
async function invalidateInventoryCache() {
  await invalidateNamespace('inventory:*'); // 失效所有库存缓存
  await invalidateNamespace('finance:*'); // 失效所有财务缓存 ❌
  await invalidateNamespace('dashboard:*'); // 失效所有仪表盘缓存 ❌
}

// ✅ 正确示例：精准失效
async function invalidateInventoryCache(productId: string) {
  // 只失效特定产品的库存汇总
  await invalidateNamespace(`inventory:summary:${productId}`);
}
```

### 2. 分级失效

**原则**：立即失效关键缓存，延迟失效次要缓存

```typescript
import {
  executeInvalidation,
  INVENTORY_CHANGE_INVALIDATION,
} from '@/lib/cache/invalidation-strategy';

// 使用分级失效策略
await executeInvalidation(INVENTORY_CHANGE_INVALIDATION, {
  productId: 'product-123',
});
```

失效策略说明：

- **立即失效** (immediate)：直接相关的缓存，同步失效（阻塞主流程）
  - 示例：库存汇总、产品详情
- **延迟失效** (deferred)：间接相关的缓存，异步失效（不阻塞）
  - 示例：仪表盘统计、预警列表
- **可选失效** (optional)：可能相关的缓存，仅在必要时失效
  - 示例：仪表盘概览

### 3. 级联失效

系统已实现智能级联失效（`revalidate.ts`），自动处理相关缓存：

```typescript
import { revalidateInventory } from '@/lib/cache';

// 失效库存缓存，自动级联失效仪表盘预警
await revalidateInventory(productId);

// 自动级联规则（在 revalidate.ts 中定义）：
// 库存变更 → 仪表盘预警（立即） + 仪表盘统计（延迟）
```

### 4. 避免缓存雪崩

**问题**：大量缓存同时失效 → 请求全部打到数据库 → 数据库压力激增

**解决方案**：

1. **使用随机 TTL**：

```typescript
const ttl = getRandomTTL(60, 20); // 48-72 秒随机 TTL
```

2. **分级失效**：不要一次性失效所有缓存

```typescript
// ❌ 错误：一次性失效所有缓存
await Promise.all([
  invalidateNamespace('inventory:*'),
  invalidateNamespace('products:*'),
  invalidateNamespace('finance:*'),
  invalidateNamespace('dashboard:*'),
]);

// ✅ 正确：分级失效
await executeInvalidation(strategy, { productId });
```

3. **异步预热**：失效后异步重建缓存

```typescript
import { warmupCache } from '@/lib/cache/invalidation-strategy';

// 失效缓存
await invalidateNamespace(`inventory:summary:${productId}`);

// 异步预热（不阻塞主流程）
setTimeout(() => {
  warmupCache(
    `inventory:summary:${productId}`,
    () => fetchInventorySummary(productId),
    60
  );
}, 100);
```

---

## 常见场景

### 场景 1: 库存入库

```typescript
// POST /api/inventory/inbound

// 1. 创建入库记录
const record = await createInboundRecord(data);

// 2. 精准失效：只失效该产品的库存汇总
await executeInvalidation(INVENTORY_CHANGE_INVALIDATION, {
  productId: data.productId,
});

// 3. WebSocket 推送实时更新（不依赖缓存）
publishWs('inventory', { type: 'inbound', productId });
```

### 场景 2: 产品更新

```typescript
// PUT /api/products/:id

// 1. 更新产品
const product = await updateProduct(id, data);

// 2. 精准失效：只失效该产品详情
await revalidateProducts(id);
// 自动级联失效：库存汇总、仪表盘（延迟）

// 3. 不失效产品列表（列表不缓存或使用极短 TTL）
```

### 场景 3: 订单状态变更

```typescript
// PUT /api/sales-orders/:id/status

// 1. 更新订单状态
const order = await updateOrderStatus(id, newStatus);

// 2. 分级失效
await executeInvalidation(ORDER_STATUS_CHANGE_INVALIDATION, {
  orderId: id,
});

// 立即失效：订单详情、库存汇总（预留变化）
// 延迟失效：财务数据、仪表盘统计
```

### 场景 4: 财务收款

```typescript
// POST /api/finance/payments

// 1. 创建收款记录
const payment = await createPayment(data);

// 2. 失效财务相关缓存
await revalidateFinance('payments');
// 自动级联失效：应收款列表、往来账单、仪表盘（延迟）

// 3. 不失效库存缓存（财务不影响库存）
```

---

## 最佳实践

### 1. API 路由缓存模板

```typescript
// GET /api/products (列表查询)
export const GET = withAuth(async request => {
  const params = getQueryParams(request);
  const cacheKey = buildCacheKey('products:list', params);

  const data = await getOrSetJSON(
    cacheKey,
    async () => {
      return await queryDatabase(params);
    },
    10, // 极短 TTL：10 秒（列表数据变化频繁）
    {
      enableRandomTTL: true, // 防止雪崩
      enableNullCache: true, // 防止穿透
    }
  );

  return Response.json(data);
});

// GET /api/products/:id (详情查询)
export const GET = withAuth(async (request, { params }) => {
  const cacheKey = `products:detail:${params.id}`;

  const data = await getOrSetJSON(
    cacheKey,
    async () => {
      return await getProductDetail(params.id);
    },
    1800, // 30 分钟（详情数据相对稳定）
    {
      enableRandomTTL: true,
      enableNullCache: true,
    }
  );

  return Response.json(data);
});
```

### 2. 失效模板

```typescript
// POST /api/products (创建产品)
export const POST = withAuth(async request => {
  const body = await request.json();

  // 1. 创建产品
  const product = await createProduct(body);

  // 2. 精准失效
  await revalidateProducts(product.id);
  // 不手动失效列表缓存（列表缓存 TTL 很短，会自动过期）

  return Response.json(product);
});

// PUT /api/products/:id (更新产品)
export const PUT = withAuth(async (request, { params }) => {
  const body = await request.json();

  // 1. 更新产品
  const product = await updateProduct(params.id, body);

  // 2. 精准失效
  await revalidateProducts(params.id);

  return Response.json(product);
});
```

### 3. 监控缓存效果

```typescript
import {
  getInvalidationMetrics,
  resetInvalidationMetrics,
} from '@/lib/cache/invalidation-strategy';

// 定期检查失效统计
setInterval(() => {
  const metrics = getInvalidationMetrics();
  console.log('[缓存监控] 失效统计:', metrics);

  // 如果失效过于频繁，说明缓存策略可能有问题
  if (metrics.total > 1000) {
    console.warn('[缓存监控] 失效次数过多，建议检查缓存策略');
  }

  resetInvalidationMetrics();
}, 60000); // 每分钟
```

---

## 避免的陷阱

### ❌ 陷阱 1: 过度缓存列表数据

```typescript
// ❌ 错误：长期缓存列表
const products = await getOrSetJSON(
  'products:list',
  () => fetchProducts(),
  3600 // 1 小时 ❌
);

// ✅ 正确：不缓存或极短 TTL
const products = await fetchProducts(); // 直接查询

// 或使用极短 TTL
const products = await getOrSetJSON(
  'products:list',
  () => fetchProducts(),
  10 // 10 秒
);
```

**理由**：

- 列表数据变化频繁（新增、删除、更新）
- 用户期望看到最新数据
- 分页参数多样，缓存命中率低
- 缓存失效逻辑复杂，容易遗漏

### ❌ 陷阱 2: 过度失效

```typescript
// ❌ 错误：库存变更时失效所有缓存
async function invalidateInventoryCache() {
  await invalidateNamespace('inventory:*');
  await invalidateNamespace('products:*');
  await invalidateNamespace('finance:*');
  await invalidateNamespace('dashboard:*');
  await invalidateNamespace('sales-orders:*');
}

// ✅ 正确：精准失效
async function invalidateInventoryCache(productId: string) {
  await invalidateNamespace(`inventory:summary:${productId}`);
  // 其他相关缓存由级联失效自动处理
}
```

**理由**：

- 过度失效导致缓存雪崩
- 大量请求同时打到数据库
- 数据库压力激增，可能导致服务不可用

### ❌ 陷阱 3: 忘记失效缓存

```typescript
// ❌ 错误：更新数据后忘记失效缓存
async function updateProduct(id: string, data: any) {
  await prisma.product.update({ where: { id }, data });
  // 忘记失效缓存 ❌
  return product;
}

// ✅ 正确：更新后立即失效
async function updateProduct(id: string, data: any) {
  const product = await prisma.product.update({ where: { id }, data });
  await revalidateProducts(id); // 失效缓存
  return product;
}
```

### ❌ 陷阱 4: 缓存空值导致永久 404

```typescript
// ❌ 错误：缓存 null 值且 TTL 很长
const product = await getOrSetJSON(
  `products:${id}`,
  () => fetchProduct(id), // 返回 null（产品不存在）
  3600, // 1 小时 ❌
  { enableNullCache: true }
);
// 如果产品稍后被创建，1 小时内都会返回 404

// ✅ 正确：空值使用短 TTL
const product = await getOrSetJSON(
  `products:${id}`,
  () => fetchProduct(id),
  3600, // 正常数据 1 小时
  {
    enableNullCache: true,
    // 库内部会自动使用 NULL_CACHE_TTL (10秒)
  }
);
```

### ❌ 陷阱 5: 缓存个性化数据

```typescript
// ❌ 错误：缓存用户特定的数据
const userOrders = await getOrSetJSON(
  `orders:user:${userId}`, // 每个用户不同 ❌
  () => fetchUserOrders(userId),
  600
);
// 缓存命中率低，浪费 Redis 内存

// ✅ 正确：不缓存个性化数据
const userOrders = await fetchUserOrders(userId);
```

---

## 总结

### 缓存决策树

```
需要缓存这个数据吗？
│
├─ 是否高频查询？(每秒/分钟多次)
│  ├─ 否 → ❌ 不缓存
│  └─ 是 → 继续
│
├─ 查询成本高吗？(复杂 JOIN/聚合)
│  ├─ 否 → ❌ 不缓存（查询成本低，缓存收益小）
│  └─ 是 → 继续
│
├─ 实时性要求高吗？(用户期望立即看到变化)
│  ├─ 是 → ❌ 不缓存（或使用极短 TTL）
│  └─ 否 → 继续
│
├─ 涉及金额交易吗？
│  ├─ 是 → ❌ 不缓存（数据一致性优先）
│  └─ 否 → 继续
│
├─ 高度个性化吗？(每个用户不同)
│  ├─ 是 → ❌ 不缓存（命中率低）
│  └─ 否 → ✅ 可以缓存
│
└─ 设置合理的 TTL（参考上面的 TTL 建议表）
```

### 关键原则

1. **精准失效**：只失效直接相关的缓存
2. **分级失效**：立即 + 延迟 + 可选
3. **极短 TTL**：列表数据使用 5-30 秒 TTL
4. **防止雪崩**：使用随机 TTL、分级失效
5. **监控效果**：定期检查缓存命中率和失效频率

### 快速参考

| 场景     | 是否缓存 | TTL     | 失效策略        |
| -------- | -------- | ------- | --------------- |
| 产品详情 | ✅       | 30 分钟 | 精准失效 + 级联 |
| 产品列表 | ⚠️       | 10 秒   | 自动过期        |
| 库存列表 | ❌       | 不缓存  | N/A             |
| 库存汇总 | ✅       | 1 分钟  | 精准失效        |
| 订单列表 | ❌       | 不缓存  | N/A             |
| 订单详情 | ✅       | 5 分钟  | 精准失效        |
| 财务列表 | ❌       | 不缓存  | N/A             |
| 统计数据 | ✅       | 5 分钟  | 分级失效        |
| 配置数据 | ✅       | 1 小时  | 手动失效        |

---

**最后提醒**：当不确定是否应该缓存时，**选择不缓存**。过早优化是万恶之源，先确保功能正确，再优化性能。
