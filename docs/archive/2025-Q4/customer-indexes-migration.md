# 客户管理模块数据库索引优化

## 📋 优化目标

为客户管理模块添加必要的数据库索引，进一步提升查询性能。

## 🎯 需要添加的索引

### 1. Customer 表索引

```prisma
model Customer {
  id               String   @id @default(uuid()) @db.Char(36)
  name             String   @db.VarChar(150)
  role             String   @default("customer") @db.VarChar(32)
  phone            String?
  address          String?
  extendedInfo     String?  @db.Text
  parentCustomerId String?  @map("parent_customer_id") @db.Char(36)
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  // ... 关系定义 ...

  // ✅ 新增索引
  @@index([phone])                    // 支持按手机号搜索
  @@index([name])                     // 支持按名称搜索
  @@index([createdAt])                // 支持按创建时间排序
  @@index([parentCustomerId])         // 支持查询子客户
  @@index([name, createdAt])          // 复合索引：名称搜索 + 时间排序
  @@index([phone, createdAt])         // 复合索引：手机号搜索 + 时间排序

  @@map("customers")
}
```

### 2. SalesOrder 表索引（已有部分，需补充）

```prisma
model SalesOrder {
  id           String   @id @default(uuid()) @db.Char(36)
  orderNumber  String   @unique @map("order_number") @db.VarChar(100)
  customerId   String   @map("customer_id") @db.Char(36)
  status       String   @default("draft") @db.VarChar(32)
  totalAmount  Float    @default(0) @map("total_amount")
  createdAt    DateTime @default(now()) @map("created_at")

  // ... 其他字段和关系 ...

  // ✅ 新增索引（用于客户列表统计查询）
  @@index([customerId, status])       // 支持按客户ID和状态统计
  @@index([customerId, createdAt])    // 支持按客户ID查询首次/最后下单时间
  @@index([customerId, status, createdAt]) // 复合索引：客户统计 + 时间排序

  // 已有索引（保持不变）
  @@index([customerId], map: "idx_sales_orders_customer")
  @@index([status], map: "idx_sales_orders_status")
  @@index([createdAt], map: "idx_sales_orders_created_at")

  @@map("sales_orders")
}
```

### 3. ReturnOrder 表索引（已有部分，需补充）

```prisma
model ReturnOrder {
  id           String   @id @default(uuid()) @db.Char(36)
  returnNumber String   @unique @map("return_number")
  customerId   String   @map("customer_id") @db.Char(36)
  status       String   @default("draft") @db.VarChar(32)
  createdAt    DateTime @default(now()) @map("created_at")

  // ... 其他字段和关系 ...

  // ✅ 新增索引（用于客户列表统计查询）
  @@index([customerId, status])       // 支持按客户ID和状态统计退货

  // 已有索引（保持不变）
  @@index([customerId], map: "idx_return_orders_customer")
  @@index([status], map: "idx_return_orders_status")

  @@map("return_orders")
}
```

## 📊 索引效果分析

### 查询性能提升预期

| 查询类型               | 无索引   | 有索引   | 提升倍数      |
| ---------------------- | -------- | -------- | ------------- |
| 按手机号搜索客户       | 全表扫描 | 索引查找 | **100-1000x** |
| 按名称搜索客户         | 全表扫描 | 索引查找 | **100-1000x** |
| 按创建时间排序         | 文件排序 | 索引排序 | **10-50x**    |
| 统计客户订单（按状态） | 全表扫描 | 索引查找 | **50-500x**   |
| 查询首次/最后下单时间  | 全表扫描 | 索引查找 | **50-500x**   |

### 存储空间影响

- 每个索引约占表大小的 10-20%
- 6 个新索引预计增加存储空间：~5-10 MB（10,000 客户）
- 对于性能提升，存储成本完全可接受

### 写入性能影响

- 插入/更新操作需要维护索引
- 预计写入性能下降：~5-10%
- 客户管理模块以读为主，写入频率低，影响可忽略

## 🚀 执行步骤

### 方法 1: 使用 Prisma Migrate（推荐）

```bash
# 1. 修改 prisma/schema.prisma 文件，添加上述索引

# 2. 创建 migration
npx prisma migrate dev --name add_customer_indexes

# 3. 应用 migration
npx prisma migrate deploy

# 4. 验证索引
npx prisma db execute --stdin < verify-indexes.sql
```

