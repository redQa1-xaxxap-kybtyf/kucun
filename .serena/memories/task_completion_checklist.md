# 任务完成检查清单

## 代码提交前必须执行

### 1. 类型检查

```bash
npm run type-check
```

- 确保没有TypeScript错误
- 确保没有隐式any类型
- 确保类型推断正确

### 2. 代码检查

```bash
npm run lint
# 或自动修复
npm run lint:fix
```

- 修复所有ESLint错误
- 解决ESLint警告

### 3. 代码格式化

```bash
npm run format
```

- 统一代码风格
- 符合Prettier规范

### 4. 构建测试

```bash
npm run build
```

- 确保生产环境构建成功
- 检查构建警告

### 5. 数据库同步

如果修改了Prisma schema:

```bash
npm run db:generate  # 生成Prisma Client
npm run db:push      # 开发环境
# 或
npm run db:migrate   # 生产环境
```

## 快速检查命令

```bash
npm run check-all
```

运行: type-check + lint + format:check

## Git提交

项目配置了Husky hooks:

- **pre-commit**: 自动运行lint-staged (ESLint + Prettier)
- **pre-push**: 运行完整检查 (type-check + lint + format:check + build)

## 质量标准

- ✅ 无TypeScript错误
- ✅ 无ESLint错误
- ✅ 代码已格式化
- ✅ 构建成功
- ✅ 关键功能手动测试通过
- ✅ API响应符合类型定义
- ✅ 错误处理完整
