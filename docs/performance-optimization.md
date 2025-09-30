# 库存管理系统性能优化文档

## 📊 性能优化总结

本文档记录了针对库存管理模块的性能优化措施和最佳实践。

## 🔧 已实施的优化

### 1. Redis连接稳定性优化

#### 问题描述

- Redis连接频繁断开并重连 (`[Redis] error: read ECONNRESET`)
- 导致缓存失效,每次请求都查询数据库
- 影响系统整体性能

#### 解决方案

**文件**: `lib/redis/redis-client.ts`

1. **多级缓存策略**
   - 实现内存缓存作为Redis的降级方案
   - Redis不可用时自动切换到内存缓存
   - 确保系统在Redis故障时仍能正常运行

2. **连接配置优化**

   ```typescript
   {
     maxRetriesPerRequest: 3,        // 增加重试次数
     connectTimeout: 10000,          // 10秒连接超时
     keepAlive: 30000,               // 30秒保活
     retryStrategy: (times) => {
       const delay = Math.min(times * 1000, 30000);
       if (times > 10) {
         return null; // 停止无限重试
       }
       return delay;
     }
   }
   ```

3. **智能可用性检测**
   - 每30秒检查一次Redis可用性
   - 避免频繁的连接检查
   - 自动恢复Redis连接

4. **内存缓存管理**
   - 自动清理过期缓存(每分钟)
   - 支持TTL过期机制
   - 与Redis保持一致的API

#### 配置更新

**文件**: `.env.local`

```env
REDIS_POOL_SIZE="5"  # 从3增加到5,提高并发能力
```

### 2. 数据库索引优化

#### 现有索引

库存表(`inventory`)已有以下索引:

- `idx_inventory_product` - 产品ID索引
- `idx_inventory_variant` - 变体ID索引
- `idx_inventory_quantity` - 库存数量索引
- `idx_inventory_batch` - 批次号索引
- `idx_inventory_location` - 位置索引
- `idx_inventory_updated_at` - 更新时间索引

#### 查询优化建议

当前库存查询使用的SQL:

```sql
SELECT i.*, p.*, c.*
FROM inventory i
LEFT JOIN products p ON i.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
WHERE 1=1
ORDER BY i.updated_at DESC
LIMIT 20 OFFSET 0
```

**优化点**:

- ✅ 已有 `updated_at` 索引支持排序
- ✅ 已有 `product_id` 索引支持JOIN
- ✅ 使用LIMIT限制返回数量

### 3. 缓存策略优化

#### 缓存TTL配置

```env
PRODUCT_CACHE_TTL="60"      # 产品缓存60秒
INVENTORY_CACHE_TTL="10"    # 库存缓存10秒(变化频繁)
```

#### 缓存失效策略

- 产品更新时清除相关缓存
- 库存变动时清除库存缓存
- 使用命名空间模式批量清除

## 📈 性能指标

### 优化前

| 指标        | 值     | 说明          |
| ----------- | ------ | ------------- |
| 首次API响应 | 1084ms | 无缓存        |
| Redis连接   | 不稳定 | 频繁断开      |
| 缓存命中率  | 低     | Redis故障导致 |

### 优化后(预期)

| 指标        | 目标值 | 说明           |
| ----------- | ------ | -------------- |
| 首次API响应 | <500ms | 数据库优化     |
| 缓存API响应 | <50ms  | 内存/Redis缓存 |
| Redis可用性 | >99%   | 降级方案       |
| 缓存命中率  | >80%   | 多级缓存       |

## 🎯 最佳实践

### 1. 缓存使用

```typescript
// 使用缓存包装器
import { getOrSetJSON } from '@/lib/cache/cache';

const data = await getOrSetJSON(
  cacheKey,
  async () => {
    // 数据库查询
    return await prisma.inventory.findMany(...);
  },
  60 // TTL秒数
);
```

### 2. 缓存失效

```typescript
// 清除特定命名空间的缓存
import { invalidateNamespace } from '@/lib/cache/cache';

await invalidateNamespace('inventory:list:*');
```

### 3. 数据库查询

- 始终使用索引字段作为WHERE条件
- 避免SELECT \*,只查询需要的字段
- 使用LIMIT限制返回数量
- 考虑使用分页

## 🔍 监控建议

### 开发环境

- Redis连接状态在控制台显示
- 缓存命中/未命中日志
- 查询性能日志

### 生产环境

1. **Redis监控**
   - 内存使用率
   - 连接数
   - 命令执行时间
   - 缓存命中率

2. **数据库监控**
   - 慢查询日志(>100ms)
   - 连接池使用率
   - 索引使用情况

3. **应用监控**
   - API响应时间
   - 错误率
   - 内存使用

## 📝 待优化项

### 短期(1-2周)

- [ ] 添加API响应时间监控
- [ ] 实现慢查询日志
- [ ] 优化首次编译时间

### 中期(1-2月)

- [ ] 实现查询结果分页缓存
- [ ] 添加数据库连接池监控
- [ ] 实现缓存预热机制

### 长期(3-6月)

- [ ] 考虑读写分离
- [ ] 实现分布式缓存
- [ ] 数据库分表策略

## 🚀 部署检查清单

部署前确认:

- [ ] Redis服务正常运行
- [ ] 数据库索引已创建
- [ ] 环境变量配置正确
- [ ] 缓存TTL配置合理
- [ ] 监控系统已配置

## 📚 相关文档

- [Redis缓存架构](../README-REDIS-WEBSOCKET.md)
- [数据库Schema](../prisma/schema.prisma)
- [环境配置](../lib/env.ts)
- [ESLint规范](./.augment/rules/ESLint规范遵循指南.md)

---

**最后更新**: 2025-09-30
**维护者**: 开发团队
