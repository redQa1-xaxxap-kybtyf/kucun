# MySQL 唯一数据库更新总结

**日期**: 2025-10-20
**决策**: 生产和开发环境统一使用 MySQL 数据库

---

## 📋 更新概览

### 核心决策

项目已完全迁移至 MySQL，**放弃对 SQLite 的支持**。

- ✅ **开发环境**: MySQL (kucun_dev)
- ✅ **生产环境**: MySQL (kucun)
- ❌ **SQLite**: 已废弃，不再支持

### 迁移原因

1. **性能需求**: 生产环境需要高并发支持
2. **功能完整性**: 需要完整的索引优化和事务控制
3. **运维统一**: 减少开发和生产环境差异
4. **数据可靠性**: MySQL 提供更强的数据完整性保证

---

## 📝 文档更新清单

### 1. `.env.example` ✅

**修改内容**:

- 移除第 39-40 行的 SQLite 配置示例
- 保留 MySQL 配置作为唯一选项

**修改前**:

```bash
# 开发环境 MySQL 本地
# DATABASE_URL=mysql://root:password@localhost:3306/kucun_dev?connection_limit=5&pool_timeout=30&connect_timeout=10

# 旧版本 SQLite (不推荐,仅用于快速测试)
# DATABASE_URL=file:./prisma/dev.db
```

**修改后**:

```bash
# 开发环境 MySQL 本地
# DATABASE_URL=mysql://root:password@localhost:3306/kucun_dev?connection_limit=5&pool_timeout=30&connect_timeout=10
```

### 2. `QUICK_START_WITH_TEST_DATA.md` ✅

**修改内容**:

- 更新"数据库直接查询"章节（第 207-220 行）
- 将 SQLite 查询示例改为 MySQL

**修改前**:

```bash
# 如果使用 SQLite
sqlite3 prisma/dev.db

# 查看所有表
.tables
```

**修改后**:

```bash
# MySQL 数据库查询
mysql -u root -p kucun_dev

# 查看所有表
SHOW TABLES;
```

### 3. `README.md` ✅

**检查结果**: 无 SQLite 相关内容，无需修改

### 4. 项目记忆文档 ✅

**新增内容**:

- 创建 `database_mysql_migration` 记忆
- 记录迁移决策、配置规范和维护命令
- 存储位置: `.serena/memories/database_mysql_migration.md`

---

## 🔧 数据库配置

### 开发环境配置

```bash
DATABASE_URL="mysql://root:root@localhost:3306/kucun_dev?connection_limit=5&pool_timeout=30&connect_timeout=10"
```

**参数说明**:

- `connection_limit=5`: 开发环境连接池大小
- `pool_timeout=30`: 连接超时 30 秒
- `connect_timeout=10`: 初始连接超时 10 秒

### 生产环境配置

```bash
DATABASE_URL="mysql://user:password@localhost:3306/kucun?connection_limit=10&pool_timeout=30&connect_timeout=10"
```

**参数说明**:

- `connection_limit=10-20`: 根据并发量调整
- `pool_timeout=30`: 连接超时 30 秒
- `connect_timeout=10`: 初始连接超时 10 秒

### 版本要求

| 版本       | 支持状态    | 说明                     |
| ---------- | ----------- | ------------------------ |
| MySQL 8.0+ | ✅ 推荐     | 完整索引优化支持         |
| MySQL 5.7  | ✅ 最低要求 | 功能兼容，降序索引不优化 |
| SQLite     | ❌ 已废弃   | 不再支持                 |

---

## 📊 已完成的数据库修复

### 1. TEXT 字段优化 ✅

**第一批修复（19个字段）**:

- remarks, notes, description 等长文本字段
- 从 VARCHAR(191) 改为 TEXT

**第二批修复（37个字段）**:

- 地址、URL、选择器、元数据等高风险字段
- 避免数据截断风险

### 2. 索引字段优化 ✅

| 表名                  | 字段       | 原类型       | 新类型       | 原因      |
| --------------------- | ---------- | ------------ | ------------ | --------- |
| inbound_records       | reason     | VARCHAR(191) | VARCHAR(100) | 枚举值    |
| inventory             | location   | VARCHAR(191) | VARCHAR(200) | 存储位置  |
| inventory_adjustments | reason     | VARCHAR(191) | VARCHAR(100) | 枚举值    |
| login_attempts        | ip_address | VARCHAR(191) | VARCHAR(45)  | IPv6 最大 |
| outbound_records      | reason     | VARCHAR(191) | VARCHAR(100) | 枚举值    |

