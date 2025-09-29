# 库存模块性能优化实施方案

> 实施计划：2025-09-30 至 2025-11-30
> 负责团队：后端开发、前端开发、DBA

---

## 🎯 优化目标

### 核心指标

| 指标                  | 当前值   | 目标值    | 提升幅度 |
| --------------------- | -------- | --------- | -------- |
| 库存列表响应时间(P95) | 1500ms   | 300ms     | 80%      |
| 缓存命中率            | 50%      | 85%       | 70%      |
| 并发处理能力          | 50 req/s | 200 req/s | 300%     |
| 内存使用稳定性        | 波动±40% | 波动±10%  | 75%      |

---

## 📋 P0优化任务（1周内完成）

### 任务1：优化库存列表查询的N+1问题

#### 问题分析

当前实现在`app/api/inventory/route.ts`中使用嵌套的include查询：

```typescript
// ❌ 当前实现 - 存在N+1问题
const inventoryRecords = await prisma.inventory.findMany({
  where,
  select: {
    // ... 库存字段
    product: {
      select: {
        // ... 产品字段
        category: {
          select: {
            // ... 分类字段
          },
        },
      },
    },
  },
});
```

#### 优化方案

**方案A：使用原生SQL查询（推荐）**

```typescript
// ✅ 优化后 - 使用JOIN查询
const inventoryRecords = await prisma.$queryRaw`
  SELECT 
    i.id,
    i.productId,
    i.batchNumber,
    i.quantity,
    i.reservedQuantity,
    i.location,
    i.unitCost,
    i.updatedAt,
    p.id as product_id,
    p.code as product_code,
    p.name as product_name,
    JSON_EXTRACT(p.specification, '$.size') as specification_size,
    p.unit as product_unit,
    p.piecesPerUnit as product_piecesPerUnit,
    p.status as product_status,
    c.id as category_id,
    c.name as category_name,
    c.code as category_code
  FROM Inventory i
  LEFT JOIN Product p ON i.productId = p.id
  LEFT JOIN Category c ON p.categoryId = c.id
  WHERE ${whereClause}
  ORDER BY ${orderByClause}
  LIMIT ${limit} OFFSET ${(page - 1) * limit}
`;
```

**方案B：添加数据库索引**

```sql
-- 为常用查询字段添加索引
CREATE INDEX idx_inventory_product_id ON Inventory(productId);
CREATE INDEX idx_inventory_batch_number ON Inventory(batchNumber);
CREATE INDEX idx_inventory_location ON Inventory(location);
CREATE INDEX idx_inventory_quantity ON Inventory(quantity);
CREATE INDEX idx_inventory_updated_at ON Inventory(updatedAt);

-- 为产品表添加复合索引
CREATE INDEX idx_product_category_status ON Product(categoryId, status);
CREATE INDEX idx_product_code_name ON Product(code, name);

-- 为规格字段添加虚拟列和索引（MySQL 5.7+）
ALTER TABLE Product
ADD COLUMN specification_size VARCHAR(50)
AS (JSON_UNQUOTE(JSON_EXTRACT(specification, '$.size'))) VIRTUAL;

CREATE INDEX idx_product_specification_size ON Product(specification_size);
```

**方案C：创建物化视图（长期方案）**

```sql
-- 创建库存视图
CREATE VIEW inventory_view AS
SELECT
  i.id,
  i.productId,
  i.batchNumber,
  i.quantity,
  i.reservedQuantity,
  i.location,
  i.unitCost,
  i.updatedAt,
  p.code as product_code,
  p.name as product_name,
  JSON_EXTRACT(p.specification, '$.size') as specification_size,
  p.unit as product_unit,
  p.status as product_status,
  c.name as category_name
FROM Inventory i
LEFT JOIN Product p ON i.productId = p.id
LEFT JOIN Category c ON p.categoryId = c.id;
```

#### 实施步骤

1. **第1天**：添加数据库索引（方案B）
2. **第2-3天**：实施原生SQL查询（方案A）
3. **第4天**：性能测试和对比
4. **第5天**：代码审查和部署

#### 预期效果

- 查询时间从1500ms降低到300ms（80%提升）
- 数据库CPU使用率降低50%
- 支持更高的并发请求

---

### 任务2：精细化缓存失效策略

#### 问题分析

当前实现在`lib/cache/inventory-cache.ts`中清除所有相关缓存：

