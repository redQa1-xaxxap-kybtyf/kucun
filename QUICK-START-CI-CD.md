# CI/CD 快速开始指南

> 5 分钟快速配置和使用项目的 CI/CD 流程

## 🚀 快速开始

### 1. 验证本地配置（1 分钟）

```bash
# 运行验证脚本
./scripts/verify-ci-cd-setup.sh

# 预期结果：25 项通过，3 项失败（正常）
```

### 2. 测试 Git Hooks（2 分钟）

```bash
# 测试 pre-commit 钩子
echo "// test" >> test.js
git add test.js
git commit -m "test: verify pre-commit hook"
# 应该自动运行 ESLint 和 Prettier

# 测试 commit-msg 钩子（应该失败）
git commit -m "invalid message"
# 应该提示提交信息格式不正确

# 正确的提交格式
git commit -m "test: verify commit-msg hook"

# 清理测试文件
git reset HEAD~1
rm test.js
```

### 3. 配置 GitHub Actions（可选，2 分钟）

如果要使用 GitHub Actions CI/CD：

1. **配置 GitHub Secrets**

   进入 GitHub 仓库 → Settings → Secrets and variables → Actions

   添加以下 Secrets：

   ```
   DATABASE_URL=mysql://user:pass@host:3306/db
   NEXTAUTH_URL=https://your-domain.com
   NEXTAUTH_SECRET=<使用 openssl rand -base64 32 生成>
   DEPLOY_HOST=123.456.789.0
   DEPLOY_USER=root
   DEPLOY_SSH_KEY=<SSH 私钥内容>
   DEPLOY_PATH=/var/www/kucun
   ```

2. **推送代码触发 CI**

   ```bash
   git push origin develop
   ```

   在 GitHub Actions 页面查看运行结果。

---

## 📋 日常使用

### 提交代码

```bash
# 1. 添加文件
git add .

# 2. 提交（自动触发 pre-commit 钩子）
git commit -m "feat(auth): add login feature"

# 3. 推送（自动触发 pre-push 钩子）
git push origin develop
```

**提交信息格式**：

```
<类型>(<范围>): <描述>

类型：feat, fix, docs, style, refactor, perf, test, chore
范围：auth, ui, api, database 等
描述：简短描述（不超过 50 字符）
```

### 部署到生产环境

#### 方式 1：使用部署脚本（推荐）

```bash
# 完整部署（带备份和回滚）
./scripts/deploy-production.sh

# 快速部署
./scripts/quick-deploy.sh
```

#### 方式 2：使用 package.json 脚本

```bash
pnpm deploy:prod
```

#### 方式 3：GitHub Actions 自动部署

```bash
# 推送到 main 分支自动触发部署
git push origin main

# 或创建版本标签
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### 健康检查

```bash
# 检查应用健康状态
curl http://localhost:3000/api/health

# 或在浏览器访问
open http://localhost:3000/api/health
```

---

## 🔧 常用命令

### 代码质量检查

```bash
# ESLint 检查
pnpm lint

# 自动修复 ESLint 问题
pnpm lint:fix

# TypeScript 类型检查
pnpm type-check

# Prettier 格式检查
pnpm format:check

# 自动格式化代码
pnpm format

# 运行所有检查
pnpm check-all
```

### 数据库操作

```bash
# 生成 Prisma Client
pnpm db:generate

# 创建迁移
pnpm db:migrate

# 应用迁移（生产环境）
npx prisma migrate deploy

# 查看迁移状态
npx prisma migrate status
```

### PM2 进程管理

```bash
# 启动应用
pnpm pm2:start

# 重启应用
pnpm pm2:restart

# 重新加载应用（零停机）
pnpm pm2:reload

# 停止应用
pnpm pm2:stop

# 查看日志
pnpm pm2:logs

# 查看状态
pnpm pm2:status
```

---

## 🛠️ 故障排查

### Git Hooks 不执行

```bash
# 重新安装 Husky
pnpm install
pnpm prepare

# 检查钩子权限
ls -la .husky/
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
chmod +x .husky/pre-push
```

### lint-staged 卡住

```bash
# 清除 ESLint 缓存
rm -rf .eslintcache

# 跳过钩子提交（紧急情况）
git commit --no-verify -m "your message"
```

### CI 构建失败

```bash
# 本地运行相同的检查
pnpm lint
pnpm type-check
pnpm build

# 查看 GitHub Actions 日志
# 在 GitHub 仓库 → Actions → 点击失败的工作流
```

### 部署失败

```bash
# 查看部署日志
./scripts/deploy-production.sh

# 查看 PM2 日志
pm2 logs kucun --lines 100

# 检查健康状态
curl http://localhost:3000/api/health

# 手动回滚
BACKUP_DIR="backups/20250115_103000"
rm -rf .next
cp -r $BACKUP_DIR/.next .
pm2 reload ecosystem.config.js --env production
```

---

## 📚 详细文档

- [CI/CD 配置指南](docs/CI-CD-GUIDE.md) - 完整的配置说明
- [GitHub Actions 配置](. github/README.md) - GitHub Actions 详细说明
- [Git 提交规范](.augment/rules/GIT提交规范.md) - 提交信息规范
- [ESLint 规范](.augment/rules/ESLint规范遵循指南.md) - 代码质量规范

---

## ✅ 检查清单

### 开发环境

- [ ] 运行 `./scripts/verify-ci-cd-setup.sh` 验证配置
- [ ] 测试 Git Hooks 是否正常工作
- [ ] 运行 `pnpm lint` 确保代码质量
- [ ] 运行 `pnpm type-check` 确保类型正确
- [ ] 运行 `pnpm build` 确保构建成功

### 生产环境

- [ ] 配置所有环境变量（`.env.local`）
- [ ] 配置 GitHub Secrets（如果使用 GitHub Actions）
- [ ] 测试健康检查接口
- [ ] 测试部署脚本
- [ ] 配置 PM2 进程管理
- [ ] 配置 Nginx 反向代理（如果需要）

---

## 🎯 最佳实践

1. **小步提交**：每次提交只做一件事
2. **清晰的提交信息**：遵循 Conventional Commits 规范
3. **提交前测试**：确保代码在本地运行正常
4. **定期拉取**：及时拉取最新代码并解决冲突
5. **代码审查**：创建 Pull Request 进行代码审查
6. **低峰期部署**：选择用户访问量低的时间段部署
7. **监控日志**：部署后密切关注应用日志
8. **准备回滚**：出现问题立即回滚

---

**配置完成！开始使用 CI/CD 流程吧！** 🎉