### 3. 状态配置清理 ✅

**问题**: 配置文件定义7个状态，但类型定义只支持5个

**修复**:

- 从 `lib/config/sales-order.ts` 删除 `PROCESSING` 和 `DELIVERED`
- 从 `components/dashboard/recent-orders.tsx` 删除对应映射
- 统一为5个有效状态: draft, confirmed, shipped, completed, cancelled

### 4. 测试数据清理 ✅

**清理内容**:

- 删除 220 条批量测试数据（SO-BULK-\*）
- 清除 45 条无效的 `processing` 状态订单
- 当前保留 2 条正常订单

---

## 🎯 当前数据库状态

### 整体指标

| 指标     | 数值               | 状态 |
| -------- | ------------------ | ---- |
| 表数量   | 36                 | ✅   |
| 索引数量 | 228                | ✅   |
| 字符集   | utf8mb4_unicode_ci | ✅   |
| 日期字段 | 93 (DATETIME(3))   | ✅   |
| 布尔字段 | 6 (tinyint(1))     | ✅   |
| 外键约束 | 0 (Prisma 默认)    | ℹ️   |

### 数据类型分布

| 类型        | 数量 | 说明                          |
| ----------- | ---- | ----------------------------- |
| VARCHAR     | 169  | 大部分为低风险字段            |
| TEXT        | 56   | 长文本字段                    |
| DATETIME(3) | 93   | 毫秒精度日期时间              |
| DOUBLE      | 71   | 金额字段（可能需改为DECIMAL） |
| INT/BIGINT  | 多个 | 主键和数值字段                |

---

## 🔄 维护命令

### 常用命令

```bash
# 查看数据库状态（Prisma Studio）
npm run db:studio

# 推送 schema 变更到数据库
npm run db:push

# 运行数据库迁移
npm run db:migrate

# 填充测试数据
npm run db:seed

# 重置数据库（清空并重建）
npm run db:reset

# 生成 Prisma Client
npm run db:generate
```

### 数据库直连

```bash
# 开发环境
mysql -u root -p kucun_dev

# 生产环境
mysql -u user -p kucun

# 查看表结构
SHOW CREATE TABLE sales_orders;

# 查看索引
SHOW INDEX FROM sales_orders;

# 查看表大小
SELECT
  table_name,
  table_rows,
  ROUND(data_length / 1024 / 1024, 2) AS data_mb
FROM information_schema.tables
WHERE table_schema = 'kucun_dev'
ORDER BY data_length DESC;
```

---

## ⚠️ 注意事项

### 1. 外键约束

**状态**: Prisma 默认不生成外键约束

**影响**:

- 删除主记录不会级联删除/阻止
- 可能出现孤儿记录

**建议**:

- 当前应用层已有充分的数据完整性检查
- 如需数据库级别完整性，手动添加外键

### 2. 金额字段精度

**当前**: 使用 DOUBLE 类型
**风险**: 可能存在精度丢失

**建议**:

- 考虑将金额字段改为 DECIMAL(19, 4)
- 需要评估应用层计算逻辑影响

### 3. 表名大小写

**配置**: `lower_case_table_names = 1` (不区分大小写)

**说明**:

- Windows/macOS 默认配置
- Linux 默认为 0（区分大小写）

**建议**:

- 保持所有表名使用小写（当前已遵循）
- 避免跨平台兼容性问题

### 4. 降序索引

**MySQL 5.7 限制**: 降序索引不会被优化

**影响**: 查询性能略有影响，但功能完全兼容

**建议**: 升级到 MySQL 8.0+ 获得完整优化

---

## 📚 相关文档

- [MySQL 迁移检查报告](./mysql-migration-report.md)
- [项目 README](../README.md)
- [快速启动指南](../QUICK_START_WITH_TEST_DATA.md)
- [环境变量配置](../.env.example)

---

## ✅ 检查清单

文档更新完成确认：

- [x] `.env.example` - 移除 SQLite 配置
- [x] `QUICK_START_WITH_TEST_DATA.md` - 更新查询示例
- [x] `README.md` - 确认无 SQLite 引用
- [x] 项目记忆 - 记录迁移决策
- [x] 数据库修复 - TEXT字段、状态配置、测试数据
- [x] Git 提交 - 记录所有更改

---

**完成日期**: 2025-10-20
**负责人**: Claude
**状态**: ✅ 全部完成
