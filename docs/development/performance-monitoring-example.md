# 分类列表查询性能监控示例

## 📊 功能说明

已为 `lib/services/category-service.ts` 中的 `getCategories` 函数添加性能监控功能。

## 🎯 监控内容

### 1. 查询耗时记录
- 在 Prisma 查询前记录开始时间
- 在查询完成后计算耗时（毫秒）

### 2. 慢查询警告
- 当查询耗时超过 **1000ms** 时，自动输出警告日志
- 日志包含详细的查询参数和性能数据

## 📝 日志格式

### 正常查询（<1000ms）
不会输出任何日志，保持控制台清洁。

### 慢查询（≥1000ms）
```javascript
console.warn('Slow query: getCategories took 1523ms', {
  page: 1,
  limit: 20,
  search: '电子产品',
  parentId: undefined,
  status: 'active',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  total: 150,
  duration: 1523
});
```

## 🔍 日志字段说明

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `page` | number | 当前页码 | `1` |
| `limit` | number | 每页数量 | `20` |
| `search` | string \| undefined | 搜索关键词 | `'电子产品'` |
| `parentId` | string \| undefined | 父分类ID | `'uuid-xxx'` |
| `status` | string \| undefined | 状态筛选 | `'active'` |
| `sortBy` | string | 排序字段 | `'createdAt'` |
| `sortOrder` | string | 排序方向 | `'desc'` |
| `total` | number | 总记录数 | `150` |
| `duration` | number | 查询耗时（毫秒） | `1523` |

## 🚀 使用场景

### 场景 1: 开发环境调试
在开发环境中，可以通过控制台日志快速发现性能问题：

```bash
# 启动开发服务器
npm run dev

# 访问分类列表页面
# 如果查询慢，控制台会自动显示警告
```

### 场景 2: 生产环境监控
在生产环境中，可以通过日志收集工具（如 Sentry、LogRocket）捕获慢查询：

```typescript
// 可以在未来扩展为发送到监控服务
if (duration > 1000) {
  console.warn(`Slow query: getCategories took ${duration}ms`, {...});
  
  // 可选: 发送到监控服务
  // sentry.captureMessage('Slow query detected', { extra: {...} });
}
```

### 场景 3: 性能优化决策
根据日志数据决定是否需要优化：

```
✅ 查询耗时 < 500ms: 性能良好，无需优化
⚠️ 查询耗时 500-1000ms: 可以接受，建议关注
🚨 查询耗时 > 1000ms: 需要优化，触发警告日志
```

## 📈 性能优化建议

当频繁出现慢查询警告时，可以考虑以下优化方案：

### 方案 1: 添加冗余字段（推荐）
在 `categories` 表添加 `product_count` 字段，避免 LEFT JOIN 聚合。

### 方案 2: 使用 Redis 缓存
缓存分类列表数据，减少数据库查询。

### 方案 3: 条件性加载
只在需要时查询产品数量，列表页面可以不显示。

### 方案 4: 数据库索引优化
确保 `products.category_id` 有索引（已有）。

## 🔧 代码实现

### 核心代码片段

```typescript
// 性能监控: 记录查询开始时间
const startTime = Date.now();

// 执行查询
const [categories, total] = await Promise.all([
  prisma.category.findMany({...}),
  prisma.category.count({ where }),
]);

// 性能监控: 计算查询耗时
const duration = Date.now() - startTime;

// 性能监控: 慢查询警告
if (duration > 1000) {
  console.warn(`Slow query: getCategories took ${duration}ms`, {
    page,
    limit,
    search: filterParams.search || undefined,
    parentId: filterParams.parentId || undefined,
    status: filterParams.status || undefined,
    sortBy,
    sortOrder,
    total,
    duration,
  });
}
```

## ✅ 验证清单

- [x] 添加查询开始时间记录
- [x] 添加查询耗时计算
- [x] 添加慢查询警告逻辑（阈值 1000ms）
- [x] 日志包含所有查询参数
- [x] 日志包含查询结果统计（total）
- [x] 日志包含查询耗时（duration）
- [x] 不影响原有功能和错误处理
- [x] 通过 TypeScript 类型检查
- [x] 通过 ESLint 代码规范检查
- [x] 代码风格符合项目规范

## 📊 预期效果

### 开发环境
```bash
# 控制台输出示例
⚠️ Slow query: getCategories took 1523ms {
  page: 1,
  limit: 20,
  search: '电子产品',
  parentId: undefined,
  status: 'active',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  total: 150,
  duration: 1523
}
```

### 生产环境
- 可以通过日志收集工具捕获慢查询
- 可以设置告警规则，当慢查询频率过高时发送通知
- 可以分析日志数据，找出性能瓶颈

## 🎯 下一步建议

1. **监控数据收集**: 运行一段时间，收集实际查询耗时数据
2. **性能基线建立**: 确定正常查询的平均耗时
3. **优化决策**: 根据数据决定是否需要实施优化方案
4. **持续改进**: 定期检查慢查询日志，持续优化性能

## 📚 相关文档

- [Prisma 性能优化指南](https://www.prisma.io/docs/guides/performance-and-optimization)
- [MySQL 查询优化](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
- [Next.js 性能监控](https://nextjs.org/docs/advanced-features/measuring-performance)

---

**最后更新**: 2025-01-14
**维护者**: Augment Agent
**版本**: 1.0.0

