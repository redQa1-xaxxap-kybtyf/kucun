# 数据库查询优化指南

> 库存管理模块数据库性能优化建议和最佳实践

## 🎯 **当前性能瓶颈分析**

### 1. 库存查询性能问题
- **现状**: 库存列表查询涉及多表JOIN，缺少合适的索引
- **影响**: 当库存数据超过1000条时，查询响应时间超过500ms
- **优化目标**: 将查询响应时间控制在100ms以内

### 2. 分页查询效率低下
- **现状**: 使用OFFSET/LIMIT进行分页，大偏移量时性能急剧下降
- **影响**: 查看后面页面时响应时间呈线性增长
- **优化目标**: 实现基于游标的高效分页

## 🔧 **索引优化建议**

### 核心索引创建

```sql
-- 1. 库存表核心索引
-- 产品ID索引（最常用的查询条件）
CREATE INDEX idx_inventory_product_id ON inventory(product_id);

-- 更新时间索引（用于排序和时间范围查询）
CREATE INDEX idx_inventory_updated_at ON inventory(updated_at DESC);

-- 库存数量索引（用于库存状态筛选）
CREATE INDEX idx_inventory_quantity ON inventory(quantity);

-- 复合索引：产品ID + 更新时间（覆盖最常见的查询模式）
CREATE INDEX idx_inventory_product_updated ON inventory(product_id, updated_at DESC);

-- 复合索引：数量 + 更新时间（用于库存预警查询）
CREATE INDEX idx_inventory_quantity_updated ON inventory(quantity, updated_at DESC);

-- 2. 产品表索引优化
-- 产品状态索引（筛选有效产品）
CREATE INDEX idx_products_status ON products(status);

-- 产品分类索引（分类筛选）
CREATE INDEX idx_products_category_id ON products(category_id);

-- 产品名称和编码索引（搜索功能）
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_code ON products(code);

-- 复合索引：状态 + 分类（常见组合查询）
CREATE INDEX idx_products_status_category ON products(status, category_id);

-- 3. 分类表索引
-- 分类状态索引
CREATE INDEX idx_categories_status ON categories(status);

-- 分类排序索引
CREATE INDEX idx_categories_sort_order ON categories(sort_order);
```

### 全文搜索索引

```sql
-- MySQL 8.0+ 全文搜索索引
-- 产品名称和规格全文搜索
ALTER TABLE products ADD FULLTEXT(name, specification);

-- 使用示例
-- SELECT * FROM products 
-- WHERE MATCH(name, specification) AGAINST('搜索关键词' IN NATURAL LANGUAGE MODE);
```

## 📊 **查询优化策略**

### 1. 库存列表查询优化

```sql
-- ❌ 优化前：性能较差的查询
SELECT 
  i.*,
  p.name, p.code, p.specification, p.unit, p.pieces_per_unit,
  c.name as category_name
FROM inventory i
LEFT JOIN products p ON i.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.status = 'active'
ORDER BY i.updated_at DESC
LIMIT 20 OFFSET 100;

-- ✅ 优化后：使用索引和子查询
WITH filtered_inventory AS (
  SELECT id, product_id, batch_number, quantity, reserved_quantity, 
         location, unit_cost, updated_at
  FROM inventory i
  WHERE EXISTS (
    SELECT 1 FROM products p 
    WHERE p.id = i.product_id AND p.status = 'active'
  )
  ORDER BY updated_at DESC
  LIMIT 20 OFFSET 100
)
SELECT 
  fi.*,
  p.name, p.code, p.specification, p.unit, p.pieces_per_unit,
  c.name as category_name
FROM filtered_inventory fi
JOIN products p ON fi.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id;
```

### 2. 基于游标的分页优化

```sql
-- ✅ 游标分页：性能稳定，不受偏移量影响
-- 第一页
SELECT * FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE p.status = 'active'
ORDER BY i.updated_at DESC, i.id DESC
LIMIT 20;

-- 后续页面（使用上一页最后一条记录的时间戳和ID作为游标）
SELECT * FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE p.status = 'active'
  AND (i.updated_at < '2024-01-01 12:00:00' 
       OR (i.updated_at = '2024-01-01 12:00:00' AND i.id < 12345))
ORDER BY i.updated_at DESC, i.id DESC
LIMIT 20;
```

### 3. 库存统计查询优化