### 方法 2: 手动执行 SQL（生产环境）

```sql
-- Customer 表索引
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_created_at ON customers(created_at);
CREATE INDEX idx_customers_parent ON customers(parent_customer_id);
CREATE INDEX idx_customers_name_created ON customers(name, created_at);
CREATE INDEX idx_customers_phone_created ON customers(phone, created_at);

-- SalesOrder 表索引
CREATE INDEX idx_sales_orders_customer_status ON sales_orders(customer_id, status);
CREATE INDEX idx_sales_orders_customer_created ON sales_orders(customer_id, created_at);
CREATE INDEX idx_sales_orders_customer_status_created ON sales_orders(customer_id, status, created_at);

-- ReturnOrder 表索引
CREATE INDEX idx_return_orders_customer_status ON return_orders(customer_id, status);
```

### 验证索引是否生效

```sql
-- MySQL
SHOW INDEX FROM customers;
SHOW INDEX FROM sales_orders;
SHOW INDEX FROM return_orders;

-- 查看查询执行计划
EXPLAIN SELECT * FROM customers WHERE phone = '13800138000';
EXPLAIN SELECT * FROM customers WHERE name LIKE '%测试%';
EXPLAIN SELECT * FROM sales_orders WHERE customer_id = 'xxx' AND status = 'confirmed';
```

## ⚠️ 注意事项

### 1. 生产环境执行建议

```bash
# 在低峰期执行（凌晨 2-4 点）
# 大表添加索引可能需要 10-30 分钟
# 期间表会被锁定，影响写入操作

# 使用 ONLINE DDL（MySQL 5.6+）
ALTER TABLE customers ADD INDEX idx_customers_phone (phone), ALGORITHM=INPLACE, LOCK=NONE;
```

### 2. 索引维护

```sql
-- 定期分析表，更新索引统计信息
ANALYZE TABLE customers;
ANALYZE TABLE sales_orders;
ANALYZE TABLE return_orders;

-- 检查索引碎片
SELECT
  table_name,
  index_name,
  stat_value * @@innodb_page_size / 1024 / 1024 AS size_mb
FROM mysql.innodb_index_stats
WHERE database_name = 'your_database'
  AND table_name IN ('customers', 'sales_orders', 'return_orders')
ORDER BY size_mb DESC;
```

### 3. 监控索引使用情况

```sql
-- 查看索引使用统计（MySQL 5.7+）
SELECT
  object_schema,
  object_name,
  index_name,
  count_star,
  count_read,
  count_write
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE object_schema = 'your_database'
  AND object_name IN ('customers', 'sales_orders', 'return_orders')
ORDER BY count_star DESC;
```

## 📈 预期效果

### 优化前（无索引）

```
查询 100 个客户（每个客户平均 100 个订单）:
- 客户查询: 50ms
- 订单统计查询: 1500ms (全表扫描)
- 退货统计查询: 500ms (全表扫描)
- 总耗时: ~2050ms
```

### 优化后（有索引 + 聚合查询）

```
查询 100 个客户（每个客户平均 100 个订单）:
- 客户查询: 20ms (索引查找)
- 订单统计查询: 50ms (索引 + groupBy)
- 退货统计查询: 30ms (索引 + groupBy)
- 总耗时: ~100ms
```

**性能提升**: **20 倍**（2050ms → 100ms）

## 🔗 相关资源

- [MySQL 索引优化官方文档](https://dev.mysql.com/doc/refman/8.0/en/optimization-indexes.html)
- [Prisma 索引文档](https://www.prisma.io/docs/concepts/components/prisma-schema/indexes)
- [数据库性能优化最佳实践](../best-practices/database-performance.md)

## ✅ 检查清单

执行前确认：

- [ ] 已在开发环境测试索引效果
- [ ] 已评估生产环境数据量和执行时间
- [ ] 已选择低峰期执行时间窗口
- [ ] 已备份数据库
- [ ] 已准备回滚方案
- [ ] 已通知相关团队成员

执行后验证：

- [ ] 索引创建成功（SHOW INDEX）
- [ ] 查询性能提升（EXPLAIN）
- [ ] 应用功能正常
- [ ] 无错误日志
- [ ] 监控指标正常
