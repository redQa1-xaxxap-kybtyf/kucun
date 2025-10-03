# 数据库设置指南

## 概述

本项目使用 Prisma ORM 管理数据库。开发环境使用 SQLite，生产环境使用 MySQL。

## 重要说明

⚠️ **数据库文件不应提交到 Git**

- `prisma/dev.db` 是本地开发数据库文件，已添加到 `.gitignore`
- 每个开发者应该使用自己的本地数据库
- 使用数据库种子脚本初始化数据

## 开发环境设置

### 1. 初始化数据库

首次克隆项目后，需要初始化数据库：

```bash
# 1. 安装依赖
npm install

# 2. 生成 Prisma Client
npm run db:generate

# 3. 运行数据库迁移（创建表结构）
npm run db:migrate

# 4. 填充种子数据（可选）
npm run db:seed
```

### 2. 数据库命令说明

| 命令                  | 说明                                           |
| --------------------- | ---------------------------------------------- |
| `npm run db:generate` | 生成 Prisma Client（修改 schema 后必须运行）   |
| `npm run db:push`     | 推送 schema 变更到数据库（开发时快速同步）     |
| `npm run db:migrate`  | 创建并运行迁移（正式的 schema 变更）           |
| `npm run db:seed`     | 运行种子脚本，填充测试数据                     |
| `npm run db:studio`   | 打开 Prisma Studio 可视化管理数据库            |
| `npm run db:reset`    | 重置数据库（删除所有数据并重新运行迁移和种子） |

### 3. 种子数据说明

种子脚本位于 `prisma/seed.ts`，包含以下测试数据：

- **用户账号**：
  - 管理员账号：`admin` / `admin123`
  - 普通用户：`user` / `user123`

- **基础数据**：
  - 产品分类
  - 示例产品
  - 示例客户
  - 示例供应商

- **业务数据**：
  - 示例销售订单
  - 示例库存记录
  - 示例收款记录

### 4. 常见问题

#### Q: 数据库文件被 Git 跟踪怎么办？

如果 `git status` 显示 `prisma/dev.db` 被修改：

```bash
# 从 Git 缓存中移除（不删除本地文件）
git rm --cached prisma/dev.db

# 确认 .gitignore 包含数据库文件
cat .gitignore | grep "dev.db"
```

#### Q: 如何重置数据库？

```bash
# 方法 1: 使用 Prisma 命令（推荐）
npm run db:reset

# 方法 2: 手动删除并重建
rm prisma/dev.db
npm run db:migrate
npm run db:seed
```

#### Q: 修改了 schema.prisma 后如何同步？

```bash
# 开发环境：创建迁移
npm run db:migrate

# 或者快速同步（不创建迁移文件）
npm run db:push

# 重新生成 Prisma Client
npm run db:generate
```

#### Q: 如何查看和编辑数据库数据？

```bash
# 启动 Prisma Studio
npm run db:studio

# 浏览器会自动打开 http://localhost:5555
```

## 生产环境设置

### 1. 环境变量配置

在生产服务器上创建 `.env.production` 文件：

```bash
# 数据库配置（MySQL）
DATABASE_URL="mysql://username:password@localhost:3306/database_name"

# 其他必需的环境变量
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="<使用 openssl rand -base64 32 生成>"
STORAGE_ENCRYPTION_KEY="<使用 openssl rand -base64 32 生成>"
```

### 2. 数据库迁移

生产环境使用 `prisma migrate deploy` 命令：

```bash
# 1. 生成 Prisma Client
npx prisma generate

# 2. 运行数据库迁移
npx prisma migrate deploy
```

⚠️ **注意**：

- 生产环境不要使用 `db:migrate`（会提示创建迁移）
- 使用 `migrate deploy` 只运行已有的迁移文件
- 迁移文件应该在开发环境创建并提交到 Git

### 3. 生产环境种子数据

生产环境通常不需要运行种子脚本，但如果需要初始化基础数据：

```bash
# 只运行必要的初始化数据
NODE_ENV=production npm run db:seed
```

## 数据库备份

### 开发环境（SQLite）

```bash
# 备份数据库文件
cp prisma/dev.db prisma/dev.db.backup

# 恢复备份
cp prisma/dev.db.backup prisma/dev.db
```

### 生产环境（MySQL）

```bash
# 备份数据库
mysqldump -u username -p database_name > backup.sql

# 恢复数据库
mysql -u username -p database_name < backup.sql
```

## 迁移管理

### 创建新迁移

```bash
# 1. 修改 prisma/schema.prisma

# 2. 创建迁移
npm run db:migrate

# 3. 输入迁移名称（使用英文，描述性）
# 例如：add_user_avatar_field

# 4. 迁移文件会自动创建在 prisma/migrations/ 目录
```

### 迁移最佳实践

1. **迁移名称规范**：
   - 使用英文
   - 使用下划线分隔
   - 描述性强
   - 例如：`add_user_avatar_field`、`create_orders_table`

2. **迁移前检查**：
   - 确保 schema 变更正确
   - 考虑数据迁移的影响
   - 测试迁移的回滚

3. **提交迁移文件**：
   - 迁移文件必须提交到 Git
   - 包括 `migration.sql` 和时间戳目录
   - 不要手动修改已应用的迁移

## 故障排除

### 问题 1: Prisma Client 版本不匹配

```bash
# 错误信息：Prisma Client version mismatch

# 解决方案：重新生成 Prisma Client
npm run db:generate
```

### 问题 2: 数据库锁定

```bash
# 错误信息：database is locked

# 解决方案：关闭所有数据库连接
# 1. 停止开发服务器
# 2. 关闭 Prisma Studio
# 3. 重新启动
```

### 问题 3: 迁移失败

```bash
# 错误信息：Migration failed

# 解决方案：
# 1. 检查迁移 SQL 语法
# 2. 检查数据库状态
# 3. 如果是开发环境，可以重置数据库
npm run db:reset
```

## 参考资源

- [Prisma 官方文档](https://www.prisma.io/docs)
- [Prisma Migrate 指南](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Schema 参考](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)

## 总结

✅ **开发环境**：

- 使用 SQLite 数据库（`prisma/dev.db`）
- 数据库文件不提交到 Git
- 使用种子脚本初始化数据
- 使用 `db:migrate` 创建迁移

✅ **生产环境**：

- 使用 MySQL 数据库
- 使用 `migrate deploy` 运行迁移
- 不运行种子脚本（除非需要初始化）
- 定期备份数据库

✅ **迁移管理**：

- 在开发环境创建迁移
- 迁移文件提交到 Git
- 生产环境只运行已有迁移
- 遵循迁移最佳实践