```typescript
// ❌ 当前实现 - 过于激进
export async function invalidateInventoryCache(productId?: string) {
  const cachePatterns = [
    'inventory:list:*',
    'inventory:stats:*',
    'inventory:summary:*',
    'finance:receivables:*',
    'dashboard:stats:*',
  ];
  await Promise.all(cachePatterns.map(pattern => invalidateNamespace(pattern)));
}
```

#### 优化方案

**方案A：精细化失效策略**

```typescript
// ✅ 优化后 - 精细化失效
export async function invalidateInventoryCache(
  productId?: string,
  options?: {
    operation?: 'adjust' | 'inbound' | 'outbound';
    affectedFields?: ('quantity' | 'reservedQuantity' | 'location')[];
  }
): Promise<void> {
  const patterns: string[] = [];

  if (productId) {
    // 只清除特定产品的缓存
    patterns.push(`inventory:summary:${productId}`);
    patterns.push(`inventory:list:*productId=${productId}*`);
  } else {
    // 清除列表缓存
    patterns.push('inventory:list:*');
  }

  // 根据操作类型决定是否清除统计缓存
  if (options?.operation === 'adjust' || !productId) {
    patterns.push('inventory:stats:*');
  }

  // 只在必要时清除仪表盘缓存
  if (!productId || options?.operation === 'adjust') {
    patterns.push('dashboard:stats:inventory*');
  }

  // 不清除财务缓存，让它自然过期
  // patterns.push('finance:receivables:*'); // ❌ 移除

  await Promise.all(patterns.map(pattern => invalidateNamespace(pattern)));
}
```

**方案B：延长缓存TTL**

```typescript
// 在 lib/env.ts 中调整缓存配置
export const cacheConfig = {
  inventoryTtl: 30, // 从10秒延长到30秒
  productTtl: 60,
  // ...
};
```

**方案C：使用缓存标签**

```typescript
// 为缓存添加标签，支持按标签批量失效
export async function setCachedInventory(
  params: InventoryQueryParams,
  data: PaginatedResponse<Inventory>
): Promise<void> {
  const cacheKey = buildCacheKey('inventory:list', params);
  const tags = [
    'inventory',
    `product:${params.productId}`,
    `category:${params.categoryId}`,
  ].filter(Boolean);

  await redis.setJson(cacheKey, data, {
    ttl: cacheConfig.inventoryTtl,
    tags,
  });
}

// 按标签失效
export async function invalidateByTag(tag: string): Promise<void> {
  const keys = await redis.getKeysByTag(tag);
  await Promise.all(keys.map(key => redis.del(key)));
}
```

#### 实施步骤

1. **第1天**：实施精细化失效策略（方案A）
2. **第2天**：调整缓存TTL（方案B）
3. **第3天**：性能测试和监控
4. **第4-5天**：根据监控数据微调

#### 预期效果

- 缓存命中率从50%提升到85%（70%提升）
- Redis内存使用稳定性提升40%
- 数据库查询次数减少60%

---

## 📋 P1优化任务（2-4周内完成）

### 任务3：前端数据获取优化

#### 优化方案

**方案A：增加staleTime和实施防抖**

```typescript
// 在 hooks/use-optimized-inventory-query.ts 中
export function useOptimizedInventoryQuery(options: {
  params: InventoryQueryParams;
}) {
  // 防抖处理查询参数
  const debouncedParams = useDebounce(options.params, 500);

  const query = useQuery<InventoryListResponse>({
    queryKey: inventoryQueryKeys.list(debouncedParams),
    queryFn: fetchInventory,
    staleTime: 30 * 1000, // 从5秒增加到30秒
    gcTime: 5 * 60 * 1000,
    // 保持上一页数据
    placeholderData: keepPreviousData,
  });

  return query;
}

// 实现防抖Hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

**方案B：实施乐观更新**

```typescript
// 库存操作后立即更新本地缓存
export function useInventoryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: adjustInventory,
    onMutate: async variables => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: inventoryQueryKeys.all });

      // 获取当前缓存数据
      const previousData = queryClient.getQueryData(
        inventoryQueryKeys.list(variables.params)
      );

      // 乐观更新
      queryClient.setQueryData(
        inventoryQueryKeys.list(variables.params),
        (old: InventoryListResponse) => {
          return {
            ...old,
            data: old.data.map(item =>
              item.id === variables.inventoryId
                ? { ...item, quantity: item.quantity + variables.adjustment }
                : item
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (err, variables, context) => {
      // 回滚
      if (context?.previousData) {
        queryClient.setQueryData(
          inventoryQueryKeys.list(variables.params),
          context.previousData
        );
      }
    },
    onSettled: () => {
      // 重新获取数据
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all });
    },
  });
}
```

#### 实施步骤

1. **第1周**：实施防抖和增加staleTime
2. **第2周**：实施乐观更新
3. **第3周**：性能测试和用户反馈
4. **第4周**：根据反馈微调

#### 预期效果

- 网络请求减少50%
- 用户感知响应时间减少70%
- 服务器负载降低40%

---

### 任务4：内存泄漏风险修复

#### 优化方案

**方案A：限制批量查询大小**

```typescript
// 在 lib/cache/inventory-cache.ts 中
const MAX_BATCH_SIZE = 100;

