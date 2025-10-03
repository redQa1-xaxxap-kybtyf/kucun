# CI/CD 配置说明

本项目已配置完整的 CI/CD 流程，包括本地代码质量保障、持续集成和持续部署。

## 📋 配置概览

### 质量关卡

```
本地提交 → Git Hooks → CI 检查 → 部署 → 健康检查
```

#### 1. 本地提交质量保障（Git Hooks + lint-staged）

**pre-commit 钩子**：

- 对暂存文件运行 `eslint --cache --fix`
- 对暂存文件运行 `prettier --write`
- 自动修复可修复的问题
- 阻止不合规代码提交

**commit-msg 钩子**：

- 验证提交信息符合 Conventional Commits 规范
- 格式：`<类型>(<范围>): <描述>`
- 支持的类型：feat, fix, docs, style, refactor, perf, test, chore, build, ci, revert

**pre-push 钩子**：

- TypeScript 类型检查 (`npm run type-check`)
- ESLint 检查 (`npm run lint`)
- Prettier 格式检查 (`npm run format:check`)
- 构建检查 (`npm run build`)

#### 2. 持续集成（GitHub Actions CI）

**触发条件**：

- Push 到 `main` 或 `develop` 分支
- Pull Request 到 `main` 或 `develop` 分支

**检查内容**：

1. **代码质量检查**
   - Prettier 格式检查
   - ESLint 检查
   - TypeScript 类型检查
   - 构建检查

2. **数据库检查**
   - Prisma Schema 验证
   - Prisma Schema 格式检查
   - `prisma migrate diff` 检查 Schema 与数据库差异
   - 应用迁移测试

3. **安全检查**
   - `pnpm audit` 检查依赖漏洞
   - `pnpm outdated` 检查过期依赖

**环境配置**：

- Node.js 20.x
- pnpm 9
- SQLite 测试数据库

#### 3. 持续部署（GitHub Actions CD）

**触发条件**：

- Push 到 `main` 分支
- 创建版本标签 (`v*`)
- 手动触发

**部署流程**：

1. 安装生产依赖：`pnpm install --frozen-lockfile --prod`
2. 生成 Prisma Client：`pnpm db:generate`
3. 构建应用：`pnpm build`
4. 通过 SSH 部署到服务器
5. 备份当前版本
6. 应用数据库迁移：`npx prisma migrate deploy`
7. 重启 PM2 进程
8. 健康检查（最多重试 5 次）
9. 失败自动回滚
10. 发送部署通知（Slack）

**健康检查**：

- 端点：`GET /api/health`
- 检查数据库连接
- 检查 Redis 连接
- 检查应用状态
- 返回 200 表示健康，503 表示不健康

**回滚策略**：

- 部署前自动备份当前版本
- 健康检查失败自动回滚到备份版本
- 保留最近 5 个备份

---

## 🚀 快速开始

### 1. 验证配置

```bash
./scripts/verify-ci-cd-setup.sh
```

### 2. 测试 Git Hooks

```bash
# 测试 pre-commit
git add .
git commit -m "test: verify hooks"

# 测试 commit-msg（应该失败）
git commit -m "invalid message"
```

### 3. 配置 GitHub Secrets（可选）

如果要使用 GitHub Actions CD，需要配置以下 Secrets：

```
DATABASE_URL          # 生产数据库连接字符串
NEXTAUTH_URL          # 生产环境 URL
NEXTAUTH_SECRET       # NextAuth 密钥
DEPLOY_HOST           # 服务器地址
DEPLOY_USER           # SSH 用户名
DEPLOY_SSH_KEY        # SSH 私钥
DEPLOY_PATH           # 项目部署路径
SLACK_WEBHOOK_URL     # Slack 通知（可选）
```

### 4. 部署到生产环境

```bash
# 方式 1：使用部署脚本
./scripts/deploy-production.sh

# 方式 2：使用 package.json 脚本
pnpm deploy:prod

# 方式 3：GitHub Actions 自动部署
git push origin main
```

---

## 📁 文件结构

```
.
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # CI 工作流
│   │   └── cd.yml                    # CD 工作流
│   └── README.md                     # GitHub Actions 配置说明
├── .husky/
│   ├── pre-commit                    # pre-commit 钩子
│   ├── commit-msg                    # commit-msg 钩子
│   └── pre-push                      # pre-push 钩子
├── scripts/
│   ├── deploy-production.sh          # 完整部署脚本
│   ├── quick-deploy.sh               # 快速部署脚本
│   └── verify-ci-cd-setup.sh         # 配置验证脚本
├── app/api/health/
│   └── route.ts                      # 健康检查 API
├── docs/
│   └── CI-CD-GUIDE.md                # 详细配置指南
├── package.json                      # 包含 lint-staged 配置
├── QUICK-START-CI-CD.md              # 快速开始指南
├── CI-CD-SETUP-SUMMARY.md            # 配置完成总结
└── README-CI-CD.md                   # 本文件
```

---

## 🔧 核心配置

### package.json 脚本

```json
{
  "scripts": {
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "type-check": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "build": "next build",
    "deploy:prod": "npm ci --omit=dev && npm run build && npx prisma migrate deploy && npm run pm2:reload"
  }
}
```

### lint-staged 配置

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --cache --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

---

## 📚 详细文档

- [快速开始指南](QUICK-START-CI-CD.md) - 5 分钟快速上手
- [CI/CD 配置指南](docs/CI-CD-GUIDE.md) - 完整的配置说明
- [GitHub Actions 配置](.github/README.md) - GitHub Actions 详细说明
- [配置完成总结](CI-CD-SETUP-SUMMARY.md) - 配置完成总结
- [Git 提交规范](.augment/rules/GIT提交规范.md) - 提交信息规范
- [ESLint 规范](.augment/rules/ESLint规范遵循指南.md) - 代码质量规范

---

## 🆘 常见问题

### Q: Git Hooks 不执行？

```bash
pnpm install
pnpm prepare
```

### Q: lint-staged 卡住？

```bash
rm -rf .eslintcache
git commit --no-verify -m "your message"  # 紧急情况
```

### Q: CI 构建失败？

```bash
# 本地运行相同的检查
pnpm lint
pnpm type-check
pnpm build
```

### Q: 部署失败？

```bash
# 查看日志
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

## ✅ 验证清单

### 开发环境

- [ ] 运行 `./scripts/verify-ci-cd-setup.sh`
- [ ] 测试 Git Hooks
- [ ] 运行 `pnpm lint`
- [ ] 运行 `pnpm type-check`
- [ ] 运行 `pnpm build`

### 生产环境

- [ ] 配置环境变量
- [ ] 配置 GitHub Secrets
- [ ] 测试健康检查
- [ ] 测试部署脚本
- [ ] 配置 PM2
- [ ] 配置 Nginx

---

**配置完成！** 🎉

查看 [快速开始指南](QUICK-START-CI-CD.md) 开始使用。
