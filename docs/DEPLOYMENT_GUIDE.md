# 部署指南

## 概述

本文档说明如何将应用部署到生产环境。部署脚本位于 `scripts/deploy.sh`。

## 部署前准备

### 1. 服务器要求

- **操作系统**: Linux (Ubuntu 20.04+ 推荐)
- **Node.js**: 18.x 或更高版本
- **npm**: 9.x 或更高版本
- **数据库**: MySQL 8.0+
- **进程管理**: PM2
- **内存**: 至少 2GB RAM
- **磁盘**: 至少 10GB 可用空间

### 2. 环境变量配置

在项目根目录创建 `.env.production` 文件：

```bash
# 复制示例文件
cp .env.production.example .env.production

# 编辑配置
nano .env.production
```

**必需的环境变量**：

```bash
# 应用配置
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<使用 openssl rand -base64 32 生成>

# 数据库配置
DATABASE_URL=mysql://username:password@localhost:3306/database_name

# 存储加密密钥
STORAGE_ENCRYPTION_KEY=<使用 openssl rand -base64 32 生成>

# 其他配置...
```

**生成密钥**：

```bash
# 生成 NEXTAUTH_SECRET
openssl rand -base64 32

# 生成 STORAGE_ENCRYPTION_KEY
openssl rand -base64 32
```

### 3. 数据库准备

```bash
# 创建数据库
mysql -u root -p
CREATE DATABASE your_database_name CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'your_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON your_database_name.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 部署步骤

### 方法 1: 使用部署脚本（推荐）

```bash
# 1. 克隆代码
git clone <repository-url>
cd <project-directory>

# 2. 配置环境变量
cp .env.production.example .env.production
nano .env.production

# 3. 运行部署脚本
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

部署脚本会自动完成以下步骤：

1. ✅ 环境检查（Node.js、npm、PM2）
2. ✅ 创建必要的目录
3. ✅ 安装生产依赖（使用 `npm ci --omit=dev`）
4. ✅ 数据库迁移
5. ✅ 构建应用
6. ✅ 启动/重启 PM2 服务

### 方法 2: 手动部署

```bash
# 1. 安装依赖（只安装生产依赖）
npm ci --omit=dev

# 2. 生成 Prisma Client
npx prisma generate

# 3. 运行数据库迁移
npx prisma migrate deploy

# 4. 构建应用
npm run build

# 5. 启动应用
pm2 start ecosystem.config.js --env production
```

## 依赖管理最佳实践

### ✅ 正确的做法

```bash
# 1. 保留 package-lock.json（确保依赖版本一致性）
# 2. 使用 npm ci 而不是 npm install（更快、更可靠）
# 3. 使用 --omit=dev 排除开发依赖

# 清理旧的 node_modules
rm -rf node_modules

# 安装生产依赖
npm ci --omit=dev
```

### ❌ 错误的做法

```bash
# ❌ 不要删除 package-lock.json
rm -rf node_modules package-lock.json

# ❌ 不要使用 --production=false（会安装开发依赖）
npm ci --production=false

# ❌ 不要使用 npm install（可能导致版本不一致）
npm install --production
```

### 为什么使用 `npm ci --omit=dev`？

1. **`npm ci` 的优势**：
   - 更快（跳过某些用户导向的功能）
   - 更可靠（严格遵循 package-lock.json）
   - 更适合 CI/CD 环境
   - 自动删除 node_modules 后重新安装

2. **`--omit=dev` 的作用**：
   - 只安装 `dependencies`，不安装 `devDependencies`
   - 减少生产环境体积
   - 提高安全性（减少攻击面）
   - 加快部署速度

3. **保留 `package-lock.json` 的重要性**：
   - 锁定依赖版本，确保一致性
   - 防止"在我机器上能运行"的问题
   - 提高构建的可重复性
   - 必须提交到 Git

## 部署后验证

### 1. 检查应用状态

```bash
# 查看 PM2 进程状态
pm2 status

# 查看应用日志
pm2 logs kucun

# 查看错误日志
pm2 logs kucun --err

# 查看实时日志
pm2 logs kucun --lines 100
```

