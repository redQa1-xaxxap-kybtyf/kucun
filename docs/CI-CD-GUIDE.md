# CI/CD 配置指南

本文档详细说明项目的持续集成（CI）和持续部署（CD）配置。

## 📋 目录

- [本地提交质量保障](#本地提交质量保障)
- [GitHub Actions CI](#github-actions-ci)
- [生产环境部署](#生产环境部署)
- [健康检查](#健康检查)
- [故障排查](#故障排查)

---

## 本地提交质量保障

### Husky Git Hooks

项目使用 Husky 在 Git 提交时自动执行代码质量检查。

#### pre-commit 钩子

在每次 `git commit` 前自动运行：

```bash
npx lint-staged
```

**检查内容**：

- 对暂存的 TypeScript/JavaScript 文件运行 `eslint --fix`
- 对所有暂存文件运行 `prettier --write`
- 自动修复可修复的问题

**配置文件**：`.husky/pre-commit`

#### commit-msg 钩子

验证提交信息符合 Conventional Commits 规范。

**格式要求**：

```
<类型>(<范围>): <描述>
```

**支持的类型**：

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动
- `build`: 构建系统或外部依赖的变动
- `ci`: CI 配置文件和脚本的变动
- `revert`: 回滚之前的提交

**示例**：

```bash
git commit -m "feat(auth): add Google OAuth login support"
git commit -m "fix(ui): correct button spacing in mobile view"
git commit -m "refactor(api): simplify user data fetching logic"
```

**配置文件**：`.husky/commit-msg`

#### pre-push 钩子

在 `git push` 前运行完整的代码质量检查：

1. TypeScript 类型检查 (`npm run type-check`)
2. ESLint 检查 (`npm run lint`)
3. Prettier 格式检查 (`npm run format:check`)
4. 构建检查 (`npm run build`)

**配置文件**：`.husky/pre-push`

### lint-staged 配置

**配置位置**：`package.json` 中的 `lint-staged` 字段

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --cache --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

**特点**：

- 只检查暂存的文件，速度快
- 自动修复可修复的问题
- 使用 ESLint 缓存加速检查

---

## GitHub Actions CI

### CI 工作流

**文件位置**：`.github/workflows/ci.yml`

**触发条件**：

- Push 到 `main` 或 `develop` 分支
- Pull Request 到 `main` 或 `develop` 分支

### CI 检查任务

#### 1. 代码质量检查 (lint-and-test)

**步骤**：

1. 检出代码
2. 安装 pnpm
3. 设置 Node.js 20.x
4. 安装依赖 (`pnpm install --frozen-lockfile`)
5. 生成 Prisma Client
6. 代码格式检查 (`pnpm format:check`)
7. ESLint 检查 (`pnpm lint`)
8. TypeScript 类型检查 (`pnpm type-check`)
9. 构建检查 (`pnpm build`)
10. Prisma Schema 验证
11. 检查未应用的迁移

#### 2. 数据库迁移检查 (database-check)

**步骤**：

1. 验证 Prisma Schema
2. 检查 Prisma Schema 格式
3. 生成 Prisma Client
4. 创建测试数据库并应用迁移

#### 3. 构建验证 (build-check)

**步骤**：

1. 安装依赖
2. 生成 Prisma Client
3. 构建应用
4. 检查构建产物（`.next` 目录）

#### 4. 安全检查 (security-check)

**步骤**：

1. 检查依赖漏洞 (`pnpm audit`)
2. 检查过期依赖 (`pnpm outdated`)

### 环境变量

CI 环境使用以下环境变量：

```yaml
DATABASE_URL: file:./dev.db
NEXTAUTH_URL: http://localhost:3000
NEXTAUTH_SECRET: ci-test-secret-key-for-github-actions
```

### 缓存策略

使用 pnpm 缓存加速依赖安装：

```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'pnpm'
```

---

## 生产环境部署

### 自动部署（GitHub Actions CD）

**文件位置**：`.github/workflows/cd.yml`

**触发条件**：

- Push 到 `main` 分支
- 创建版本标签（`v*`）
- 手动触发（workflow_dispatch）

**部署步骤**：

1. 检出代码
2. 安装生产依赖 (`pnpm install --frozen-lockfile --prod`)
3. 生成 Prisma Client
4. 构建应用
5. 创建部署包
6. 通过 SSH 部署到服务器
7. 应用数据库迁移
8. 重启 PM2 进程
9. 健康检查
10. 发送部署通知

**所需 GitHub Secrets**：

- `DATABASE_URL`: 生产数据库连接字符串
- `NEXTAUTH_URL`: 生产环境 URL
- `NEXTAUTH_SECRET`: NextAuth 密钥
- `DEPLOY_HOST`: 服务器地址
- `DEPLOY_USER`: SSH 用户名
- `DEPLOY_SSH_KEY`: SSH 私钥
- `DEPLOY_PORT`: SSH 端口（默认 22）
- `DEPLOY_PATH`: 项目部署路径
- `SLACK_WEBHOOK_URL`: Slack 通知 Webhook（可选）

### 手动部署脚本

#### 完整部署脚本

**文件位置**：`scripts/deploy-production.sh`

**使用方法**：

```bash
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh
```

**功能**：

- ✅ 环境变量检查
- ✅ 自动备份当前版本
- ✅ 安装生产依赖
- ✅ 生成 Prisma Client
- ✅ 应用数据库迁移
- ✅ 构建应用
- ✅ 重启 PM2 进程
- ✅ 健康检查
- ✅ 失败自动回滚
- ✅ 清理旧备份

#### 快速部署脚本

**文件位置**：`scripts/quick-deploy.sh`

**使用方法**：

```bash
chmod +x scripts/quick-deploy.sh
./scripts/quick-deploy.sh
```

**功能**（简化版）：

- 安装依赖
- 生成 Prisma Client
- 应用数据库迁移
- 构建应用
- 重启 PM2

### 部署流程

#### 标准部署流程

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 运行部署脚本
./scripts/deploy-production.sh

# 3. 检查部署状态
pm2 status
pm2 logs kucun --lines 50

# 4. 验证健康检查
curl https://your-domain.com/api/health
```

#### 使用 package.json 脚本

```bash
# 快速部署（推荐）
pnpm deploy:prod

# 或使用 PM2 命令
pnpm pm2:reload
```

---

## 健康检查

### 健康检查接口

**端点**：`GET /api/health`

**响应格式**：

```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "checks": {
    "database": {
      "status": "up",
      "latency": 5
    },
    "redis": {
      "status": "up",
      "latency": 2
    },
    "application": {
      "status": "up",
      "uptime": 3600,
      "version": "1.0.0"
    }
  }
}
```

**状态码**：

- `200`: 所有服务正常
- `503`: 部分服务不可用

### 使用健康检查

```bash
# 检查应用健康状态
curl https://your-domain.com/api/health

# 检查特定服务
curl https://your-domain.com/api/health | jq '.checks.database'

# 监控脚本
while true; do
  curl -s https://your-domain.com/api/health | jq '.status'
  sleep 10
done
```

---

## 故障排查

### 常见问题

#### 1. Husky 钩子不执行

**原因**：Husky 未正确安装

**解决方法**：

```bash
pnpm install
pnpm prepare
```

#### 2. lint-staged 卡住

**原因**：ESLint 检查文件过多

**解决方法**：

```bash
# 清除 ESLint 缓存
rm -rf .eslintcache

# 或跳过钩子提交
git commit --no-verify -m "your message"
```

#### 3. CI 构建失败

**原因**：环境变量缺失或依赖问题

**解决方法**：

1. 检查 GitHub Secrets 配置
2. 查看 CI 日志定位具体错误
3. 本地运行 `pnpm build` 验证

#### 4. 部署后健康检查失败

**原因**：数据库或 Redis 连接问题

**解决方法**：

```bash
# 检查环境变量
cat .env.local

# 检查数据库连接
npx prisma db pull

# 检查 Redis 连接
redis-cli ping

# 查看应用日志
pm2 logs kucun --lines 100
```

#### 5. 数据库迁移失败

**原因**：迁移文件冲突或数据库状态不一致

**解决方法**：

```bash
# 检查迁移状态
npx prisma migrate status

# 重置迁移（⚠️ 仅开发环境）
npx prisma migrate reset

# 手动应用迁移
npx prisma migrate deploy
```

### 回滚部署

#### 使用备份回滚

```bash
# 查看备份列表
ls -lt backups/

# 回滚到指定备份
BACKUP_DIR="backups/20250115_103000"
rm -rf .next
cp -r $BACKUP_DIR/.next .
pm2 reload ecosystem.config.js --env production
```

#### 使用 Git 回滚

```bash
# 回滚到上一个提交
git revert HEAD
git push origin main

# 或回滚到指定提交
git revert <commit-hash>
git push origin main
```

---

## 最佳实践

### 提交代码

1. **小步提交**：每次提交只做一件事
2. **清晰的提交信息**：遵循 Conventional Commits 规范
3. **提交前测试**：确保代码在本地运行正常
4. **解决冲突**：及时拉取最新代码并解决冲突

### 部署流程

1. **测试环境验证**：先在测试环境部署验证
2. **备份数据**：部署前备份数据库
3. **低峰期部署**：选择用户访问量低的时间段
4. **监控日志**：部署后密切关注应用日志
5. **准备回滚**：出现问题立即回滚

### 监控和维护

1. **定期检查健康状态**：设置定时任务监控 `/api/health`
2. **日志分析**：定期查看 PM2 日志
3. **性能监控**：使用 APM 工具监控应用性能
4. **依赖更新**：定期更新依赖并测试
5. **备份管理**：定期清理旧备份，保留最近 5-10 个

---

## 相关文档

- [Git 提交规范](../GIT提交规范.md)
- [ESLint 规范遵循指南](../ESLint规范遵循指南.md)
- [项目硬规则](../项目硬规则.md)