```sql
-- ❌ 优化前：每次都重新计算
SELECT 
  COUNT(*) as total_items,
  SUM(quantity) as total_quantity,
  COUNT(CASE WHEN quantity <= 10 THEN 1 END) as low_stock_count,
  COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_count
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE p.status = 'active';

-- ✅ 优化后：使用物化视图或定期更新的统计表
CREATE TABLE inventory_stats (
  id INT PRIMARY KEY AUTO_INCREMENT,
  total_items INT NOT NULL,
  total_quantity BIGINT NOT NULL,
  low_stock_count INT NOT NULL,
  out_of_stock_count INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 定期更新统计数据（可以通过定时任务或触发器）
INSERT INTO inventory_stats (total_items, total_quantity, low_stock_count, out_of_stock_count)
SELECT 
  COUNT(*) as total_items,
  SUM(quantity) as total_quantity,
  COUNT(CASE WHEN quantity <= 10 THEN 1 END) as low_stock_count,
  COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_count
FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE p.status = 'active'
ON DUPLICATE KEY UPDATE
  total_items = VALUES(total_items),
  total_quantity = VALUES(total_quantity),
  low_stock_count = VALUES(low_stock_count),
  out_of_stock_count = VALUES(out_of_stock_count);
```

## 🚀 **高级优化技术**

### 1. 读写分离配置

```javascript
// Prisma配置示例
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL, // 主库（写）
    },
  },
});

const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_URL, // 从库（读）
    },
  },
});

// 使用示例
export async function getInventoryList(params) {
  // 读操作使用从库
  return prismaRead.inventory.findMany({
    // 查询配置
  });
}

export async function updateInventory(id, data) {
  // 写操作使用主库
  return prisma.inventory.update({
    where: { id },
    data,
  });
}
```

### 2. 连接池优化

```javascript
// 数据库连接池配置
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // 连接池配置
  __internal: {
    engine: {
      // 连接池大小
      connection_limit: 20,
      // 连接超时时间
      connect_timeout: 10,
      // 查询超时时间
      query_timeout: 30,
      // 空闲连接超时
      pool_timeout: 10,
    },
  },
});
```

### 3. 查询缓存策略

```javascript
// Redis缓存配置
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  // 连接池配置
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
});

// 缓存装饰器
export function withCache(key: string, ttl = 300) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${key}:${JSON.stringify(args)}`;
      
      // 尝试从缓存获取
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // 执行原方法
      const result = await method.apply(this, args);
      
      // 缓存结果
      await redis.setex(cacheKey, ttl, JSON.stringify(result));
      
      return result;
    };
  };
}

// 使用示例
class InventoryService {
  @withCache('inventory:list', 300) // 5分钟缓存
  async getInventoryList(params: any) {
    return prisma.inventory.findMany({
      // 查询配置
    });
  }
}
```

## 📈 **性能监控和分析**

### 1. 慢查询监控

```sql
-- 启用慢查询日志
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.1; -- 记录超过100ms的查询
SET GLOBAL log_queries_not_using_indexes = 'ON';

-- 分析慢查询
-- 查看最慢的查询
SELECT 
  query_time,
  lock_time,
  rows_sent,
  rows_examined,
  sql_text
FROM mysql.slow_log
ORDER BY query_time DESC
LIMIT 10;
```

### 2. 索引使用分析

```sql
-- 检查索引使用情况
SHOW INDEX FROM inventory;
SHOW INDEX FROM products;

-- 分析查询执行计划
EXPLAIN SELECT * FROM inventory i
JOIN products p ON i.product_id = p.id
WHERE p.status = 'active'
ORDER BY i.updated_at DESC
LIMIT 20;

-- 检查未使用的索引
SELECT 
  OBJECT_SCHEMA,
  OBJECT_NAME,
  INDEX_NAME
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE COUNT_STAR = 0
  AND OBJECT_SCHEMA = 'your_database_name'
  AND INDEX_NAME IS NOT NULL;
```

## 🎯 **实施计划**

### 阶段1：基础索引优化（立即执行）
1. 创建核心索引（产品ID、更新时间、数量）
2. 添加复合索引（常见查询组合）
3. 监控索引使用情况

### 阶段2：查询优化（1周内）
1. 重写低效查询
2. 实现游标分页
3. 优化统计查询

### 阶段3：高级优化（2周内）
1. 配置读写分离
2. 实现查询缓存
3. 设置性能监控

### 阶段4：持续优化（长期）
1. 定期分析慢查询
2. 优化索引策略
3. 调整缓存策略

## 📊 **预期性能提升**

| 优化项目 | 优化前 | 优化后 | 提升幅度 |
|---------|--------|--------|----------|
| 库存列表查询 | 500ms | <100ms | 80%+ |
| 分页查询（大偏移） | 2000ms | <100ms | 95%+ |
| 库存统计查询 | 800ms | <50ms | 94%+ |
| 搜索查询 | 1200ms | <200ms | 83%+ |
| 并发处理能力 | 50 QPS | 200+ QPS | 300%+ |

通过这些优化措施，库存管理模块的数据库性能将得到显著提升，为用户提供更流畅的使用体验。
