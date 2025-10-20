# 数据库迁移 - MySQL 作为唯一数据库

## 迁移决策 (2025-10-20)

项目已完全迁移至 MySQL 数据库，**生产环境和开发环境均使用 MySQL**。

### 迁移原因

1. **性能需求**: SQLite 不适合生产环境的高并发场景
2. **功能完整性**: 需要完整的索引优化和并发控制
3. **数据完整性**: MySQL 提供更好的事务和约束支持
4. **运维便利**: 统一开发和生产环境，减少环境差异问题

### 当前状态

- ✅ **开发环境**: MySQL (kucun_dev)
- ✅ **生产环境**: MySQL (kucun)
- ❌ **SQLite**: 已废弃，不再支持

### 数据库配置

#### 开发环境

```bash
DATABASE_URL="mysql://root:root@localhost:3306/kucun_dev?connection_limit=5&pool_timeout=30&connect_timeout=10"
```

#### 生产环境

```bash
DATABASE_URL="mysql://user:password@localhost:3306/kucun?connection_limit=10&pool_timeout=30&connect_timeout=10"
```

### 版本要求

- **推荐**: MySQL 8.0+ (完整索引优化支持)
- **最低**: MySQL 5.7 (功能兼容，但降序索引不优化)

### 连接池配置

| 参数             | 开发环境 | 生产环境 | 说明           |
| ---------------- | -------- | -------- | -------------- |
| connection_limit | 5        | 10-20    | 根据并发量调整 |
| pool_timeout     | 30秒     | 30秒     | 连接超时时间   |
| connect_timeout  | 10秒     | 10秒     | 初始连接超时   |

### 相关文档更新

已完成以下文档的更新：

1. ✅ `.env.example` - 移除 SQLite 配置示例
2. ✅ `QUICK_START_WITH_TEST_DATA.md` - 更新数据库查询示例为 MySQL
3. ✅ `README.md` - 确认无 SQLite 引用
4. ✅ `claudedocs/mysql-migration-report.md` - 详细迁移报告

### 迁移完成的修复

1. **TEXT 字段修复**: 19个字段从 VARCHAR(191) 改为 TEXT
2. **高风险字段**: 37个字段改为 TEXT 以避免数据截断
3. **索引字段优化**: 5个有索引的字段使用合适的 VARCHAR 长度
4. **状态配置清理**: 移除无效的 processing 和 delivered 状态
5. **测试数据清理**: 删除220条批量测试数据（含45条无效 processing 状态）

### 字符集和排序规则

- **字符集**: utf8mb4
- **排序规则**: utf8mb4_unicode_ci
- **支持**: Emoji 和特殊字符

### 性能优化

- ✅ 228个索引结构合理
- ✅ 93个日期时间字段使用 DATETIME(3) (毫秒精度)
- ✅ 无 TIMESTAMP 字段 (避免时区自动转换)
- ✅ 布尔字段使用 tinyint(1)

### 注意事项

1. **外键约束**: Prisma 默认不生成外键，依赖应用层保证数据完整性
2. **表名大小写**: 使用小写表名，避免跨平台兼容性问题
3. **金额字段**: 当前使用 DOUBLE，可能需要考虑改为 DECIMAL(19, 4)
4. **降序索引**: MySQL 5.7 不优化降序索引，但功能完全兼容

### 维护命令

```bash
# 查看数据库状态
npm run db:studio

# 推送 schema 变更
npm run db:push

# 运行迁移
npm run db:migrate

# 填充测试数据
npm run db:seed

# 重置数据库
npm run db:reset
```
