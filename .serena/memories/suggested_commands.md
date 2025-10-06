# 常用开发命令

## 开发命令

- `npm run dev` - 启动开发服务器 (localhost:3000)
- `npm run build` - 构建生产版本
- `npm run start` - 启动生产服务器

## 代码质量检查

- `npm run type-check` - TypeScript类型检查 (tsc --noEmit)
- `npm run lint` - ESLint检查
- `npm run lint:fix` - ESLint自动修复
- `npm run format` - Prettier格式化所有文件
- `npm run format:check` - 检查代码格式
- `npm run check-all` - 运行所有检查 (type-check + lint + format:check)

## 数据库命令

- `npm run db:generate` - 生成Prisma Client
- `npm run db:push` - 推送schema到数据库(开发用)
- `npm run db:migrate` - 运行数据库迁移(生产用)
- `npm run db:seed` - 数据库种子数据
- `npm run db:studio` - 打开Prisma Studio
- `npm run db:reset` - 重置数据库

## Git hooks

- `npm run pre-commit` - Git pre-commit hook (lint-staged)
- `npm run pre-push` - Git pre-push hook (完整检查)

## PM2部署 (生产环境)

- `npm run pm2:start` - 启动PM2进程
- `npm run pm2:stop` - 停止所有进程
- `npm run pm2:restart` - 重启所有进程
- `npm run pm2:logs` - 查看日志
- `npm run pm2:status` - 查看状态

## Windows系统工具

由于项目运行在Windows环境，使用以下命令：

- 列出目录: `dir` (cmd) 或使用 Glob tool
- 导航: 使用绝对路径，避免cd命令
- 查找文件: 使用 Glob 或 Grep tools
- Git: 标准git命令可用