### 2. 健康检查

```bash
# 检查应用是否响应
curl http://localhost:3000/api/health

# 检查数据库连接
curl http://localhost:3000/api/health/db
```

### 3. 性能监控

```bash
# 查看 PM2 监控面板
pm2 monit

# 查看详细信息
pm2 show kucun
```

## 更新部署

### 常规更新

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新运行部署脚本
./scripts/deploy.sh
```

### 数据库迁移更新

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 运行数据库迁移
npx prisma migrate deploy

# 3. 重启应用
pm2 restart kucun
```

### 回滚部署

```bash
# 1. 回滚到上一个版本
git checkout <previous-commit-hash>

# 2. 重新部署
./scripts/deploy.sh

# 3. 如果需要回滚数据库迁移
# 注意：Prisma 不支持自动回滚，需要手动处理
```

## 常见问题

### Q1: 部署脚本执行失败

**检查清单**：

- [ ] Node.js 版本是否正确（18+）
- [ ] `.env.production` 文件是否存在
- [ ] 环境变量是否配置正确
- [ ] 数据库是否可访问
- [ ] 磁盘空间是否充足

### Q2: 应用启动后立即崩溃

```bash
# 查看错误日志
pm2 logs kucun --err

# 常见原因：
# 1. 数据库连接失败 -> 检查 DATABASE_URL
# 2. 端口被占用 -> 修改 PORT 环境变量
# 3. 缺少环境变量 -> 检查 .env.production
```

### Q3: 数据库迁移失败

```bash
# 查看迁移状态
npx prisma migrate status

# 如果迁移卡住，可以标记为已应用
npx prisma migrate resolve --applied <migration-name>

# 或者回滚并重新运行
npx prisma migrate resolve --rolled-back <migration-name>
npx prisma migrate deploy
```

### Q4: 依赖安装失败

```bash
# 清理 npm 缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
rm -rf node_modules package-lock.json

# 重新安装
npm install
npm ci --omit=dev
```

## 性能优化

### 1. 启用 PM2 集群模式

编辑 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [
    {
      name: 'kucun',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 'max', // 使用所有 CPU 核心
      exec_mode: 'cluster',
      // ...
    },
  ],
};
```

### 2. 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. 启用 HTTPS

```bash
# 使用 Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 监控和日志

### 日志管理

```bash
# PM2 日志位置
~/.pm2/logs/

# 应用日志
~/.pm2/logs/kucun-out.log  # 标准输出
~/.pm2/logs/kucun-error.log  # 错误输出

# 日志轮转
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 监控工具

```bash
# PM2 Plus（免费监控）
pm2 link <secret-key> <public-key>

# 或使用其他监控工具
# - New Relic
# - Datadog
# - Sentry
```

## 安全建议

1. **环境变量**：
   - 不要将 `.env.production` 提交到 Git
   - 使用强密码和随机密钥
   - 定期更换密钥

2. **数据库**：
   - 使用专用数据库用户
   - 限制数据库用户权限
   - 启用 SSL 连接

3. **应用**：
   - 定期更新依赖
   - 启用 HTTPS
   - 配置防火墙
   - 定期备份数据

4. **服务器**：
   - 禁用 root 登录
   - 使用 SSH 密钥认证
   - 配置自动安全更新
   - 监控异常访问

## 参考资源

- [Next.js 部署文档](https://nextjs.org/docs/deployment)
- [PM2 文档](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Prisma 部署指南](https://www.prisma.io/docs/guides/deployment)
- [Nginx 配置指南](https://nginx.org/en/docs/)

## 总结

✅ **部署前**：

- 配置环境变量
- 准备数据库
- 检查服务器要求

✅ **部署时**：

- 使用部署脚本（推荐）
- 或手动执行部署步骤
- 使用 `npm ci --omit=dev` 安装依赖

✅ **部署后**：

- 验证应用状态
- 检查日志
- 配置监控

✅ **维护**：

- 定期更新
- 监控性能
- 备份数据
- 保持安全