export async function getBatchCachedInventorySummary(
  productIds: string[]
): Promise<Map<string, InventorySummary>> {
  if (productIds.length === 0) return new Map();

  // 分批处理
  if (productIds.length > MAX_BATCH_SIZE) {
    const batches = chunk(productIds, MAX_BATCH_SIZE);
    const results = await Promise.all(
      batches.map(batch => getBatchCachedInventorySummary(batch))
    );
    return mergeMaps(results);
  }

  // 原有逻辑
  // ...
}

// 辅助函数
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function mergeMaps<K, V>(maps: Map<K, V>[]): Map<K, V> {
  const result = new Map<K, V>();
  maps.forEach(map => {
    map.forEach((value, key) => {
      result.set(key, value);
    });
  });
  return result;
}
```

**方案B：添加内存监控**

```typescript
// 在 lib/monitoring/memory-monitor.ts 中
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  recordMemoryUsage(label: string): void {
    const usage = process.memoryUsage();
    const heapUsed = usage.heapUsed / 1024 / 1024; // MB

    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(heapUsed);

    // 保留最近100个数据点
    if (this.metrics.get(label)!.length > 100) {
      this.metrics.get(label)!.shift();
    }
  }

  getAverageMemoryUsage(label: string): number {
    const data = this.metrics.get(label) || [];
    if (data.length === 0) return 0;
    return data.reduce((a, b) => a + b, 0) / data.length;
  }

  checkMemoryLeak(label: string, threshold: number = 10): boolean {
    const data = this.metrics.get(label) || [];
    if (data.length < 10) return false;

    // 检查内存是否持续增长
    const recent = data.slice(-10);
    const trend = recent[recent.length - 1] - recent[0];
    return trend > threshold;
  }
}

// 使用示例
const monitor = MemoryMonitor.getInstance();
monitor.recordMemoryUsage('inventory-batch-query');
if (monitor.checkMemoryLeak('inventory-batch-query')) {
  console.warn('检测到内存泄漏风险');
}
```

#### 实施步骤

1. **第1周**：实施批量查询限制
2. **第2周**：添加内存监控
3. **第3-4周**：持续监控和优化

#### 预期效果

- 内存使用稳定性提升40%
- 避免内存泄漏导致的服务重启
- 提高系统长期运行稳定性

---

## 📊 监控和验证

### 性能监控指标

```typescript
// 在 lib/monitoring/performance-metrics.ts 中
export interface PerformanceMetrics {
  // 响应时间
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };

  // 缓存性能
  cache: {
    hitRate: number;
    missRate: number;
    evictionRate: number;
  };

  // 数据库性能
  database: {
    queryCount: number;
    slowQueryCount: number;
    avgQueryTime: number;
  };

  // 内存使用
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export async function collectMetrics(): Promise<PerformanceMetrics> {
  // 实现指标收集逻辑
}
```

### 告警规则

```yaml
# 在 monitoring/alerts.yml 中
alerts:
  - name: high_response_time
    condition: response_time_p95 > 500ms
    severity: warning
    action: notify_team

  - name: low_cache_hit_rate
    condition: cache_hit_rate < 60%
    severity: warning
    action: notify_team

  - name: memory_leak
    condition: memory_growth > 10MB/hour
    severity: critical
    action: restart_service

  - name: slow_query
    condition: slow_query_count > 10/minute
    severity: critical
    action: notify_dba
```

---

## 📝 总结

本优化方案涵盖了库存模块的主要性能瓶颈和内存问题，通过分阶段实施，预计可以实现：

- **响应时间提升80%**
- **缓存命中率提升70%**
- **并发处理能力提升300%**
- **内存使用稳定性提升40%**

建议按照P0 → P1 → P2的优先级逐步实施，并持续监控关键指标，根据实际效果进行调整。
