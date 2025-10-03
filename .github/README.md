# GitHub Actions 配置说明

本目录包含项目的 GitHub Actions 工作流配置。

## 📁 文件结构

```
.github/
├── workflows/
│   ├── ci.yml          # 持续集成工作流
│   └── cd.yml          # 持续部署工作流
└── README.md           # 本文件
```

## 🔄 工作流说明

### CI 工作流 (ci.yml)

**触发条件**：

- Push 到 `main` 或 `develop` 分支
- Pull Request 到 `main` 或 `develop` 分支

**检查内容**：

1. 代码格式检查 (Prettier)
2. 代码质量检查 (ESLint)
3. 类型检查 (TypeScript)
4. 构建检查 (Next.js)
5. 数据库迁移验证 (Prisma)
6. 安全漏洞检查 (pnpm audit)

**运行时间**：约 3-5 分钟

### CD 工作流 (cd.yml)

**触发条件**：

- Push 到 `main` 分支
- 创建版本标签 (`v*`)
- 手动触发

**部署步骤**：

1. 安装生产依赖
2. 生成 Prisma Client
3. 构建应用
4. 通过 SSH 部署到服务器
5. 应用数据库迁移
6. 重启 PM2 进程
7. 健康检查
8. 发送部署通知

**运行时间**：约 5-10 分钟

## 🔐 所需 GitHub Secrets

在 GitHub 仓库设置中配置以下 Secrets：

### 必需的 Secrets

| Secret 名称       | 说明                 | 示例                             |
| ----------------- | -------------------- | -------------------------------- |
| `DATABASE_URL`    | 生产数据库连接字符串 | `mysql://user:pass@host:3306/db` |
| `NEXTAUTH_URL`    | 生产环境 URL         | `https://your-domain.com`        |
| `NEXTAUTH_SECRET` | NextAuth 密钥        | 随机生成的 32 字符字符串         |
| `DEPLOY_HOST`     | 服务器地址           | `123.456.789.0`                  |
| `DEPLOY_USER`     | SSH 用户名           | `root` 或 `deploy`               |
| `DEPLOY_SSH_KEY`  | SSH 私钥             | 完整的 SSH 私钥内容              |
| `DEPLOY_PATH`     | 项目部署路径         | `/var/www/kucun`                 |

### 可选的 Secrets

| Secret 名称         | 说明               | 默认值 |
| ------------------- | ------------------ | ------ |
| `DEPLOY_PORT`       | SSH 端口           | `22`   |
| `SLACK_WEBHOOK_URL` | Slack 通知 Webhook | -      |

## 📝 配置步骤

### 1. 配置 GitHub Secrets

1. 进入 GitHub 仓库页面
2. 点击 `Settings` → `Secrets and variables` → `Actions`
3. 点击 `New repository secret`
4. 添加上述所有必需的 Secrets

### 2. 生成 SSH 密钥

```bash
# 在本地生成 SSH 密钥对
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/github_deploy.pub user@server

# 将私钥内容复制到 GitHub Secrets
cat ~/.ssh/github_deploy
```

### 3. 配置服务器

确保服务器上已安装：

- Node.js 20.x
- pnpm
- PM2
- Git

### 4. 测试工作流

```bash
# 推送代码触发 CI
git push origin develop

# 推送到 main 触发 CD
git push origin main

# 或手动触发
# 在 GitHub Actions 页面点击 "Run workflow"
```

## 🔍 监控和调试

### 查看工作流运行状态

1. 进入 GitHub 仓库页面
2. 点击 `Actions` 标签
3. 查看最近的工作流运行记录

### 调试失败的工作流

1. 点击失败的工作流运行
2. 查看具体失败的步骤
3. 展开步骤查看详细日志
4. 根据错误信息修复问题

### 常见问题

#### CI 构建失败

**原因**：代码质量问题或依赖问题

**解决方法**：

```bash
# 本地运行相同的检查
pnpm lint
pnpm type-check
pnpm build
```

#### CD 部署失败

**原因**：SSH 连接问题或服务器配置问题

**解决方法**：

1. 检查 SSH 密钥是否正确
2. 检查服务器防火墙设置
3. 检查服务器上的环境变量
4. 查看服务器日志

#### 健康检查失败

**原因**：数据库或 Redis 连接问题

**解决方法**：

```bash
# SSH 到服务器
ssh user@server

# 检查应用日志
pm2 logs kucun --lines 100

# 检查健康检查接口
curl http://localhost:3000/api/health
```

## 🚀 最佳实践

### 分支策略

- `main`: 生产环境分支，触发自动部署
- `develop`: 开发分支，触发 CI 检查
- `feature/*`: 功能分支，创建 PR 时触发 CI

### 提交规范

遵循 Conventional Commits 规范：

```bash
feat(auth): add Google OAuth login
fix(ui): correct button spacing
docs(readme): update installation guide
```

### 部署策略

1. **开发环境**：每次 push 到 `develop` 自动部署
2. **测试环境**：手动触发部署
3. **生产环境**：push 到 `main` 或创建版本标签时自动部署

### 版本管理

使用语义化版本号：

```bash
# 创建版本标签
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# 这将触发 CD 工作流
```

## 📚 相关文档

- [CI/CD 配置指南](../docs/CI-CD-GUIDE.md)
- [部署脚本说明](../scripts/README.md)
- [健康检查 API](../app/api/health/README.md)

## 🆘 获取帮助

如果遇到问题：

1. 查看 [CI/CD 配置指南](../docs/CI-CD-GUIDE.md) 中的故障排查部分
2. 查看 GitHub Actions 日志
3. 联系项目维护者
